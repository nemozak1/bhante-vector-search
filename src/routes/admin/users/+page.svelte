<script lang="ts">
	import * as usersRemote from '../users.remote';

	const listQ = $derived(usersRemote.list());

	let filter = $state('');

	const filtered = $derived.by(() => {
		const items = listQ.current ?? [];
		if (!filter.trim()) return items;
		const q = filter.toLowerCase();
		return items.filter(
			(u) =>
				u.email.toLowerCase().includes(q) ||
				u.name.toLowerCase().includes(q) ||
				u.id.toLowerCase().includes(q)
		);
	});

	function fmtDate(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: '2-digit',
			year: 'numeric'
		});
	}
</script>

<section class="page">
	<header class="page-header">
		<h1>Users</h1>
		<input
			type="search"
			class="filter"
			placeholder="filter by email / name / id…"
			bind:value={filter}
		/>
	</header>

	{#if listQ.loading}
		<p class="muted">Loading…</p>
	{:else if listQ.error}
		<p class="error">{listQ.error.message}</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Email</th>
					<th>Name</th>
					<th>Role</th>
					<th>Joined</th>
					<th>Last seen</th>
					<th class="num">Events</th>
					<th class="num">Feedback</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as user (user.id)}
					<tr>
						<td><a class="email" href="/admin/users/{user.id}">{user.email}</a></td>
						<td>{user.name}</td>
						<td>
							{#if user.is_admin}
								<span class="role role-admin">admin</span>
							{:else}
								<span class="role role-user">user</span>
							{/if}
						</td>
						<td class="nowrap">{fmtDate(user.created_at)}</td>
						<td class="nowrap">{fmtDate(user.last_seen)}</td>
						<td class="num">{user.event_count}</td>
						<td class="num">{user.feedback_count}</td>
					</tr>
				{/each}
				{#if filtered.length === 0}
					<tr>
						<td colspan="7" class="muted center">No users match.</td>
					</tr>
				{/if}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.page-header h1 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.6rem;
		margin: 0;
	}
	.filter {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.6rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		min-width: 280px;
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
	}
	th {
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
	}
	.num {
		text-align: right;
	}
	.center {
		text-align: center;
	}
	.nowrap {
		white-space: nowrap;
	}
	.email {
		color: var(--accent);
		text-decoration: none;
	}
	.email:hover {
		text-decoration: underline;
	}
	.role {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		font-size: 0.7rem;
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
	.muted {
		color: var(--text-muted);
	}
	.error {
		color: #9c2a2a;
	}
</style>
