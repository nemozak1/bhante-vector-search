<script lang="ts">
	import { onMount } from 'svelte';
	import * as reviewRemote from '../review.remote';
	import type { ReviewStatusItem } from '$lib/types';

	let data: Record<string, ReviewStatusItem> = $state({});
	let loading = $state(true);
	let error = $state('');
	let sortBy = $state<'issues' | 'code' | 'status'>('issues');
	let filterStatus = $state<'all' | 'reviewed' | 'unreviewed' | 'broken'>('all');

	onMount(async () => {
		try {
			data = await reviewRemote.status().run();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load review status';
		} finally {
			loading = false;
		}
	});

	let entries = $derived.by(() => {
		let items = Object.entries(data).map(([code, info]) => ({ code, ...info }));

		if (filterStatus !== 'all') {
			items = items.filter((e) => e.status === filterStatus);
		}

		if (sortBy === 'issues') {
			items.sort((a, b) => b.issues.length - a.issues.length || a.code.localeCompare(b.code));
		} else if (sortBy === 'code') {
			items.sort((a, b) => a.code.localeCompare(b.code));
		} else if (sortBy === 'status') {
			items.sort(
				(a, b) => a.status.localeCompare(b.status) || b.issues.length - a.issues.length
			);
		}

		return items;
	});

	let stats = $derived.by(() => {
		const all = Object.values(data);
		return {
			total: all.length,
			reviewed: all.filter((e) => e.status === 'reviewed').length,
			broken: all.filter((e) => e.status === 'broken').length,
			unreviewed: all.filter((e) => e.status === 'unreviewed').length,
			totalIssues: all.reduce((sum, e) => sum + e.issues.length, 0),
			missingDate: all.filter((e) => e.issues.includes('missing_date')).length,
			missingLocation: all.filter((e) => e.issues.includes('missing_location')).length
		};
	});

	function statusClass(status: string): string {
		if (status === 'reviewed') return 'badge-reviewed';
		if (status === 'broken') return 'badge-broken';
		return 'badge-unreviewed';
	}
</script>

