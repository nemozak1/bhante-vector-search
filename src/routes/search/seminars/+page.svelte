<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import SeminarResult from '$lib/components/SeminarResult.svelte';
	import ResultList from '$lib/components/ResultList.svelte';
	import { SearchController } from '$lib/searchController.svelte';
	import * as searchRemote from '../../search.remote';
	import type { SeminarResult as SeminarResultType } from '$lib/types';

	const ctrl = new SearchController<SeminarResultType>('seminars', (q, k) =>
		searchRemote.seminars({ query: q, k }).run()
	);
</script>

<SearchBar
	scope="seminars"
	onSearch={(q, k) => ctrl.submit(q, k)}
	loading={ctrl.loading}
	bind:query={ctrl.query}
	bind:k={ctrl.k}
	placeholder="Search seminar transcripts..."
/>

{#if ctrl.error}
	<div class="error-msg">{ctrl.error}</div>
{/if}

{#if ctrl.searched && ctrl.results.length > 0}
	<ResultList totalResults={ctrl.results.length} query={ctrl.query}>
		{#each ctrl.results as result}
			<SeminarResult {result} />
		{/each}
	</ResultList>
{:else if ctrl.searched && !ctrl.loading}
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
