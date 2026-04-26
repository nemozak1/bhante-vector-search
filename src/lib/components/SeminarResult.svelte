<script lang="ts">
	import type { SeminarResult } from '$lib/types';

	let { result }: { result: SeminarResult } = $props();

	let viewerUrl = $derived(result.seminar_code
		? `/seminars/${result.seminar_code}?highlight=${encodeURIComponent(result.content.substring(0, 80))}`
		: null);
</script>

<a href={viewerUrl} class="result-link">
	<article class="result-card seminar-card">
		{#if result.speaker}
			<div class="speaker-name">{result.speaker}</div>
		{/if}
		<p class="result-content">{result.content}</p>
		<footer class="result-meta">
			{#if result.seminar_title}
				<span class="meta-tag title">{result.seminar_title}</span>
			{/if}
			{#if result.section_heading}
				<span class="meta-tag">{result.section_heading}</span>
			{/if}
			{#if result.date}
				<span class="meta-tag">{result.date}</span>
			{/if}
			{#if result.location}
				<span class="meta-tag">{result.location}</span>
			{/if}
			{#if result.score != null}
				<span class="meta-tag score">{result.score.toFixed(3)}</span>
			{/if}
		</footer>
	</article>
</a>

<style>
	.result-link {
		text-decoration: none;
		color: inherit;
		display: block;
	}

	.result-card {
		background: var(--surface);
		border-radius: 6px;
		padding: 1.5rem 1.75rem;
		border-left: 3px solid var(--seminar-accent);
		margin-bottom: 1rem;
		transition: box-shadow 0.2s;
		cursor: pointer;
	}

	.result-card:hover {
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
	}

	.speaker-name {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--seminar-accent);
		margin-bottom: 0.5rem;
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

	.meta-tag.title {
		font-weight: 500;
		color: var(--seminar-accent);
	}

	.meta-tag.score {
		margin-left: auto;
		opacity: 0.5;
		font-variant-numeric: tabular-nums;
	}
</style>