<div class="review-page">
	<h2>Seminar Review Status</h2>

	{#if loading}
		<p class="status-msg">Loading review data...</p>
	{:else if error}
		<div class="error-msg">{error}</div>
	{:else}
		<div class="summary-cards">
			<div class="card">
				<div class="card-value">{stats.total}</div>
				<div class="card-label">Total</div>
			</div>
			<button
				class="card"
				class:card-active={filterStatus === 'reviewed'}
				onclick={() => (filterStatus = filterStatus === 'reviewed' ? 'all' : 'reviewed')}
			>
				<div class="card-value reviewed">{stats.reviewed}</div>
				<div class="card-label">Reviewed</div>
			</button>
			<button
				class="card"
				class:card-active={filterStatus === 'unreviewed'}
				onclick={() =>
					(filterStatus = filterStatus === 'unreviewed' ? 'all' : 'unreviewed')}
			>
				<div class="card-value unreviewed">{stats.unreviewed}</div>
				<div class="card-label">Unreviewed</div>
			</button>
			<button
				class="card"
				class:card-active={filterStatus === 'broken'}
				onclick={() => (filterStatus = filterStatus === 'broken' ? 'all' : 'broken')}
			>
				<div class="card-value broken">{stats.broken}</div>
				<div class="card-label">Broken</div>
			</button>
		</div>

		<div class="progress-bar-container">
			<div class="progress-bar">
				<div
					class="progress-fill reviewed"
					style="width: {(stats.reviewed / stats.total) * 100}%"
				></div>
				<div
					class="progress-fill broken"
					style="width: {(stats.broken / stats.total) * 100}%"
				></div>
			</div>
			<div class="progress-label">
				{Math.round((stats.reviewed / stats.total) * 100)}% reviewed
			</div>
		</div>

		<div class="controls">
			<span class="showing">
				Showing {entries.length} of {stats.total}
			</span>
			<div class="sort-controls">
				<span class="sort-label">Sort:</span>
				<button class="sort-btn" class:active={sortBy === 'issues'} onclick={() => (sortBy = 'issues')}>Issues</button>
				<button class="sort-btn" class:active={sortBy === 'code'} onclick={() => (sortBy = 'code')}>Code</button>
				<button class="sort-btn" class:active={sortBy === 'status'} onclick={() => (sortBy = 'status')}>Status</button>
			</div>
		</div>

		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Code</th>
						<th>Title</th>
						<th>Status</th>
						<th class="num">Turns</th>
						<th class="num">Issues</th>
					</tr>
				</thead>
				<tbody>
					{#each entries as entry}
						<tr class:row-reviewed={entry.status === 'reviewed'} class:row-broken={entry.status === 'broken'}>
							<td>
								<a href="/review/{entry.code}" class="code-link">{entry.code}</a>
							</td>
							<td class="title-cell">{entry.title}</td>
							<td>
								<span class="badge {statusClass(entry.status)}">{entry.status}</span>
							</td>
							<td class="num">{entry.turn_count}</td>
							<td class="num">
								{#if entry.issues.length > 0}
									<span class="issue-count" title={entry.issues.join('\n')}>{entry.issues.length}</span>
								{:else}
									<span class="no-issues">0</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.review-page {
		max-width: 100%;
	}

	h2 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.status-msg {
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
	}

	.summary-cards {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.card {
		flex: 1;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		padding: 1rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.2s, box-shadow 0.2s;
		font-family: inherit;
		color: inherit;
	}

	.card:hover {
		border-color: var(--border);
	}

	.card-active {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.card-value {
		font-family: 'Cormorant Garamond', serif;
		font-size: 2rem;
		font-weight: 600;
		line-height: 1.1;
	}

	.card-value.reviewed {
		color: var(--seminar-accent);
	}

	.card-value.unreviewed {
		color: var(--text-muted);
	}

	.card-value.broken {
		color: #8b3a2e;
	}

	.card-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.progress-bar-container {
		margin-bottom: 1.5rem;
	}

	.progress-bar {
		height: 6px;
		background: var(--border-light);
		border-radius: 3px;
		overflow: hidden;
		display: flex;
	}

	.progress-fill.reviewed {
		background: var(--seminar-accent);
		transition: width 0.5s ease;
	}

	.progress-fill.broken {
		background: #8b3a2e;
		transition: width 0.5s ease;
	}

	.progress-label {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin-top: 0.35rem;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.showing {
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.sort-controls {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.sort-label {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin-right: 0.25rem;
	}

	.sort-btn {
		font-family: inherit;
		font-size: 0.78rem;
		background: none;
		border: 1px solid var(--border-light);
		border-radius: 4px;
		padding: 0.2rem 0.5rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s;
	}

	.sort-btn:hover {
		border-color: var(--border);
		color: var(--text);
	}

	.sort-btn.active {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	th {
		text-align: left;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	td {
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid var(--border-light);
		vertical-align: middle;
	}

	th.num,
	td.num {
		text-align: right;
	}

	.title-cell {
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.code-link {
		color: var(--accent);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.82rem;
	}

	.code-link:hover {
		text-decoration: underline;
	}

	.badge {
		display: inline-block;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.45rem;
		border-radius: 3px;
	}

	.badge-reviewed {
		background: #e8f0e4;
		color: var(--seminar-accent);
	}

	.badge-unreviewed {
		background: var(--border-light);
		color: var(--text-muted);
	}

	.badge-broken {
		background: #fdf0ef;
		color: #8b3a2e;
	}

	.issue-count {
		color: var(--book-accent);
		font-weight: 600;
	}

	.no-issues {
		color: var(--text-muted);
	}

	tr.row-reviewed {
		opacity: 0.7;
	}

	tr.row-broken {
		opacity: 0.5;
	}

	tr:hover {
		background: var(--surface);
		opacity: 1;
	}

	@media (max-width: 600px) {
		.summary-cards {
			flex-wrap: wrap;
		}

		.card {
			min-width: calc(50% - 0.5rem);
		}

		.title-cell {
			max-width: 150px;
		}
	}
</style>
