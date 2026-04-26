<script lang="ts">
	import { page } from '$app/state';
	import { tick, onMount } from 'svelte';
	import { getSeminarTranscript, type SeminarTranscript } from '$lib/api';

	const BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8000';

	let transcript: SeminarTranscript | null = $state(null);
	let loading = $state(true);
	let error = $state('');
	let paginate = $state(true);
	let currentPage = $state(1);
	const perPage = 50;

	let code = $derived(page.params.code);
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
	let contents = $derived(transcript?.contents ?? null);

	function goToPage(p: number) {
		currentPage = p;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	/** Split a paragraph at every [N] marker so we can render <span id="page-N">. */
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

	async function jumpToPageMarker(n: number) {
		// Page markers appear inline in paragraphs; if pagination hides them,
		// turn it off so we can scroll to the anchor.
		paginate = false;
		await tick();
		const el = document.getElementById(`page-${n}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	onMount(async () => {
		try {
			transcript = await getSeminarTranscript(code);
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
	<div class="viewer" class:has-contents={contents && contents.length > 0}>
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

		<div class="layout">
			{#if contents && contents.length > 0}
				<aside class="contents">
					<h2 class="contents-title">Contents</h2>
					<ol class="contents-list">
						{#each contents as entry (entry.page)}
							<li>
								<button type="button" class="contents-link" onclick={() => jumpToPageMarker(entry.page)}>
									<span class="contents-page">{entry.page}</span>
									<span class="contents-label">{entry.label}</span>
								</button>
							</li>
						{/each}
					</ol>
				</aside>
			{/if}

			<div class="transcript">
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
											<span id="page-{part.n}" class="page-marker">{part.value}</span>
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

	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}
	.viewer.has-contents .layout {
		grid-template-columns: 220px 1fr;
		gap: 2.5rem;
	}

	.contents {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.82rem;
		align-self: start;
		position: sticky;
		top: 1rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		border-right: 1px solid var(--border-light);
		padding-right: 1rem;
	}
	.contents-title {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-bottom: 0.85rem;
	}
	.contents-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.contents-link {
		display: flex;
		gap: 0.55rem;
		width: 100%;
		text-align: left;
		font: inherit;
		color: var(--text-muted);
		background: none;
		border: none;
		padding: 0.3rem 0.4rem;
		border-radius: 3px;
		cursor: pointer;
		line-height: 1.35;
	}
	.contents-link:hover {
		color: var(--accent);
		background: var(--surface);
	}
	.contents-page {
		flex: 0 0 auto;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--seminar-accent);
		min-width: 1.6em;
		text-align: right;
	}
	.contents-label {
		flex: 1 1 auto;
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
	.page-marker {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.7rem;
		color: var(--text-muted);
		vertical-align: super;
		margin: 0 0.15em;
		scroll-margin-top: 1rem;
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

	@media (max-width: 900px) {
		.viewer.has-contents .layout {
			grid-template-columns: 1fr;
		}
		.contents {
			position: static;
			max-height: none;
			border-right: none;
			border-bottom: 1px solid var(--border-light);
			padding-right: 0;
			padding-bottom: 1rem;
			margin-bottom: 1rem;
		}
		.contents-list {
			max-height: 240px;
			overflow-y: auto;
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
			font-size: 1.05rem;
		}
	}
</style>
