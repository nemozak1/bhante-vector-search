/** Tiny in-process rate limiter — leaky-bucket per key. Suitable for an alpha
 *  single-instance deploy. Replace with a Redis-backed limiter when you have
 *  more than one process or care about cross-instance fairness. */

type Bucket = {
	tokens: number;
	lastRefill: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
	/** Bucket capacity (max burst). */
	capacity: number;
	/** Tokens added per second. */
	refillRate: number;
};

/** Returns true if the key is allowed to consume one token, false if exhausted. */
export function consume(key: string, cfg: RateLimitConfig): boolean {
	const now = Date.now();
	let b = buckets.get(key);
	if (!b) {
		b = { tokens: cfg.capacity, lastRefill: now };
		buckets.set(key, b);
	}
	const elapsed = (now - b.lastRefill) / 1000;
	b.tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillRate);
	b.lastRefill = now;
	if (b.tokens < 1) return false;
	b.tokens -= 1;
	return true;
}

/** How many seconds until the bucket has at least 1 token again. */
export function retryAfter(key: string, cfg: RateLimitConfig): number {
	const b = buckets.get(key);
	if (!b || b.tokens >= 1) return 0;
	return Math.ceil((1 - b.tokens) / cfg.refillRate);
}

/** Reset a bucket (e.g. after a successful auth). */
export function reset(key: string): void {
	buckets.delete(key);
}

// Trim the map periodically so it doesn't grow forever in long-lived processes.
// 1h cadence; remove fully-refilled idle buckets (no consumption in 10min).
if (typeof setInterval !== 'undefined') {
	setInterval(
		() => {
			const now = Date.now();
			for (const [key, b] of buckets) {
				if (now - b.lastRefill > 10 * 60 * 1000) buckets.delete(key);
			}
		},
		60 * 60 * 1000
	).unref?.();
}
