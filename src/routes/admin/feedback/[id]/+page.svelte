<script lang="ts">
	import { page } from '$app/state';
	import * as adminFeedback from '../../feedback.remote';
	import type { FeedbackStatus } from '$lib/types';

	const id = $derived(parseInt(page.params.id as string, 10));
	const detailQ = $derived(adminFeedback.get(id));

	let editStatus: FeedbackStatus | 'unset' = $state('unset');
	let editNotes = $state('');
	let saving = $state(false);
	let saveError = $state('');

	$effect(() => {
		const cur = detailQ.current;
		if (cur && editStatus === 'unset') {
			editStatus = cur.status;
			editNotes = cur.admin_notes ?? '';
		}
	});

	async function save() {
		if (editStatus === 'unset') return;
		saving = true;
		saveError = '';
		try {
			await adminFeedback.setStatus({
				id,
				status: editStatus,
				adminNotes: editNotes || null
			});
		} catch (err) {
			saveError = (err as Error).message ?? 'Save failed';
		} finally {
			saving = false;
		}
	}

	function fmtDate(iso: string | null): string {
		return iso ? new Date(iso).toLocaleString() : '—';
	}
</script>

<section class="page">
	<div class="breadcrumb">
		<a href="/admin/feedback">Feedback</a>
		<span class="sep">/</span>
		<span>#{id}</span>
	</div>

	{#if detailQ.loading}
		<p class="muted">Loading…</p>
	{:else if detailQ.error}
		<p class="error">{detailQ.error.message}</p>
	{:else if detailQ.current}
		{@const f = detailQ.current}
		<h1>{f.category}</h1>

		<div class="meta-grid">
			<div>
				<span class="label">From</span>
				<span>
					{#if f.user_id}
						<a href="/admin/users/{f.user_id}">{f.email_snapshot}</a>
					{:else}
						{f.email_snapshot}
					{/if}
				</span>
			</div>
			<div><span class="label">Submitted</span><span>{fmtDate(f.created_at)}</span></div>
			<div><span class="label">Status</span><span>{f.status}</span></div>
			<div><span class="label">Triaged</span><span>{fmtDate(f.triaged_at)}</span></div>
			<div><span class="label">URL</span><span class="mono">{f.url ?? '—'}</span></div>
			<div><span class="label">App version</span><span class="mono">{f.app_version ?? '—'}</span></div>
			<div>
				<span class="label">Viewport</span>
				<span class="mono">{f.viewport ? `${f.viewport.w}×${f.viewport.h}` : '—'}</span>
			</div>
			<div><span class="label">User agent</span><span class="mono small">{f.user_agent ?? '—'}</span></div>
		</div>

		<div class="block">
			<h3>Message</h3>
			<pre class="message">{f.message}</pre>
		</div>

		{#if f.screenshot_key}
			<div class="block">
				<h3>Screenshot</h3>
				{#if f.screenshot_url}
					<a href={f.screenshot_url} target="_blank" rel="noreferrer">
						<img src={f.screenshot_url} alt="Screenshot" class="screenshot" />
					</a>
				{:else}
					<p class="muted">
						Stored at <code>{f.screenshot_key.slice(0, 80)}…</code>
						but cannot be loaded (R2 misconfigured?).
					</p>
				{/if}
			</div>
		{/if}

		{#if f.console_errors && f.console_errors.length > 0}
			<details class="block">
				<summary><h3 style="display:inline">Console errors ({f.console_errors.length})</h3></summary>
				<ul class="errors-list">
					{#each f.console_errors as ce}
						<li>
							<span class="ts">{ce.ts}</span>
							<pre>{ce.msg}</pre>
						</li>
					{/each}
				</ul>
			</details>
		{/if}

		<div class="block triage-block">
			<h3>Triage</h3>
			<label>
				<span class="label">Status</span>
				<select bind:value={editStatus}>
					<option value="new">new</option>
					<option value="triaged">triaged</option>
					<option value="resolved">resolved</option>
					<option value="dismissed">dismissed</option>
				</select>
			</label>
			<label>
				<span class="label">Admin notes</span>
				<textarea bind:value={editNotes} rows="4" maxlength="5000" placeholder="Internal notes…"></textarea>
			</label>
			{#if saveError}
				<p class="error">{saveError}</p>
			{/if}
			<button type="button" onclick={save} disabled={saving}>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.breadcrumb {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.breadcrumb a {
		color: var(--accent);
		text-decoration: none;
	}
	.breadcrumb .sep {
		margin: 0 0.4rem;
	}
	h1 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.6rem;
		margin: 0;
		text-transform: capitalize;
	}
	h3 {
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 600;
		margin: 0 0 0.5rem;
	}
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.5rem 1rem;
		padding: 1rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 4px;
	}
	.meta-grid > div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.88rem;
	}
	.label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 600;
	}
	.mono {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.82rem;
		word-break: break-all;
	}
	.mono.small {
		font-size: 0.76rem;
	}
	.block {
		padding: 1rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 4px;
	}
	.message {
		white-space: pre-wrap;
		font-family: inherit;
		font-size: 0.9rem;
		margin: 0;
		line-height: 1.5;
	}
	.screenshot {
		max-width: 100%;
		border: 1px solid var(--border);
		border-radius: 3px;
	}
	.errors-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.errors-list li {
		border-bottom: 1px dashed var(--border-light);
		padding-bottom: 0.5rem;
	}
	.errors-list .ts {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.errors-list pre {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.triage-block {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.triage-block label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	select,
	textarea {
		font: inherit;
		padding: 0.4rem 0.55rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.triage-block button {
		align-self: flex-start;
		font: inherit;
		font-size: 0.88rem;
		padding: 0.5rem 1rem;
		background: var(--accent);
		color: var(--surface);
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
	.triage-block button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.error {
		color: #9c2a2a;
		font-size: 0.85rem;
	}
</style>
