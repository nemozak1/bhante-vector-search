<script lang="ts">
	import * as healthRemote from '../health.remote';
	import { Check, X, AlertTriangle } from '@lucide/svelte';

	const snapQ = $derived(healthRemote.snapshot());

	function relative(iso: string | null): string {
		if (!iso) return '—';
		const ms = Date.now() - new Date(iso).getTime();
		const sec = Math.round(ms / 1000);
		if (sec < 60) return `${sec}s ago`;
		const min = Math.round(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.round(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const day = Math.round(hr / 24);
		return `${day}d ago`;
	}

	function fmtNum(n: number): string {
		return n.toLocaleString();
	}
</script>

<section class="page">
	<header class="page-header">
		<h1>Health</h1>
	</header>

	{#if snapQ.loading}
		<p class="muted">Loading…</p>
	{:else if snapQ.error}
		<p class="error">{snapQ.error.message}</p>
	{:else if snapQ.current}
		{@const s = snapQ.current}

		<div class="block">
			<h3>Configuration</h3>
			<ul class="check-list">
				<li>
					{#if s.r2_configured}
						<Check size={16} class="ok" />
					{:else}
						<X size={16} class="warn" />
					{/if}
					<span>
						<strong>R2 screenshot storage</strong>:
						{s.r2_configured ? `configured → ${s.r2_feedback_bucket}` : 'not configured (widget falls back to inline base64)'}
					</span>
				</li>
				<li>
					{#if s.feedback_slack_configured}
						<Check size={16} class="ok" />
					{:else}
						<X size={16} class="warn" />
					{/if}
					<span>
						<strong>Feedback Slack notifications</strong>:
						{s.feedback_slack_configured ? 'enabled' : 'no webhook set'}
					</span>
				</li>
				<li>
					{#if s.last_ingestion}
						<Check size={16} class="ok" />
					{:else}
						<AlertTriangle size={16} class="warn" />
					{/if}
					<span>
						<strong>Last ingestion run</strong>:
						{s.last_ingestion ? relative(s.last_ingestion) : 'never'}
					</span>
				</li>
			</ul>
		</div>

		<div class="block">
			<h3>pgvector chunks by collection</h3>
			{#if s.chunks.length === 0}
				<p class="muted">No chunks ingested yet.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Collection</th>
							<th class="num">Chunks</th>
							<th class="num">Distinct entities</th>
						</tr>
					</thead>
					<tbody>
						{#each s.chunks as c (c.collection)}
							<tr>
								<td class="mono small">{c.collection}</td>
								<td class="num">{fmtNum(c.chunk_count)}</td>
								<td class="num">{fmtNum(c.distinct_entities)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		<div class="block">
			<h3>Table row counts (approximate)</h3>
			<table>
				<thead>
					<tr>
						<th>Table</th>
						<th class="num">Rows</th>
					</tr>
				</thead>
				<tbody>
					{#each s.tables as t (t.table_name)}
						<tr>
							<td class="mono small">{t.table_name}</td>
							<td class="num">{fmtNum(t.row_count)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="muted small">
				Counts come from <code>pg_class.reltuples</code>, updated by autovacuum. Off by a
				row or two; fast enough for big tables.
			</p>
		</div>

		<div class="block">
			<h3>Recent errors &amp; warnings (last 24h)</h3>
			{#if s.recent_errors.length === 0}
				<p class="muted">No errors or warnings.</p>
			{:else}
				<ul class="errors">
					{#each s.recent_errors as e (e.id)}
						<li>
							<time datetime={e.created_at}>{relative(e.created_at)}</time>
							<span class="type">{e.type}</span>
							<span class="msg">{e.message}</span>
						</li>
					{/each}
				</ul>
				<p class="muted small">
					<a href="/admin/events?level=error">All errors</a>
					·
					<a href="/admin/events?level=warning">All warnings</a>
				</p>
			{/if}
		</div>
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
	.block {
		padding: 1rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 4px;
	}
	.block h3 {
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 600;
		margin: 0 0 0.75rem;
	}
	.check-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.88rem;
	}
	.check-list li {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	:global(.ok) {
		color: #2b7048;
	}
	:global(.warn) {
		color: #b35a32;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--border-light);
	}
	th {
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
	}
	.num {
		text-align: right;
	}
	.mono {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
	}
	.small {
		font-size: 0.78rem;
	}
	.errors {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.85rem;
	}
	.errors li {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: 0.75rem;
		align-items: baseline;
		padding-bottom: 0.4rem;
		border-bottom: 1px dashed var(--border-light);
	}
	.errors .type {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.74rem;
		color: var(--text-muted);
	}
	.errors .msg {
		color: var(--text);
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.muted.small {
		font-size: 0.76rem;
		margin-top: 0.5rem;
	}
	.error {
		color: #9c2a2a;
	}
	time {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	a {
		color: var(--accent);
	}
</style>
