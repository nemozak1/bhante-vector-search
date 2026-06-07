<script lang="ts">
	import * as eventsRemote from '../events.remote';
	import EventChip from '$lib/components/events/EventChip.svelte';
	import MessageRenderer from '$lib/components/events/MessageRenderer.svelte';
	import { getEventTypeConfig, type EventColor } from '$lib/options/config/event-type-colors';
	import type { EventLevel, EventSource } from '$lib/server/db/types/system-events';

	const LEVEL_COLOR: Record<EventLevel, EventColor> = {
		debug: 'gray',
		info: 'blue',
		warning: 'amber',
		error: 'red'
	};
	const SOURCE_COLOR: Record<EventSource, EventColor> = {
		user: 'sky',
		webhook: 'purple',
		cron: 'cyan',
		system: 'gray',
		api: 'teal'
	};

	const LEVELS: Array<EventLevel | null> = [null, 'debug', 'info', 'warning', 'error'];
	const SOURCES: Array<EventSource | null> = [null, 'user', 'webhook', 'cron', 'system', 'api'];

	let level: EventLevel | null = $state(null);
	let source: EventSource | null = $state(null);
	let type: string | null = $state(null);
	let q: string = $state('');
	let page = $state(1);
	const pageSize = 50;

	const listQ = $derived(
		eventsRemote.list({
			level,
			source,
			type,
			q: q.trim() || null,
			page,
			pageSize
		})
	);
	const typesQ = $derived(eventsRemote.distinctTypes());

	function fmtDate(iso: string): string {
		const d = new Date(iso);
		return (
			d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) +
			' ' +
			d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
		);
	}

	function reset() {
		page = 1;
	}
</script>

<section class="page">
	<header class="page-header">
		<h1>Activity log</h1>
	</header>

	<div class="filters">
		<label class="filter-group">
			<span>Level</span>
			<div class="chips">
				{#each LEVELS as l (l ?? 'all')}
					<button
						type="button"
						class="chip-btn"
						class:active={level === l}
						onclick={() => {
							level = l;
							reset();
						}}
					>
						{l ?? 'all'}
					</button>
				{/each}
			</div>
		</label>

		<label class="filter-group">
			<span>Source</span>
			<div class="chips">
				{#each SOURCES as s (s ?? 'all')}
					<button
						type="button"
						class="chip-btn"
						class:active={source === s}
						onclick={() => {
							source = s;
							reset();
						}}
					>
						{s ?? 'all'}
					</button>
				{/each}
			</div>
		</label>

		<label class="filter-group grow">
			<span>Search</span>
			<input
				type="search"
				bind:value={q}
				placeholder="message or type…"
				onkeydown={(e) => {
					if (e.key === 'Enter') reset();
				}}
			/>
		</label>

		<label class="filter-group">
			<span>Type</span>
			<select bind:value={type} onchange={reset}>
				<option value={null}>all</option>
				{#if typesQ.current}
					{#each typesQ.current as t (t)}
						<option value={t}>{t}</option>
					{/each}
				{/if}
			</select>
		</label>
	</div>

	{#if listQ.loading}
		<p class="muted">Loading…</p>
	{:else if listQ.error}
		<p class="error">{listQ.error.message}</p>
	{:else if listQ.current}
		{@const data = listQ.current}
		{#if data.items.length === 0}
			<p class="muted">No events match.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>When</th>
						<th>Type</th>
						<th>Level</th>
						<th>Source</th>
						<th>Actor</th>
						<th>Message</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as item (item.id)}
						<tr>
							<td class="nowrap"><time datetime={item.created_at}>{fmtDate(item.created_at)}</time></td>
							<td>
								<EventChip
									color={getEventTypeConfig(item.type).color}
									label={item.type}
									mono
									minWidth="5rem"
								/>
							</td>
							<td><EventChip color={LEVEL_COLOR[item.level]} label={item.level} /></td>
							<td><EventChip color={SOURCE_COLOR[item.source]} label={item.source} /></td>
							<td class="nowrap">
								{#if item.actor_id && item.actor_email}
									<a class="actor-link" href="/admin/users/{item.actor_id}">
										{item.actor_email}
									</a>
								{:else}
									{item.actor_email ?? item.actor_name ?? '—'}
								{/if}
							</td>
							<td class="message">
								<MessageRenderer message={item.message} metadata={item.metadata} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="pager">
				<button type="button" disabled={page === 1} onclick={() => page--}>Prev</button>
				<span class="muted">Page {page} · {data.total} total</span>
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
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 4px;
		align-items: flex-end;
	}
	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.filter-group > span {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		font-weight: 600;
	}
	.filter-group.grow {
		flex: 1 1 200px;
	}
	.filter-group input,
	.filter-group select {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.35rem 0.55rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.chips {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}
	.chip-btn {
		font: inherit;
		font-size: 0.76rem;
		padding: 0.22rem 0.55rem;
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--text-muted);
		border-radius: 999px;
		cursor: pointer;
	}
	.chip-btn.active {
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
		vertical-align: top;
	}
	th {
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
	}
	.nowrap {
		white-space: nowrap;
	}
	.message {
		color: var(--text);
		word-break: break-word;
	}
	time {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.actor-link {
		color: var(--accent);
		text-decoration: none;
	}
	.actor-link:hover {
		text-decoration: underline;
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.error {
		color: #9c2a2a;
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
