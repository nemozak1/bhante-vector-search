<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import BookResult from '$lib/components/BookResult.svelte';
	import SeminarResult from '$lib/components/SeminarResult.svelte';
	import ResultList from '$lib/components/ResultList.svelte';
	import { SearchController } from '$lib/searchController.svelte';
	import * as searchRemote from '../search.remote';
	import type { UnifiedResult } from '$lib/types';

	const ctrl = new SearchController<UnifiedResult>('all', (q, k) =>
		searchRemote.all({ query: q, k }).run()
	);
</script>

<SearchBar
	scope="all"
	onSearch={(q, k) => ctrl.submit(q, k)}
	loading={ctrl.loading}
	bind:query={ctrl.query}
	bind:k={ctrl.k}
	placeholder="Search all books and seminars..."
/>

{#if ctrl.error}
	<div class="error-msg">{ctrl.error}</div>
{/if}

{#if ctrl.searched && ctrl.results.length > 0}
	<ResultList totalResults={ctrl.results.length} query={ctrl.query}>
		{#each ctrl.results as result}
			{#if result.content_type === 'epub'}
				<div class="type-badge book-badge">Book</div>
				<BookResult result={{
					content: result.content,
					page: result.page,
					page_label: result.page_label,
					chapter: result.chapter,
					work: result.work,
					score: result.score,
				}} />
			{:else}
				<div class="type-badge seminar-badge">Seminar</div>
				<SeminarResult result={{
					content: result.content,
					seminar_title: result.seminar_title,
					seminar_code: result.seminar_code,
					speaker: result.speaker,
					section_heading: result.section_heading,
					date: result.date,
					location: result.location,
					score: result.score,
				}} />
			{/if}
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

	.type-badge {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0.15rem 0.5rem;
		border-radius: 3px;
		display: inline-block;
		margin-bottom: 0.35rem;
	}

	.book-badge {
		background: #f5eed8;
		color: var(--book-accent);
	}

	.seminar-badge {
		background: #e8f0e3;
		color: var(--seminar-accent);
	}
</style>
