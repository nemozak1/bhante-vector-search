import { pushState, replaceState } from '$app/navigation';
import { page } from '$app/state';
import { LocalStorage } from './storage.svelte';
import type { SearchScope } from './types';

/** Route that owns a given search scope. */
export function scopeHref(scope: SearchScope): string {
	return scope === 'all' ? '/search' : `/search/${scope}`;
}

const MIN_K = 1;
const MAX_K = 50;
export const clampK = (n: number) => Math.min(MAX_K, Math.max(MIN_K, Math.round(n || 0))) || 5;

type Cached<T> = { query: string; k: number; results: T[]; searched: boolean };

type CacheShape = {
	k: number; // preferred result count (sticky across reloads)
	all: Cached<unknown> | null;
	books: Cached<unknown> | null;
	seminars: Cached<unknown> | null;
};

const DEFAULT_CACHE: CacheShape = { k: 5, all: null, books: null, seminars: null };

// One shared, persisted cache for all three scopes. Holds the last search per
// scope so a reload restores results without re-embedding (an OpenAI call).
const cache = new LocalStorage<CacheShape>('bhante:search-cache', DEFAULT_CACHE);

type Runner<T> = (q: string, k: number) => Promise<{ results: T[] }>;

/**
 * Drives a single search scope. The URL (`?q` / `?k`) is the source of truth:
 * an internal `$effect` runs (or restores from cache) whenever those params
 * change — covering initial load, shared links, and back/forward navigation.
 * Submitting a query pushes a new URL; the effect then executes it.
 *
 * Instantiate at the top level of a page `<script>` so the effect is bound to
 * the component lifecycle.
 */
export class SearchController<T> {
	#scope: SearchScope;
	#run: Runner<T>;
	#lastKey = '';
	#defaultK: number; // sticky preferred result count; plain field so the effect doesn't depend on it

	query = $state('');
	k = $state(5);
	results = $state.raw<T[]>([]);
	searched = $state(false);
	loading = $state(false);
	error = $state('');

	constructor(scope: SearchScope, run: Runner<T>) {
		this.#scope = scope;
		this.#run = run;
		this.#defaultK = clampK(cache.current.k);
		this.k = this.#defaultK;

		$effect(() => {
			const params = page.url.searchParams;
			const urlQ = (params.get('q') ?? '').trim();

			if (urlQ) {
				const k = clampK(Number(params.get('k')) || this.#defaultK);
				if (this.#keyOf(urlQ, k) === this.#lastKey) return; // already shown / in flight
				void this.#execute(urlQ, k, false);
				return;
			}

			// Bare URL (e.g. returning to the Search tab) — restore the last
			// search for this scope once, and reflect it in the URL so it stays
			// shareable. Only on the very first run, so we don't fight the user.
			if (this.#lastKey === '') {
				const cached = cache.current[this.#scope] as Cached<T> | null;
				if (cached?.searched && cached.query) this.#restore(cached);
			}
		});
	}

	#keyOf(q: string, k: number) {
		return `${q}::${k}`;
	}

	#urlFor(q: string, k: number) {
		return `${scopeHref(this.#scope)}?q=${encodeURIComponent(q)}&k=${k}`;
	}

	#restore(cached: Cached<T>) {
		this.query = cached.query;
		this.k = cached.k;
		this.results = cached.results;
		this.searched = true;
		this.#lastKey = this.#keyOf(cached.query, cached.k);
		replaceState(this.#urlFor(cached.query, cached.k), {});
	}

	async #execute(q: string, k: number, pushUrl: boolean) {
		this.error = '';
		this.query = q;
		this.k = k;
		this.#lastKey = this.#keyOf(q, k); // set before navigating so the effect skips

		if (pushUrl) pushState(this.#urlFor(q, k), {});

		const cached = cache.current[this.#scope] as Cached<T> | null;
		if (cached && cached.query === q && cached.k === k && cached.searched) {
			this.results = cached.results;
			this.searched = true;
			return; // cache hit — no embedding / network round-trip
		}

		this.loading = true;
		try {
			const data = await this.#run(q, k);
			this.results = data.results;
			this.searched = true;
			this.#writeCache(q, k, data.results);
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Search failed';
			this.results = [];
			this.searched = true;
		} finally {
			this.loading = false;
		}
	}

	#writeCache(q: string, k: number, results: T[]) {
		cache.current = {
			...cache.current,
			k,
			[this.#scope]: { query: q, k, results, searched: true }
		};
	}

	/** Called by the SearchBar when the user submits a query on this scope. */
	submit(q: string, k: number) {
		const trimmed = q.trim();
		if (!trimmed) return;
		void this.#execute(trimmed, clampK(k), true);
	}
}
