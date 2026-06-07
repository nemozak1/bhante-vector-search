<script lang="ts">
	import * as adminFeedback from '../feedback.remote';
	import type { FeedbackStatus, FeedbackCategory } from '$lib/types';

	const STATUS_CHIPS: Array<{ value: FeedbackStatus | null; label: string }> = [
		{ value: null, label: 'All' },
		{ value: 'new', label: 'New' },
		{ value: 'triaged', label: 'Triaged' },
		{ value: 'resolved', label: 'Resolved' },
		{ value: 'dismissed', label: 'Dismissed' }
	];

	const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
		bug: 'Bug',
		seminar_misformatting: 'Seminar — misformatting',
		seminar_correction: 'Seminar — correction',
		search_quality: 'Search quality',
		feature: 'Feature',
		question: 'Question',
		other: 'Other'
	};

	let status: FeedbackStatus | null = $state('new');
	let page = $state(1);
	const pageSize = 25;

	const listQuery = $derived(adminFeedback.list({ status, page, pageSize }));

	function fmtDate(iso: string): string {
		return new Date(iso).toLocaleString();
	}
</script>

<section class="page">
	<header class="page-header">
		<h1>Feedback</h1>
	</header>

	<div class="filters">
		{#each STATUS_CHIPS as chip}
			<button
				type="button"
				class="chip"
				class:active={status === chip.value}
				onclick={() => {
					status = chip.value;
					page = 1;
				}}
			>
				{chip.label}
			</button>
		{/each}
	</div>

	{#if listQuery.loading}
		<p class="muted">Loading…</p>
	{:else if listQuery.error}
		<p class="error">{listQuery.error.message}</p>
	{:else if listQuery.current}
		{@const data = listQuery.current}
		{#if data.items.length === 0}
			<p class="muted">No feedback in this view.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>When</th>
						<th>Status</th>
						<th>Category</th>
						<th>From</th>
						<th>Message</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as item}
						<tr>
							<td class="nowrap">
								<a href="/admin/feedback/{item.id}">{fmtDate(item.created_at)}</a>
							</td>
							<td><span class="status status-{item.status}">{item.status}</span></td>
							<td class="nowrap">{CATEGORY_LABELS[item.category]}</td>
							<td class="nowrap">{item.email_snapshot}</td>
							<td class="preview">{item.message_preview}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="pager">
				<button type="button" disabled={page === 1} onclick={() => page--}>Prev</button>
				<span class="muted">
					Page {page} · {data.total} total
				</span>
				<button
					type="button"
					disabled={page * pageSize >= data.total}
					onclick={() => page++}
				>
					Next
				</button>
			</div>
		{/if}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.page-header h1 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.6rem;
		margin: 0;
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.chip {
		font: inherit;
		font-size: 0.82rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text-muted);
		border-radius: 999px;
		cursor: pointer;
	}
	.chip.active {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.55rem 0.5rem;
		border-bottom: 1px solid var(--border-light);
		vertical-align: top;
	}
	th {
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
	}
	td a {
		color: var(--accent);
		text-decoration: none;
	}
	td a:hover {
		text-decoration: underline;
	}
	.nowrap {
		white-space: nowrap;
	}
	.preview {
		color: var(--text);
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.error {
		color: #9c2a2a;
	}
	.status {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 3px;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		background: var(--border-light);
		color: var(--text-muted);
	}
	.status-new {
		background: #f4e8c8;
		color: #7a5e1f;
	}
	.status-triaged {
		background: #d8e4cf;
		color: #4a6238;
	}
	.status-resolved {
		background: #cfe2db;
		color: #2b5e51;
	}
	.status-dismissed {
		background: var(--border-light);
		color: var(--text-muted);
	}
	.pager {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: center;
		padding-top: 0.75rem;
	}
	.pager button {
		font: inherit;
		font-size: 0.82rem;
		padding: 0.35rem 0.8rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
	}
	.pager button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
