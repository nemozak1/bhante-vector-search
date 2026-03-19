<script lang="ts">
	import { page } from '$app/state';
	import { tick, onMount } from 'svelte';
	import { getSeminarTranscript, type SeminarTranscript } from '$lib/api';

	let transcript: SeminarTranscript | null = $state(null);
	let loading = $state(true);
	let error = $state('');

	let code = $derived(page.params.code);
	let highlight = $derived(page.url.searchParams.get('highlight') || '');

	onMount(async () => {
		try {
			transcript = await getSeminarTranscript(code);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load transcript';
		} finally {
			loading = false;
		}

		// Scroll to highlighted section after render
		if (highlight) {
			await tick();
			scrollToHighlight();
		}
	});

	function scrollToHighlight() {
		if (!highlight) return;

		const turns = document.querySelectorAll('[data-turn-index]');
		for (const el of turns) {
			const text = el.textContent || '';
			if (text.includes(highlight)) {
				el.classList.add('highlight-target');
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				return;
			}
		}

		// Fuzzy fallback: try matching first 40 chars
		const short = highlight.substring(0, 40);
		for (const el of turns) {
			const text = el.textContent || '';
			if (text.includes(short)) {
				el.classList.add('highlight-target');
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				return;
			}
		}
	}
</script>

{#if loading}
	<div class="loading">Loading transcript...</div>
{:else if error}
	<div class="error-msg">{error}</div>
{:else if transcript}
	<div class="viewer">
		<nav class="viewer-nav">
			<a href="/seminars" class="back-link">&larr; All seminars</a>
			<a
				href="https://www.freebuddhistaudio.com/texts/read?num={transcript.code}"
				target="_blank"
				rel="noopener"
				class="source-link"
			>
				View on Free Buddhist Audio &nearr;
			</a>
		</nav>

		<header class="viewer-header">
			<h1 class="viewer-title">{transcript.title}</h1>
			{#if transcript.date || transcript.location}
				<p class="viewer-subtitle">
					{#if transcript.date}{transcript.date}{/if}
					{#if transcript.date && transcript.location} &mdash; {/if}
					{#if transcript.location}{transcript.location}{/if}
				</p>
			{/if}
		</header>

		<div class="transcript">
			{#each transcript.turns as turn}
				<div
					class="turn"
					class:turn-sangharakshita={turn.speaker === 'Sangharakshita'}
					data-turn-index={turn.turn_index}
				>
					{#if turn.speaker}
						<div class="turn-speaker">{turn.speaker}</div>
					{/if}
					<div class="turn-body">
						{#each turn.paragraphs as paragraph}
							<p>{paragraph}</p>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.loading {
		text-align: center;
		padding: 4rem 0;
		color: var(--text-muted);
		font-style: italic;
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.1rem;
	}

	.error-msg {
		background: #fdf0ef;
		color: #8b3a2e;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.viewer-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.back-link, .source-link {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.85rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
	}

	.back-link:hover, .source-link:hover {
		color: var(--accent);
	}

	.source-link {
		font-size: 0.78rem;
	}

	.viewer-header {
		margin-bottom: 2.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-light);
	}

	.viewer-title {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.6rem;
		color: var(--text);
		line-height: 1.3;
		margin-bottom: 0.5rem;
	}

	.viewer-subtitle {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.88rem;
		color: var(--text-muted);
	}

	.transcript {
		max-width: 680px;
	}

	.turn {
		margin-bottom: 1.5rem;
		padding-left: 1rem;
		border-left: 2px solid transparent;
		transition: background 0.3s;
	}

	.turn-sangharakshita {
		border-left-color: var(--seminar-accent);
	}

	.turn-speaker {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--seminar-accent);
		margin-bottom: 0.3rem;
	}

	.turn-body {
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.15rem;
		line-height: 1.85;
		color: var(--text);
	}

	.turn-body p {
		margin-bottom: 0.6em;
	}

	.turn-body p:last-child {
		margin-bottom: 0;
	}

	/* Highlight animation for scroll-to-target */
	:global(.highlight-target) {
		background: rgba(139, 105, 20, 0.1);
		border-radius: 4px;
		animation: highlight-fade 4s ease-out 0.5s forwards;
	}

	@keyframes highlight-fade {
		0% { background: rgba(139, 105, 20, 0.1); }
		100% { background: transparent; }
	}

	@media (max-width: 600px) {
		.viewer-title {
			font-size: 1.3rem;
		}

		.turn {
			padding-left: 0.75rem;
		}

		.turn-body {
			font-size: 1.05rem;
		}
	}
</style>
