<script lang="ts">
	import { goto } from '$app/navigation';
	import { scopeHref } from '$lib/searchController.svelte';
	import type { SearchScope } from '$lib/types';
	import * as historyRemote from '../../routes/search-history.remote';
	import * as savedRemote from '../../routes/saved-queries.remote';

	interface Props {
		onSearch: (query: string, k: number) => void;
		scope: SearchScope;
		loading?: boolean;
		placeholder?: string;
		query?: string;
		k?: number;
	}

	let {
		onSearch,
		scope,
		loading = false,
		placeholder = 'Search the teachings...',
		query = $bindable(''),
		k = $bindable(5)
	}: Props = $props();

	const recentQ = historyRemote.recent(15);
	const savedQ = savedRemote.list();
	let recent = $derived(recentQ.current ?? []);
	let saved = $derived(savedQ.current ?? []);

	let focused = $state(false);
	let open = $derived(focused && (recent.length > 0 || saved.length > 0));
	let isSaved = $derived(saved.some((s) => s.query === query.trim() && s.scope === scope));

	const SCOPE_LABEL: Record<SearchScope, string> = { all: 'All', books: 'Books', seminars: 'Seminars' };

	function handleSubmit() {
		const trimmed = query.trim();
		if (trimmed && !loading) onSearch(trimmed, k);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSubmit();
		else if (e.key === 'Escape') focused = false;
	}

	function onFocus() {
		focused = true;
		recentQ.refresh?.();
	}

	// Run a saved/recent item. mousedown + preventDefault keeps focus on the
	// input so the input's blur doesn't close the menu before the click lands.
	function pick(item: { query: string; scope: SearchScope }) {
		return (e: MouseEvent) => {
			e.preventDefault();
			focused = false;
			query = item.query;
			if (item.scope === scope) onSearch(item.query, k);
			else goto(`${scopeHref(item.scope)}?q=${encodeURIComponent(item.query)}&k=${k}`);
		};
	}

	async function toggleSave() {
		const q = query.trim();
		if (!q) return;
		if (isSaved) {
			const match = saved.find((s) => s.query === q && s.scope === scope);
			if (match) await savedRemote.remove(match.id);
		} else {
			await savedRemote.save({ name: q, query: q, scope, filters: null });
		}
	}

	function removeSaved(id: number) {
		return async (e: MouseEvent) => {
			e.preventDefault();
			await savedRemote.remove(id);
		};
	}
</script>

<div class="search-bar">
	<div class="search-field">
		<div class="search-input-row">
			<input
				type="text"
				bind:value={query}
				onkeydown={handleKeydown}
				onfocus={onFocus}
				onblur={() => (focused = false)}
				{placeholder}
				disabled={loading}
				class="search-input"
			/>
			<button
				type="button"
				class="save-btn"
				class:saved={isSaved}
				onclick={toggleSave}
				disabled={!query.trim()}
				title={isSaved ? 'Remove saved search' : 'Save this search'}
				aria-label={isSaved ? 'Remove saved search' : 'Save this search'}
			>
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path
						d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"
						fill={isSaved ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<button onclick={handleSubmit} disabled={loading || !query.trim()} class="search-btn">
				{#if loading}
					<span class="spinner"></span>
				{:else}
					Search
				{/if}
			</button>
		</div>

		{#if open}
			<div class="suggestions">
				{#if saved.length > 0}
					<div class="sugg-group">
						<div class="sugg-heading">Saved</div>
						{#each saved as s (s.id)}
							<div class="sugg-row">
								<button type="button" class="sugg-item" onmousedown={pick(s)}>
									<span class="sugg-q">{s.name}</span>
									<span class="sugg-scope">{SCOPE_LABEL[s.scope]}</span>
								</button>
								<button
									type="button"
									class="sugg-del"
									onmousedown={removeSaved(s.id)}
									title="Remove saved search"
									aria-label="Remove saved search"
								>✕</button>
							</div>
						{/each}
					</div>
				{/if}
				{#if recent.length > 0}
					<div class="sugg-group">
						<div class="sugg-heading">Recent</div>
						{#each recent as r (r.id)}
							<button type="button" class="sugg-item" onmousedown={pick(r)}>
								<span class="sugg-q">{r.query}</span>
								<span class="sugg-scope">{SCOPE_LABEL[r.scope]}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="search-options">
		<label>
			<span class="option-label">Results</span>
			<input type="range" min="1" max="20" bind:value={k} class="range-input" />
			<span class="option-value">{k}</span>
		</label>
	</div>
</div>

<style>
	.search-bar {
		margin-bottom: 2rem;
	}

	.search-field {
		position: relative;
	}

	.search-input-row {
		display: flex;
		gap: 0;
		border: 1.5px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		transition: border-color 0.2s;
		background: var(--surface);
	}

	.search-input-row:focus-within {
		border-color: var(--accent);
	}

	.search-input {
		flex: 1;
		padding: 0.9rem 1.2rem;
		border: none;
		background: transparent;
		font-family: 'Source Sans 3', sans-serif;
		font-size: 1.05rem;
		color: var(--text);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted);
		font-style: italic;
	}

	.save-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.85rem;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.2s;
	}

	.save-btn:hover:not(:disabled) {
		color: var(--accent);
	}

	.save-btn.saved {
		color: var(--book-accent);
	}

	.save-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.search-btn {
		padding: 0.9rem 2rem;
		background: var(--accent);
		color: var(--surface);
		border: none;
		font-family: 'Source Sans 3', sans-serif;
		font-weight: 600;
		font-size: 0.95rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		cursor: pointer;
		transition: background 0.2s;
		min-width: 110px;
	}

	.search-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.search-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinner {
		display: inline-block;
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.suggestions {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 20;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
		padding: 0.35rem;
		max-height: 360px;
		overflow-y: auto;
	}

	.sugg-group + .sugg-group {
		border-top: 1px solid var(--border-light);
		margin-top: 0.35rem;
		padding-top: 0.35rem;
	}

	.sugg-heading {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		padding: 0.3rem 0.6rem;
	}

	.sugg-row {
		display: flex;
		align-items: stretch;
	}

	.sugg-item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		text-align: left;
		background: transparent;
		border: none;
		border-radius: 4px;
		padding: 0.5rem 0.6rem;
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.9rem;
		color: var(--text);
		cursor: pointer;
		transition: background 0.15s;
		min-width: 0;
	}

	.sugg-item:hover {
		background: var(--border-light);
	}

	.sugg-q {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sugg-scope {
		flex-shrink: 0;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.sugg-del {
		flex-shrink: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		padding: 0 0.55rem;
		cursor: pointer;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}

	.sugg-del:hover {
		color: #8b3a2e;
		background: var(--border-light);
	}

	.search-options {
		margin-top: 0.75rem;
		display: flex;
		justify-content: flex-end;
	}

	.search-options label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.option-label {
		font-weight: 500;
	}

	.option-value {
		font-variant-numeric: tabular-nums;
		min-width: 1.5ch;
		text-align: right;
	}

	.range-input {
		width: 100px;
		accent-color: var(--accent);
	}
</style>
