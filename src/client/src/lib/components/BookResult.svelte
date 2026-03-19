<script lang="ts">
	import type { BookResult } from '$lib/api';

	let { result }: { result: BookResult } = $props();
</script>

<article class="result-card book-card">
	<p class="result-content">{result.content}</p>
	<footer class="result-meta">
		{#if result.work}
			<span class="meta-tag work"><em>{result.work}</em></span>
		{/if}
		{#if result.page}
			<span class="meta-tag">p. {result.page_label || result.page}</span>
		{/if}
		{#if result.chapter}
			<span class="meta-tag">{result.chapter}</span>
		{/if}
		{#if result.score != null}
			<span class="meta-tag score">{result.score.toFixed(3)}</span>
		{/if}
	</footer>
</article>

<style>
	.result-card {
		background: var(--surface);
		border-radius: 6px;
		padding: 1.5rem 1.75rem;
		border-left: 3px solid var(--book-accent);
		margin-bottom: 1rem;
		transition: box-shadow 0.2s;
	}

	.result-card:hover {
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
	}

	.result-content {
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.1rem;
		line-height: 1.75;
		color: var(--text);
		margin-bottom: 1rem;
	}

	.result-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-light);
	}

	.meta-tag {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.8rem;
		color: var(--text-muted);
		letter-spacing: 0.02em;
	}

	.meta-tag.work {
		color: var(--book-accent);
		font-weight: 500;
	}

	.meta-tag.score {
		margin-left: auto;
		opacity: 0.5;
		font-variant-numeric: tabular-nums;
	}
</style>
