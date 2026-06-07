import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import { error, type Handle } from '@sveltejs/kit';
import { runMigrations } from '$lib/server/db/migrate.ts';
import { resolveEventSource, withEventSource } from '$lib/server/event-context.ts';
import { consume, retryAfter } from '$lib/server/rate-limit.ts';
import { logEvent } from '$lib/server/services/events.ts';

let migrated = false;

// Sign-in / sign-up brute-force guard. 10 attempts per minute per IP — enough
// for genuine typos, painful for credential stuffing. The rate-limit helper
// trims its map automatically.
const SIGN_IN_RATE = { capacity: 10, refillRate: 10 / 60 };

const SIGN_IN_PATHS = new Set([
	'/api/auth/sign-in/email',
	'/api/auth/sign-up/email'
]);

const signInRateLimiter: Handle = async ({ event, resolve }) => {
	if (event.request.method !== 'POST' || !SIGN_IN_PATHS.has(event.url.pathname)) {
		return resolve(event);
	}
	const ip = event.getClientAddress();
	const key = `sign-in:${ip}`;
	if (!consume(key, SIGN_IN_RATE)) {
		const retry = retryAfter(key, SIGN_IN_RATE);
		logEvent(
			'rate_limit_hit',
			`sign-in rate limit hit from ${ip} (retry in ${retry}s)`,
			null,
			undefined,
			'warning'
		).catch(() => {});
		return new Response(
			JSON.stringify({ error: { message: `Too many attempts. Try again in ${retry}s.` } }),
			{
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': String(retry) }
			}
		);
	}
	return resolve(event);
};

const sessionResolver: Handle = async ({ event, resolve }) => {
	if (!migrated) {
		migrated = true;
		await runMigrations();
	}

	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	// Stamp the event source for any logEvent() calls that fire downstream
	// (e.g. webhooks log as 'webhook' instead of the default 'user').
	const source = resolveEventSource(event.url.pathname);
	return withEventSource(source, () =>
		svelteKitHandler({ event, resolve, auth, building })
	) as ReturnType<typeof resolve>;
};

const PUBLIC_API_PATHS = new Set(['/api/health']);

const apiGate: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const needsAuth =
		path.startsWith('/api/') &&
		!path.startsWith('/api/auth/') &&
		!PUBLIC_API_PATHS.has(path);

	if (needsAuth && !event.locals.user) {
		error(401, 'Authentication required');
	}

	return resolve(event);
};

export const handle = sequence(signInRateLimiter, sessionResolver, apiGate);
