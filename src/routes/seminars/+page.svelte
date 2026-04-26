<script lang="ts">
	import { onMount } from 'svelte';
	import * as seminarsRemote from '../seminars.remote';
	import type { SeminarListItem } from '$lib/types';

	let seminars: SeminarListItem[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let filter = $state('');
	let currentPage = $state(1);
	const perPage = 20;

	let filtered = $derived(
		filter
			? seminars.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()))
			: seminars
	);

	let totalPages = $derived(Math.max(1, Math.ceil(filtered.length / perPage)));
	let paginated = $derived(filtered.slice((currentPage - 1) * perPage, currentPage * perPage));

	// Reset to page 1 when filter changes
	$effect(() => {
		filter;
		currentPage = 1;
	});

	onMount(async () => {
		try {
			seminars = await seminarsRemote.list();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load seminars';
		} finally {
			loading = false;
		}
	});
</script>

<div class="seminars-list">
	<div class="filter-bar">
		<input
			type="text"
			class="filter-input"
			placeholder="Filter by title..."
			bind:value={filter}
		/>
	</div>

	{#if loading}
		<p class="status">Loading seminars...</p>
	{:else if error}
		<div class="error-msg">{error}</div>
	{:else if filtered.length === 0}
		<p class="status">No seminars found.</p>
	{:else}
		<p class="count">{filtered.length} seminar{filtered.length !== 1 ? 's' : ''}</p>

		<ul class="list">
			{#each paginated as seminar}
				<li>
					<a href="/seminars/{seminar.code}" class="seminar-link">
						<span class="seminar-title">{seminar.title}</span>
						{#if seminar.date || seminar.location}
							<span class="seminar-meta">
								{#if seminar.date}{seminar.date}{/if}
								{#if seminar.date && seminar.location} &mdash; {/if}
								{#if seminar.location}{seminar.location}{/if}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>

		{#if totalPages > 1}
			<nav class="pagination">
				<button
					class="page-btn"
					disabled={currentPage <= 1}
					onclick={() => currentPage--}
				>
					&larr; Prev
				</button>
				<span class="page-info">Page {currentPage} of {totalPages}</span>
				<button
					class="page-btn"
					disabled={currentPage >= totalPages}
					onclick={() => currentPage++}
				>
					Next &rarr;
				</button>
			</nav>
		{/if}
	{/if}
</div>

<style>
	.filter-bar {
		margin-bottom: 1.25rem;
	}

	.filter-input {
		width: 100%;
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.92rem;
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		outline: none;
		transition: border-color 0.2s;
	}

	.filter-input:focus {
		border-color: var(--accent);
	}

	.filter-input::placeholder {
		color: var(--text-muted);
	}

	.status {
		text-align: center;
		color: var(--text-muted);
		padding: 3rem 0;
		font-style: italic;
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.1rem;
	}

	.error-msg {
		background: #fdf0ef;
		color: #8b3a2e;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.count {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	.list {
		list-style: none;
	}

	.list li {
		border-bottom: 1px solid var(--border-light);
	}

	.list li:first-child {
		border-top: 1px solid var(--border-light);
	}

	.seminar-link {
		display: block;
		padding: 0.85rem 0.25rem;
		text-decoration: none;
		transition: background 0.15s;
	}

	.seminar-link:hover {
		background: rgba(122, 98, 72, 0.04);
	}

	.seminar-title {
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.08rem;
		color: var(--text);
		display: block;
		line-height: 1.35;
	}

	.seminar-meta {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.78rem;
		color: var(--text-muted);
		display: block;
		margin-top: 0.15rem;
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
	}

	.page-btn {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.82rem;
		background: none;
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.35rem 0.85rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s;
	}

	.page-btn:hover:not(:disabled) {
		color: var(--accent);
		border-color: var(--accent);
	}

	.page-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.page-info {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.82rem;
		color: var(--text-muted);
	}
</style>
