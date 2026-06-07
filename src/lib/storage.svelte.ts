import { browser } from '$app/environment';

/**
 * Reactive wrapper around `localStorage`. On construction it reads the existing
 * value (falling back to `initial` when the key is absent or the stored JSON is
 * corrupt), and writes back on every assignment to `.current`. Reading
 * `.current` participates in Svelte reactivity, so components re-render when the
 * stored value changes. Values must be JSON-serialisable.
 *
 * Guarded with `browser` so it is inert during SSR/prerender (this app runs
 * CSR-only, but the guard keeps the util safe to import anywhere).
 */
export class LocalStorage<T> {
	#key: string;
	#current = $state.raw<T>(undefined as T);

	constructor(key: string, initial: T) {
		this.#key = key;
		let value = initial;
		if (browser) {
			const stored = localStorage.getItem(key);
			if (stored !== null) {
				try {
					value = JSON.parse(stored) as T;
				} catch {
					// corrupt entry — fall back to the initial value
				}
			}
		}
		this.#current = value;
	}

	get current(): T {
		return this.#current;
	}

	set current(value: T) {
		this.#current = value;
		if (browser) {
			try {
				localStorage.setItem(this.#key, JSON.stringify(value));
			} catch {
				// quota exceeded or value unserialisable — keep the in-memory copy
			}
		}
	}
}
