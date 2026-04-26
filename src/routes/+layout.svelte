<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { auth, signOut } from '$lib/auth.svelte';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ href: '/search', label: 'Search' },
		{ href: '/seminars', label: 'Seminars' },
		{ href: '/review', label: 'Review' },
	];

	function isActive(href: string): boolean {
		return page.url.pathname.startsWith(href);
	}

	const PUBLIC_ROUTES = ['/login'];

	function isPublicRoute(path: string): boolean {
		return PUBLIC_ROUTES.some((p) => path === p || path.startsWith(p + '/'));
	}

	// Redirect unauthenticated users to /login (once auth state has loaded).
	$effect(() => {
		if (auth.loading) return;
		const path = page.url.pathname;
		if (!auth.user && !isPublicRoute(path)) {
			const redirect = encodeURIComponent(path + page.url.search);
			goto(`/login?redirect=${redirect}`, { replaceState: true });
		}
	});

	async function handleSignOut() {
		await signOut();
		goto('/login');
	}
</script>

<div class="app">
	<header>
		<div class="header-inner">
			<div class="brand">
				<h1 class="title">Sangharakshita</h1>
				<span class="subtitle">Semantic Search</span>
			</div>
			<nav class="tabs">
				{#each tabs as tab}
					<a
						href={tab.href}
						class="tab"
						class:active={isActive(tab.href)}
					>
						{tab.label}
					</a>
				{/each}
				{#if auth.user}
					<div class="user-menu">
						<span class="user-email">{auth.user.email}</span>
						<button type="button" class="signout" onclick={handleSignOut}>Sign out</button>
					</div>
				{/if}
			</nav>
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="app-footer">
		<span>Texts by Urgyen Sangharakshita</span>
	</footer>
</div>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(:root) {
		/* Warm, contemplative earth tones */
		--bg: #f6f3ee;
		--surface: #fffdf9;
		--text: #2c2418;
		--text-muted: #8c7e6a;
		--border: #d5cec2;
		--border-light: #e8e3da;
		--accent: #7a6248;
		--accent-hover: #5e4a35;
		--book-accent: #8b6914;
		--seminar-accent: #5a7247;
	}

	:global(body) {
		font-family: 'Source Sans 3', sans-serif;
		background: var(--bg);
		color: var(--text);
		line-height: 1.6;
		min-height: 100vh;
	}

	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	header {
		background: var(--surface);
		border-bottom: 1px solid var(--border-light);
	}

	.header-inner {
		max-width: 800px;
		margin: 0 auto;
		padding: 1.75rem 1.5rem 0;
	}

	.brand {
		margin-bottom: 1.25rem;
	}

	.title {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.75rem;
		color: var(--text);
		letter-spacing: -0.01em;
		line-height: 1.2;
	}

	.subtitle {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.8rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--text-muted);
		margin-top: 0.15rem;
		display: block;
	}

	.tabs {
		display: flex;
		gap: 0;
	}

	.tab {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.88rem;
		font-weight: 500;
		text-decoration: none;
		color: var(--text-muted);
		padding: 0.6rem 1.25rem;
		border-bottom: 2px solid transparent;
		transition: color 0.2s, border-color 0.2s;
		letter-spacing: 0.03em;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.user-menu {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 0.6rem;
	}

	.user-email {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.signout {
		font-family: inherit;
		font-size: 0.78rem;
		background: none;
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 0.3rem 0.7rem;
		border-radius: 3px;
		cursor: pointer;
	}

	.signout:hover {
		color: var(--text);
		border-color: var(--accent);
	}

	main {
		flex: 1;
		max-width: 800px;
		width: 100%;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	.app-footer {
		text-align: center;
		padding: 2rem 1.5rem;
		font-size: 0.78rem;
		color: var(--text-muted);
		border-top: 1px solid var(--border-light);
		margin-top: auto;
	}

	.app-footer a {
		color: var(--accent);
		text-decoration: none;
	}

	.app-footer a:hover {
		text-decoration: underline;
	}

	.sep {
		margin: 0 0.4rem;
	}

	@media (max-width: 600px) {
		.header-inner {
			padding: 1.25rem 1rem 0;
		}
		main {
			padding: 1.5rem 1rem;
		}
		.title {
			font-size: 1.4rem;
		}
	}
</style>
