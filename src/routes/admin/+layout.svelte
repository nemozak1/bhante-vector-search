<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	let { children }: { children: Snippet } = $props();

	const adminTabs = [
		{ href: '/admin', label: 'Overview', exact: true },
		{ href: '/admin/feedback', label: 'Feedback', exact: false },
		{ href: '/admin/review', label: 'Review', exact: false },
		{ href: '/admin/users', label: 'Users', exact: false },
		{ href: '/admin/ingestion', label: 'Ingestion', exact: false },
		{ href: '/admin/health', label: 'Health', exact: false },
		{ href: '/admin/events', label: 'Activity', exact: false }
	];

	function isActive(tab: { href: string; exact: boolean }): boolean {
		return tab.exact ? page.url.pathname === tab.href : page.url.pathname.startsWith(tab.href);
	}
</script>

<div class="admin-shell">
	<div class="admin-tabs">
		{#each adminTabs as tab (tab.href)}
			<a href={tab.href} class="admin-tab" class:active={isActive(tab)}>{tab.label}</a>
		{/each}
	</div>
	{@render children()}
</div>

<style>
	.admin-shell {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.admin-tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid var(--border-light);
	}
	.admin-tab {
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--text-muted);
		padding: 0.5rem 0.75rem;
		border-bottom: 2px solid transparent;
	}
	.admin-tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
</style>
