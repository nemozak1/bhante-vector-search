<script lang="ts">
	import { page } from '$app/state';
	import * as reviewRemote from '../../review.remote';
	import type { ReviewDiff, ReviewStatusItem } from '$lib/types';

	let code = $derived(page.params.code as string);

	let diffQ = $derived(reviewRemote.diff(code));
	let statusQ = $derived(reviewRemote.status());

	let diff: ReviewDiff | null = $derived(diffQ.current ?? null);
	let statusItem: ReviewStatusItem | null = $derived(statusQ.current?.[code] ?? null);

	function lineClass(line: string): string {
		if (line.startsWith('+++') || line.startsWith('---')) return 'diff-file';
		if (line.startsWith('@@')) return 'diff-hunk';
		if (line.startsWith('+')) return 'diff-add';
		if (line.startsWith('-')) return 'diff-del';
		return 'diff-ctx';
	}

	function linePrefix(line: string): string {
		if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) return '';
		if (line.startsWith('+') || line.startsWith('-')) return line[0];
		return ' ';
	}

	function lineContent(line: string): string {
		if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) return line;
		if (line.startsWith('+') || line.startsWith('-')) return line.slice(1);
		return line;
	}
</script>

<div class="diff-page">
	<div class="breadcrumb">
		<a href="/review">Review</a>
		<span class="sep">/</span>
		<span>{code}</span>
	</div>

	{#if diffQ.loading}
		<p class="status-msg">Computing diff...</p>
	{:else if diffQ.error}
		<div class="error-msg">{diffQ.error.message}</div>
	{:else if diff}
		<h2>{diff.title}</h2>

		<div class="meta-row">
			{#if statusItem}
				<span class="badge badge-{statusItem.status}">{statusItem.status}</span>
			{/if}
			<span class="turn-info">
				{diff.raw_turn_count} turns (raw) &rarr; {diff.cleaned_turn_count} turns (cleaned)
			</span>
			<a href="/seminars/{code}" class="view-link">View transcript</a>
		</div>

		{#if !diff.has_changes}
			<div class="no-changes">No differences between raw parse and cleaned file.</div>
		{:else}
			<div class="diff-container">
				{#each diff.diff_lines as line}
					<div class="diff-line {lineClass(line)}">
						<span class="diff-prefix">{linePrefix(line)}</span>
						<span class="diff-text">{lineContent(line)}</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if statusItem && statusItem.issues.length > 0}
			<div class="issues-section">
				<h3>Remaining issues</h3>
				<ul class="issue-list">
					{#each statusItem.issues as issue}
						<li>{issue}</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</div>

<style>
	.diff-page {
		max-width: 100%;
	}

	.breadcrumb {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin-bottom: 1rem;
	}

	.breadcrumb a {
		color: var(--accent);
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.breadcrumb .sep {
		margin: 0 0.4rem;
	}

	h2 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.4rem;
		margin-bottom: 0.5rem;
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.turn-info {
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.view-link {
		font-size: 0.82rem;
		color: var(--accent);
		text-decoration: none;
		margin-left: auto;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	.status-msg {
		text-align: center;
		color: var(--text-muted);
		padding: 3rem 0;
		font-style: italic;
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.1rem;
	}

	.error-msg {
		background: #fdf0ef;
		color: #8b3a2e;
		padding: 0.75rem 1rem;
		border-radius: 6px;
	}

	.no-changes {
		text-align: center;
		color: var(--text-muted);
		padding: 2rem 0;
		font-style: italic;
	}

	.diff-container {
		background: #1e1e1e;
		border-radius: 6px;
		padding: 0;
		overflow-x: auto;
		font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.diff-line {
		display: flex;
		padding: 0 1rem;
		white-space: pre;
		min-height: 1.5em;
	}

	.diff-prefix {
		user-select: none;
		width: 1.2em;
		flex-shrink: 0;
		text-align: center;
	}

	.diff-text {
		flex: 1;
		padding-left: 0.5rem;
	}

	.diff-ctx {
		color: #d4d4d4;
	}

	.diff-add {
		background: rgba(35, 134, 54, 0.2);
		color: #7ee787;
	}

	.diff-del {
		background: rgba(218, 54, 51, 0.2);
		color: #ffa198;
	}

	.diff-hunk {
		color: #79c0ff;
		padding-top: 0.5rem;
		padding-bottom: 0.25rem;
	}

	.diff-file {
		color: #e6e6e6;
		font-weight: 600;
		padding-top: 0.5rem;
	}

	.badge {
		display: inline-block;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.45rem;
		border-radius: 3px;
	}

	.badge-reviewed {
		background: #e8f0e4;
		color: var(--seminar-accent);
	}

	.badge-unreviewed {
		background: var(--border-light);
		color: var(--text-muted);
	}

	.badge-broken {
		background: #fdf0ef;
		color: #8b3a2e;
	}

	.issues-section {
		margin-top: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		padding: 1rem 1.25rem;
	}

	h3 {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
	}

	.issue-list {
		list-style: none;
		padding: 0;
	}

	.issue-list li {
		font-size: 0.85rem;
		padding: 0.25rem 0;
		color: var(--text-muted);
	}

	.issue-list li::before {
		content: '\2022';
		color: var(--book-accent);
		margin-right: 0.5rem;
	}

	@media (max-width: 600px) {
		.diff-container {
			font-size: 0.7rem;
			border-radius: 0;
			margin: 0 -1rem;
		}
	}
</style>
