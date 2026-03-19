<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		totalResults: number;
		query: string;
		children: Snippet;
	}

	let { totalResults, query, children }: Props = $props();
</script>

<div class="result-list">
	<div class="result-header">
		<span class="result-count">{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
		<span class="result-query">for <em>"{query}"</em></span>
	</div>
	<div class="results">
		{@render children()}
	</div>
</div>

<style>
	.result-list {
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.result-header {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.85rem;
		color: var(--text-muted);
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-light);
	}

	.result-count {
		font-weight: 600;
	}

	.result-query em {
		color: var(--text);
	}
</style>
