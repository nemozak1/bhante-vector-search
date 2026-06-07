<script lang="ts">
	import { page } from '$app/state';
	import { MessageCircleQuestion, X, Camera, Loader2, Check } from '@lucide/svelte';
	import * as feedbackRemote from '../../../routes/feedback.remote';
	import { getRecentErrors } from './console-buffer';
	import type { FeedbackCategory } from '$lib/types';

	type Props = {
		user: { id: string; email: string; name?: string };
	};

	let { user }: Props = $props();

	type Stage = 'idle' | 'capturing' | 'submitting' | 'success' | 'error';

	let isOpen = $state(false);
	let stage: Stage = $state('idle');
	let errorMessage = $state('');
	let category: FeedbackCategory = $state('bug');
	let message = $state('');
	let screenshot = $state<{ dataUrl: string; blob: Blob } | null>(null);

	const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
		{ value: 'bug', label: 'Bug' },
		{ value: 'seminar_misformatting', label: 'Seminar — misformatting' },
		{ value: 'seminar_correction', label: 'Seminar — correction' },
		{ value: 'search_quality', label: 'Search quality' },
		{ value: 'feature', label: 'Feature request' },
		{ value: 'question', label: 'Question' },
		{ value: 'other', label: 'Other' }
	];

	const charCount = $derived(message.length);
	const messageValid = $derived(charCount >= 10 && charCount <= 5000);

	function defaultCategoryForRoute(pathname: string): FeedbackCategory {
		if (pathname.startsWith('/admin/review')) return 'seminar_misformatting';
		if (pathname.startsWith('/seminars/')) return 'seminar_correction';
		if (pathname.startsWith('/search')) return 'search_quality';
		return 'bug';
	}

	function openPanel() {
		category = defaultCategoryForRoute(page.url.pathname);
		message = '';
		screenshot = null;
		errorMessage = '';
		stage = 'idle';
		isOpen = true;
	}

	function closePanel() {
		isOpen = false;
	}

	async function captureScreenshot() {
		stage = 'capturing';
		errorMessage = '';
		isOpen = false;
		// Wait for the panel close animation to finish before capturing.
		await new Promise((r) => setTimeout(r, 350));
		try {
			const html2canvas = (await import('html2canvas')).default;
			const canvas = await html2canvas(document.body, {
				useCORS: true,
				scale: 0.5,
				logging: false,
				backgroundColor: '#f6f3ee'
			});
			const blob: Blob = await new Promise((resolve, reject) => {
				canvas.toBlob(
					(b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
					'image/png'
				);
			});
			const dataUrl = canvas.toDataURL('image/png');
			screenshot = { dataUrl, blob };
		} catch (err) {
			errorMessage = (err as Error).message ?? 'Screenshot capture failed';
		} finally {
			stage = 'idle';
			isOpen = true;
		}
	}

	function removeScreenshot() {
		screenshot = null;
	}

	async function uploadScreenshot(blob: Blob, dataUrl: string): Promise<string> {
		const presigned = await feedbackRemote.presignUpload();
		if (presigned) {
			const res = await fetch(presigned.url, {
				method: 'PUT',
				headers: { 'Content-Type': 'image/png' },
				body: blob
			});
			if (!res.ok) {
				throw new Error(`Screenshot upload failed (${res.status})`);
			}
			return presigned.key;
		}
		// R2 not configured — fall back to inline base64 data URL. The admin
		// page detects the `data:` prefix and renders the image directly.
		return dataUrl;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!messageValid) return;
		stage = 'submitting';
		errorMessage = '';
		try {
			let screenshotKey: string | null = null;
			if (screenshot) {
				screenshotKey = await uploadScreenshot(screenshot.blob, screenshot.dataUrl);
			}
			await feedbackRemote.submit({
				category,
				message,
				screenshotKey,
				context: {
					url: typeof location !== 'undefined' ? location.href : null,
					user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
					viewport: typeof window !== 'undefined'
						? { w: window.innerWidth, h: window.innerHeight }
						: null,
					app_version:
						typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
					console_errors: getRecentErrors()
				}
			});
			stage = 'success';
			setTimeout(() => {
				closePanel();
			}, 1500);
		} catch (err) {
			errorMessage = (err as Error).message ?? 'Submit failed';
			stage = 'error';
		}
	}
</script>

