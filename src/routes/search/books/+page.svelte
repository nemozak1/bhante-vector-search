<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import BookResult from '$lib/components/BookResult.svelte';
	import ResultList from '$lib/components/ResultList.svelte';
	import * as searchRemote from '../../search.remote';
	import type { BookResult as BookResultType } from '$lib/types';
	import { bookSearchState } from '$lib/searchState';

	let cached = bookSearchState.get();
	let results: BookResultType[] = $state(cached.results);
	let query = $state(cached.query);
	let loading = $state(false);
	let error = $state('');
	let searched = $state(cached.searched);

	async function handleSearch(q: string, k: number) {
		loading = true;
		error = '';
		query = q;
		try {
			const data = await searchRemote.books({ query: q, k }).run();
			results = data.results;
			searched = true;
			bookSearchState.set({ query: q, k, results: data.results, searched: true });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Search failed';
			results = [];
		} finally {
			loading = false;
		}
	}
</script>

<SearchBar onSearch={handleSearch} {loading} placeholder="Search published books..." initialQuery={cached.query} initialK={cached.k} />

{#if error}
	<div class="error-msg">{error}</div>
{/if}

{#if searched && results.length > 0}
	<ResultList totalResults={results.length} {query}>
		{#each results as result}
			<BookResult {result} />
		{/each}
	</ResultList>
{:else if searched && !loading}
	<p class="empty">No results found. Try a different query.</p>
{/if}

<style>
	.error-msg {
		background: #fdf0ef;
		color: #8b3a2e;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.empty {
		text-align: center;
		color: var(--text-muted);
		padding: 3rem 0;
		font-style: italic;
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.1rem;
	}
</style>
