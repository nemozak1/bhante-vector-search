<script lang="ts">
	import type { SeminarResult } from '$lib/types';

	let { result }: { result: SeminarResult } = $props();

	// content is one 'Speaker: text' line per turn (see src/seminar_chunker.py).
	let lines = $derived(
		result.content.split('\n').map((line) => {
			const speaker = result.speakers.find((s) => line.startsWith(`${s}: `));
			return speaker
				? { speaker, text: line.slice(speaker.length + 2) }
				: { speaker: null, text: line };
		})
	);

	let viewerUrl = $derived(
		`/seminars/${result.seminar_code}?turn=${result.turn_start}&to=${result.turn_end}`
	);
</script>

<a href={viewerUrl} class="result-link">
	<article class="result-card seminar-card">
		<div class="exchange">
			{#each lines as line, i (i)}
				<p class="line" class:line-sangharakshita={line.speaker === 'Sangharakshita'}>
					{#if line.speaker}
						<span class="line-speaker">{line.speaker}</span>
					{/if}
					{line.text}
				</p>
			{/each}
		</div>
		<footer class="result-meta">
			{#if result.seminar_title}
				<span class="meta-tag title">{result.seminar_title}</span>
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

	.exchange {
		margin-bottom: 1rem;
	}

	/* Participants' turns are context; Sangharakshita's are the reading text. */
	.line {
		font-family: 'Cormorant Garamond', serif;
		font-size: 1rem;
		line-height: 1.65;
		color: var(--text-muted);
		margin: 0 0 0.5rem;
	}

	.line-sangharakshita {
		font-size: 1.1rem;
		line-height: 1.75;
		color: var(--text);
	}

	.line-speaker {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--seminar-accent);
		margin-right: 0.4rem;
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