{#if !isOpen}
	<button
		type="button"
		class="fab"
		onclick={openPanel}
		title="Send feedback"
		aria-label="Send feedback"
	>
		<MessageCircleQuestion size={20} />
	</button>
{/if}

{#if isOpen}
	<div class="backdrop" onclick={closePanel} role="presentation"></div>
	<div class="panel" role="dialog" aria-modal="true" aria-label="Send feedback">
		<header class="panel-header">
			<h2>Send feedback</h2>
			<button type="button" class="icon-btn" onclick={closePanel} aria-label="Close">
				<X size={18} />
			</button>
		</header>

		{#if stage === 'success'}
			<div class="success">
				<Check size={32} />
				<p>Thanks — your report was sent.</p>
			</div>
		{:else}
			<form class="panel-body" onsubmit={handleSubmit}>
				<div class="row">
					<span class="label">From</span>
					<div class="readonly">{user.name ?? user.email} &lt;{user.email}&gt;</div>
				</div>

				<label class="row">
					<span>Category</span>
					<select bind:value={category}>
						{#each CATEGORY_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>

				<label class="row">
					<span>Message</span>
					<textarea
						bind:value={message}
						rows="6"
						maxlength="5000"
						placeholder="What happened? What were you expecting?"
					></textarea>
					<small class:warn={charCount > 0 && charCount < 10}>
						{charCount}/5000 (min 10)
					</small>
				</label>

				<div class="row">
					<span class="label">Screenshot (optional)</span>
					{#if screenshot}
						<div class="screenshot-preview">
							<img src={screenshot.dataUrl} alt="Screenshot preview" />
							<button
								type="button"
								class="remove-screenshot"
								onclick={removeScreenshot}
								aria-label="Remove screenshot"
							>
								<X size={14} />
							</button>
						</div>
					{:else}
						<button
							type="button"
							class="capture-btn"
							onclick={captureScreenshot}
							disabled={stage === 'capturing'}
						>
							<Camera size={16} />
							<span>{stage === 'capturing' ? 'Capturing…' : 'Capture current page'}</span>
						</button>
					{/if}
				</div>

				{#if errorMessage}
					<div class="error">{errorMessage}</div>
				{/if}

				<div class="actions">
					<button type="button" class="btn-secondary" onclick={closePanel}>Cancel</button>
					<button
						type="submit"
						class="btn-primary"
						disabled={!messageValid || stage === 'submitting'}
					>
						{#if stage === 'submitting'}
							<Loader2 size={14} class="spin" />
							<span>Sending…</span>
						{:else}
							<span>Send</span>
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>
{/if}

<style>
	.fab {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 70;
		width: 44px;
		height: 44px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--surface);
		border: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 6px 16px rgba(60, 45, 25, 0.25);
		transition: background 0.15s, transform 0.15s;
	}
	.fab:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(44, 36, 24, 0.18);
		z-index: 80;
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(420px, 100vw);
		background: var(--surface);
		border-left: 1px solid var(--border);
		box-shadow: -10px 0 30px rgba(60, 45, 25, 0.12);
		z-index: 90;
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-light);
	}
	.panel-header h2 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.25rem;
		margin: 0;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.3rem;
		border-radius: 4px;
	}
	.icon-btn:hover {
		color: var(--text);
		background: var(--border-light);
	}

	.panel-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		overflow-y: auto;
		flex: 1;
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.row > span,
	.label {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		font-weight: 600;
	}

	.readonly {
		font-size: 0.88rem;
		color: var(--text);
		padding: 0.45rem 0.6rem;
		background: var(--bg);
		border: 1px solid var(--border-light);
		border-radius: 4px;
	}

	select,
	textarea {
		font: inherit;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.45rem 0.6rem;
	}
	textarea {
		resize: vertical;
		min-height: 100px;
		line-height: 1.45;
	}
	select:focus,
	textarea:focus {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
	}

	small {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	small.warn {
		color: #b35a32;
	}

	.capture-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.8rem;
		background: var(--bg);
		border: 1px dashed var(--border);
		color: var(--text);
		border-radius: 4px;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
	}
	.capture-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.screenshot-preview {
		position: relative;
		display: inline-block;
		max-width: 100%;
	}
	.screenshot-preview img {
		max-width: 100%;
		max-height: 180px;
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.remove-screenshot {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 999px;
		background: rgba(44, 36, 24, 0.7);
		color: white;
		border: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.error {
		color: #9c2a2a;
		font-size: 0.85rem;
		padding: 0.5rem 0.7rem;
		background: #fbebe7;
		border: 1px solid #e8c8be;
		border-radius: 4px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-light);
		margin-top: auto;
	}
	.btn-primary,
	.btn-secondary {
		font: inherit;
		font-size: 0.88rem;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.btn-primary {
		background: var(--accent);
		color: var(--surface);
		border: 1px solid var(--accent);
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.btn-secondary {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border);
	}
	.btn-secondary:hover {
		color: var(--text);
		border-color: var(--accent);
	}

	.success {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
		color: var(--seminar-accent);
	}

	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
