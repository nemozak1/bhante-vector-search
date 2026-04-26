<script lang="ts">
	import { page } from '$app/state';
	import { tick, onMount } from 'svelte';
	import * as seminarsRemote from '../../seminars.remote';
	import type { SeminarDetail } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Plus, Minus, ArrowUp } from '@lucide/svelte';

	const BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8000';

	const FONT_MIN = 0.85;
	const FONT_MAX = 1.8;
	const FONT_STEP = 0.1;

	let transcript = $state<SeminarDetail | null>(null);
	let loading = $state(true);
	let error = $state('');
	let paginate = $state(true);
	let currentPage = $state(1);
	let fontSize = $state(1.15);
	const perPage = 50;

	function increaseFont() {
		fontSize = Math.min(FONT_MAX, Math.round((fontSize + FONT_STEP) * 100) / 100);
	}

	function decreaseFont() {
		fontSize = Math.max(FONT_MIN, Math.round((fontSize - FONT_STEP) * 100) / 100);
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	let code = $derived(page.params.code as string);
	let highlight = $derived(page.url.searchParams.get('highlight') || '');

	let totalTurns = $derived(transcript?.turns.length ?? 0);
	let totalPages = $derived(Math.max(1, Math.ceil(totalTurns / perPage)));
	let visibleTurns = $derived(
		!transcript
			? []
			: paginate
				? transcript.turns.slice((currentPage - 1) * perPage, currentPage * perPage)
				: transcript.turns
	);

	function goToPage(p: number) {
		currentPage = p;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	/** Split a paragraph at every [N] marker so we can render an inline page hint. */
	function splitOnMarkers(text: string): Array<{ kind: 'text' | 'page'; value: string; n?: number }> {
		const out: Array<{ kind: 'text' | 'page'; value: string; n?: number }> = [];
		const re = /\[(\d+)\]/g;
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) {
			if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
			out.push({ kind: 'page', value: m[0], n: parseInt(m[1], 10) });
			last = m.index + m[0].length;
		}
		if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
		return out;
	}

	onMount(async () => {
		try {
			transcript = await seminarsRemote.get(code).run();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load transcript';
		} finally {
			loading = false;
		}

		if (highlight) {
			paginate = false;
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
			<div class="export-bar">
				<a href="{BASE_URL}/api/seminars/{code}/pdf" class="export-btn" download>PDF</a>
				<a href="{BASE_URL}/api/seminars/{code}/epub" class="export-btn" download>EPUB</a>
				<a href="{BASE_URL}/api/seminars/{code}/print" class="export-btn" target="_blank" rel="noopener">Print</a>
			</div>
		</header>

		<div class="view-options">
			<label class="paginate-toggle">
				<input type="checkbox" bind:checked={paginate} />
				<span>Paginate</span>
			</label>
			{#if paginate && totalPages > 1}
				<span class="page-info">Page {currentPage} of {totalPages}</span>
			{/if}
		</div>

		<div class="transcript" style:--transcript-font-size="{fontSize}rem">
			{#each visibleTurns as turn (turn.turn_index)}
				<div
					class="turn"
					class:turn-sangharakshita={turn.speaker === 'Sangharakshita'}
					data-turn-index={turn.turn_index}
				>
					{#if turn.speaker}
						<div class="turn-speaker">{turn.speaker}</div>
					{/if}
					<div class="turn-body">
						{#each turn.paragraphs as paragraph, i (i)}
							<p>
								{#each splitOnMarkers(paragraph) as part, j (j)}
									{#if part.kind === 'page'}
										<span class="page-marker">{part.value}</span>
									{:else}
										{part.value}
									{/if}
								{/each}
							</p>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		{#if paginate && totalPages > 1}
			<nav class="pagination">
				<button class="page-btn" disabled={currentPage <= 1} onclick={() => goToPage(currentPage - 1)}>
					&larr; Prev
				</button>
				<span class="page-info">Page {currentPage} of {totalPages}</span>
				<button class="page-btn" disabled={currentPage >= totalPages} onclick={() => goToPage(currentPage + 1)}>
					Next &rarr;
				</button>
			</nav>
		{/if}

		<div
			class="fixed bottom-6 right-6 z-50 flex items-center gap-1 rounded-full bg-white/95 backdrop-blur p-1.5 shadow-lg border border-stone-200"
		>
			<Button
				variant="ghost"
				size="icon"
				onclick={decreaseFont}
				disabled={fontSize <= FONT_MIN}
				aria-label="Decrease text size"
				title="Decrease text size"
			>
				<Minus />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onclick={increaseFont}
				disabled={fontSize >= FONT_MAX}
				aria-label="Increase text size"
				title="Increase text size"
			>
				<Plus />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onclick={scrollToTop}
				aria-label="Jump to top"
				title="Jump to top"
			>
				<ArrowUp />
			</Button>
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
	.back-link {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.85rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
	}
	.back-link:hover {
		color: var(--accent);
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
	.export-bar {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}
	.export-btn {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		text-decoration: none;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.25rem 0.65rem;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.export-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
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
		font-size: var(--transcript-font-size, 1.15rem);
		line-height: 1.85;
		color: var(--text);
	}
	.turn-body p {
		margin-bottom: 0.6em;
	}
	.turn-body p:last-child {
		margin-bottom: 0;
	}
	.page-marker {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.7rem;
		color: var(--text-muted);
		vertical-align: super;
		margin: 0 0.15em;
	}

	.view-options {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.paginate-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}
	.paginate-toggle input {
		accent-color: var(--accent);
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-light);
	}
	.page-btn {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.82rem;
		background: none;
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.35rem 0.85rem;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.page-btn:hover:not(:disabled) {
		color: var(--accent);
		border-color: var(--accent);
	}
	.page-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.page-info {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	:global(.highlight-target) {
		background: rgba(139, 105, 20, 0.1);
		border-radius: 4px;
		animation: highlight-fade 4s ease-out 0.5s forwards;
	}
	@keyframes highlight-fade {
		0% {
			background: rgba(139, 105, 20, 0.1);
		}
		100% {
			background: transparent;
		}
	}

	@media (max-width: 600px) {
		.viewer-title {
			font-size: 1.3rem;
		}
		.turn {
			padding-left: 0.75rem;
		}
		.turn-body {
			font-size: var(--transcript-font-size, 1.05rem);
		}
	}
</style>
