<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const subtabs = [
		{ href: '/search', label: 'All' },
		{ href: '/search/books', label: 'Books' },
		{ href: '/search/seminars', label: 'Seminars' },
	];

	function isActive(href: string): boolean {
		if (href === '/search') return page.url.pathname === '/search';
		return page.url.pathname.startsWith(href);
	}
</script>

<nav class="subtabs">
	{#each subtabs as tab}
		<a
			href={tab.href}
			class="subtab"
			class:active={isActive(tab.href)}
		>
			{tab.label}
		</a>
	{/each}
</nav>

{@render children()}

<style>
	.subtabs {
		display: flex;
		gap: 0;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-light);
	}

	.subtab {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.8rem;
		font-weight: 500;
		text-decoration: none;
		color: var(--text-muted);
		padding: 0.45rem 1rem;
		border-bottom: 2px solid transparent;
		transition: color 0.2s, border-color 0.2s;
		letter-spacing: 0.03em;
	}

	.subtab:hover {
		color: var(--text);
	}

	.subtab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
</style>
