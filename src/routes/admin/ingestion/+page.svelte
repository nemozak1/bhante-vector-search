<script lang="ts">
	import * as ingestionRemote from '../ingestion.remote';
	import type { IngestEntityKind } from '$lib/server/dal/ingestion';

	let kind: IngestEntityKind | null = $state(null);
	const limit = 100;

	const summaryQ = $derived(ingestionRemote.summary());
	const listQ = $derived(ingestionRemote.list({ kind, limit }));

	function fmtDate(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString();
	}

	function shortSha(sha: string | null): string {
		if (!sha) return '—';
		return sha.slice(0, 8);
	}

	function relative(iso: string): string {
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
</script>

<section class="page">
	<header class="page-header">
		<h1>Ingestion</h1>
	</header>

	{#if summaryQ.current}
		{@const s = summaryQ.current}
		<div class="summary">
			<div class="card">
				<div class="card-value">{s.total_runs.toLocaleString()}</div>
				<div class="card-label">Total runs</div>
			</div>
			<div class="card">
				<div class="card-value">{s.total_chunks.toLocaleString()}</div>
				<div class="card-label">Chunks</div>
			</div>
			<div class="card">
				<div class="card-value">{s.unique_seminars}</div>
				<div class="card-label">Seminars</div>
			</div>
			<div class="card">
				<div class="card-value">{s.unique_books}</div>
				<div class="card-label">Books</div>
			</div>
			<div class="card">
				<div class="card-value small">{s.last_run_at ? relative(s.last_run_at) : '—'}</div>
				<div class="card-label">Last run</div>
			</div>
		</div>
	{/if}

	<div class="filters">
		<button type="button" class="chip" class:active={kind === null} onclick={() => (kind = null)}>
			All
		</button>
		<button
			type="button"
			class="chip"
			class:active={kind === 'seminar'}
			onclick={() => (kind = 'seminar')}
		>
			Seminars
		</button>
		<button
			type="button"
			class="chip"
			class:active={kind === 'book'}
			onclick={() => (kind = 'book')}
		>
			Books
		</button>
	</div>

	{#if listQ.loading}
		<p class="muted">Loading…</p>
	{:else if listQ.error}
		<p class="error">{listQ.error.message}</p>
	{:else if listQ.current}
		{#if listQ.current.length === 0}
			<p class="muted">No runs match.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>When</th>
						<th>Kind</th>
						<th>Entity</th>
						<th>Collection</th>
						<th>Model</th>
						<th class="num">Chunks</th>
						<th>Source SHA</th>
						<th>By</th>
					</tr>
				</thead>
				<tbody>
					{#each listQ.current as r (r.id)}
						<tr>
							<td class="nowrap">
								<time datetime={r.ingested_at} title={fmtDate(r.ingested_at)}>
									{relative(r.ingested_at)}
								</time>
							</td>
							<td>
								<span class="kind kind-{r.entity_kind}">{r.entity_kind}</span>
							</td>
							<td class="nowrap">
								{#if r.entity_kind === 'seminar'}
									<a href="/seminars/{r.entity_id}">{r.entity_id}</a>
								{:else}
									{r.entity_id}
								{/if}
							</td>
							<td class="mono small">{r.collection_name}</td>
							<td class="mono small">{r.embedding_model}</td>
							<td class="num">{r.chunk_count}</td>
							<td class="mono small">{shortSha(r.source_sha)}</td>
							<td class="nowrap">
								{#if r.ingested_by && r.ingested_by_email}
									<a href="/admin/users/{r.ingested_by}">{r.ingested_by_email}</a>
								{:else if r.ingested_by}
									<span class="mono small">{r.ingested_by.slice(0, 8)}</span>
								{:else}
									<span class="muted">script</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}

	<p class="muted small note">
		Re-ingestion is a Python batch (<code>python ingest_seminars.py --reprocess</code>).
		An in-app trigger isn't wired up yet.
	</p>
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
	.summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.6rem;
	}
	.card {
		padding: 0.85rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 4px;
	}
	.card-value {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.6rem;
		color: var(--text);
		line-height: 1;
	}
	.card-value.small {
		font-size: 1rem;
	}
	.card-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-top: 0.3rem;
	}
	.filters {
		display: flex;
		gap: 0.4rem;
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
		font-size: 0.85rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem 0.5rem;
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
	.nowrap {
		white-space: nowrap;
	}
	.mono {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
	}
	.small {
		font-size: 0.78rem;
	}
	td a {
		color: var(--accent);
		text-decoration: none;
	}
	td a:hover {
		text-decoration: underline;
	}
	.kind {
		display: inline-block;
		padding: 0.1rem 0.5rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		border-radius: 999px;
	}
	.kind-seminar {
		background: #cfe2db;
		color: #2b5e51;
	}
	.kind-book {
		background: #f4e8c8;
		color: #7a5e1f;
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.error {
		color: #9c2a2a;
	}
	.note {
		margin-top: 0.5rem;
		font-style: italic;
	}
	time {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
</style>
