<script lang="ts">
	import { page } from '$app/state';
	import * as usersRemote from '../../users.remote';
	import EventChip from '$lib/components/events/EventChip.svelte';
	import MessageRenderer from '$lib/components/events/MessageRenderer.svelte';
	import { getEventTypeConfig, type EventColor } from '$lib/options/config/event-type-colors';
	import type { EventLevel } from '$lib/server/db/types/system-events';

	const id = $derived(page.params.id as string);
	const detailQ = $derived(usersRemote.get(id));

	const LEVEL_COLOR: Record<EventLevel, EventColor> = {
		debug: 'gray',
		info: 'blue',
		warning: 'amber',
		error: 'red'
	};

	let saving = $state(false);
	let saveError = $state('');

	async function toggleAdmin(currentIsAdmin: boolean) {
		const verb = currentIsAdmin ? 'demote' : 'promote';
		if (!confirm(`Are you sure you want to ${verb} this user?`)) return;
		saving = true;
		saveError = '';
		try {
			await usersRemote.setAdmin({ id, isAdmin: !currentIsAdmin });
		} catch (e) {
			saveError = (e as Error).message ?? `${verb} failed`;
		} finally {
			saving = false;
		}
	}

	function fmtDateTime(iso: string | null): string {
		return iso ? new Date(iso).toLocaleString() : '—';
	}
	function fmtDate(iso: string | null): string {
		return iso ? new Date(iso).toLocaleDateString() : '—';
	}
</script>

<section class="page">
	<div class="breadcrumb">
		<a href="/admin/users">Users</a>
		<span class="sep">/</span>
		<span>{id.slice(0, 8)}…</span>
	</div>

	{#if detailQ.loading}
		<p class="muted">Loading…</p>
	{:else if detailQ.error}
		<p class="error">{detailQ.error.message}</p>
	{:else if detailQ.current}
		{@const u = detailQ.current.detail}
		{@const a = detailQ.current.activity}

		<header class="user-head">
			<div>
				<h1>{u.email}</h1>
				<p class="subtitle">{u.name}</p>
			</div>
			<div class="role-actions">
				{#if u.is_admin}
					<span class="role role-admin">admin</span>
				{:else}
					<span class="role role-user">user</span>
				{/if}
				<button
					type="button"
					class="role-btn"
					disabled={saving}
					onclick={() => toggleAdmin(u.is_admin)}
				>
					{u.is_admin ? 'Demote to user' : 'Promote to admin'}
				</button>
			</div>
		</header>

		{#if saveError}
			<p class="error">{saveError}</p>
		{/if}

		<div class="meta-grid">
			<div><span class="label">ID</span><span class="mono small">{u.id}</span></div>
			<div><span class="label">Verified</span><span>{u.email_verified ? 'yes' : 'no'}</span></div>
			<div><span class="label">Joined</span><span>{fmtDate(u.created_at)}</span></div>
			<div><span class="label">Updated</span><span>{fmtDate(u.updated_at)}</span></div>
			<div><span class="label">Active sessions</span><span>{u.session_count}</span></div>
			<div><span class="label">Last seen</span><span>{fmtDateTime(u.last_seen)}</span></div>
			<div><span class="label">Last login event</span><span>{fmtDateTime(a.last_login)}</span></div>
			<div><span class="label">Searches</span><span>{a.search_count}</span></div>
			<div>
				<span class="label">Feedback</span>
				<span>
					{#if a.feedback_count > 0}
						<a href="/admin/feedback?actor={u.id}">{a.feedback_count}</a>
					{:else}
						0
					{/if}
				</span>
			</div>
		</div>

		<div class="block">
			<h3>Recent activity ({a.recent_events.length})</h3>
			{#if a.recent_events.length === 0}
				<p class="muted">No activity recorded.</p>
			{:else}
				<table class="events">
					<thead>
						<tr>
							<th>When</th>
							<th>Type</th>
							<th>Level</th>
							<th>Message</th>
						</tr>
					</thead>
					<tbody>
						{#each a.recent_events as e (e.id)}
							<tr>
								<td class="nowrap">
									<time datetime={e.created_at}>{new Date(e.created_at).toLocaleString()}</time>
								</td>
								<td>
									<EventChip
										color={getEventTypeConfig(e.type).color}
										label={e.type}
										mono
										minWidth="5rem"
									/>
								</td>
								<td><EventChip color={LEVEL_COLOR[e.level]} label={e.level} /></td>
								<td><MessageRenderer message={e.message} metadata={e.metadata} /></td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="muted small">
					Showing the {a.recent_events.length} most recent. Older entries: see
					<a href="/admin/events?q={u.email}">all events for this user</a>.
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
	.breadcrumb {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.breadcrumb a {
		color: var(--accent);
		text-decoration: none;
	}
	.sep {
		margin: 0 0.4rem;
	}
	.user-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.user-head h1 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.6rem;
		margin: 0;
	}
	.subtitle {
		color: var(--text-muted);
		margin: 0.2rem 0 0;
	}
	.role-actions {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.role {
		display: inline-block;
		padding: 0.18rem 0.6rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		border-radius: 999px;
	}
	.role-admin {
		background: #f1e7fb;
		color: #5c2f8a;
	}
	.role-user {
		background: var(--border-light);
		color: var(--text-muted);
	}
	.role-btn {
		font: inherit;
		font-size: 0.82rem;
		padding: 0.35rem 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
	}
	.role-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}
	.role-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.5rem 1rem;
		padding: 1rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 4px;
	}
	.meta-grid > div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.88rem;
	}
	.label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 600;
	}
	.mono {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
	}
	.mono.small {
		font-size: 0.78rem;
		word-break: break-all;
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
	table.events {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	table.events th,
	table.events td {
		text-align: left;
		padding: 0.5rem 0.5rem;
		border-bottom: 1px solid var(--border-light);
	}
	table.events th {
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
	}
	.nowrap {
		white-space: nowrap;
	}
	time {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.muted.small {
		font-size: 0.78rem;
		margin: 0.5rem 0 0;
	}
	.error {
		color: #9c2a2a;
		font-size: 0.85rem;
	}
</style>
