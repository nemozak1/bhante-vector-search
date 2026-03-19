<script lang="ts">
	interface Props {
		onSearch: (query: string, k: number) => void;
		loading?: boolean;
		placeholder?: string;
		initialQuery?: string;
		initialK?: number;
	}

	let { onSearch, loading = false, placeholder = 'Search the teachings...', initialQuery = '', initialK = 5 }: Props = $props();

	let query = $state(initialQuery);
	let k = $state(initialK);

	function handleSubmit() {
		const trimmed = query.trim();
		if (trimmed && !loading) {
			onSearch(trimmed, k);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSubmit();
	}
</script>

<div class="search-bar">
	<div class="search-input-row">
		<input
			type="text"
			bind:value={query}
			onkeydown={handleKeydown}
			{placeholder}
			disabled={loading}
			class="search-input"
		/>
		<button onclick={handleSubmit} disabled={loading || !query.trim()} class="search-btn">
			{#if loading}
				<span class="spinner"></span>
			{:else}
				Search
			{/if}
		</button>
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
