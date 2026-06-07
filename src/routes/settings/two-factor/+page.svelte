<script lang="ts">
	import { page } from '$app/state';
	import { ShieldCheck, KeyRound, Copy, Check } from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';
	import { auth as authState } from '$lib/auth.svelte';

	type Stage = 'idle' | 'enrolling' | 'verify' | 'done' | 'error';

	let stage: Stage = $state('idle');
	let password = $state('');
	let totpUri = $state<string | null>(null);
	let secretValue = $state<string | null>(null);
	let backupCodes = $state<string[]>([]);
	let verifyCode = $state('');
	let errorMessage = $state('');
	let copiedCodes = $state(false);

	const enrolledQ = $derived(authState.user?.twoFactorEnabled === true);
	const isAdmin = $derived(authState.user?.is_admin === true);
	const required = $derived(page.url.searchParams.get('required') === 'admin');
	const redirectTo = $derived(page.url.searchParams.get('redirect') ?? '/admin');

	function extractSecretFromUri(uri: string): string | null {
		const m = uri.match(/secret=([A-Z2-7]+)/i);
		return m ? m[1] : null;
	}

	async function enable() {
		if (!password) {
			errorMessage = 'Password required';
			return;
		}
		stage = 'enrolling';
		errorMessage = '';
		try {
			const res = await authClient.twoFactor.enable({ password });
			if (res.error) throw new Error(res.error.message ?? 'Enable failed');
			totpUri = res.data?.totpURI ?? null;
			backupCodes = (res.data?.backupCodes ?? []) as string[];
			secretValue = totpUri ? extractSecretFromUri(totpUri) : null;
			stage = 'verify';
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
			stage = 'error';
		}
	}

	async function verify() {
		if (!verifyCode) {
			errorMessage = 'Enter the 6-digit code from your authenticator';
			return;
		}
		errorMessage = '';
		try {
			const res = await authClient.twoFactor.verifyTotp({ code: verifyCode });
			if (res.error) throw new Error(res.error.message ?? 'Verification failed');
			stage = 'done';
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
		}
	}

	async function disable() {
		if (!password) {
			errorMessage = 'Password required to disable 2FA';
			return;
		}
		errorMessage = '';
		try {
			const res = await authClient.twoFactor.disable({ password });
			if (res.error) throw new Error(res.error.message ?? 'Disable failed');
			password = '';
			location.reload();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
		}
	}

	async function copyCodes() {
		await navigator.clipboard.writeText(backupCodes.join('\n'));
		copiedCodes = true;
		setTimeout(() => (copiedCodes = false), 2000);
	}
</script>

<section class="wrap">
	<header class="head">
		<ShieldCheck size={22} />
		<h1>Two-factor authentication</h1>
	</header>

	{#if required && !enrolledQ}
		<div class="warning">
			<strong>Required for admin access.</strong>
			You need to enrol an authenticator app before you can use the admin panel.
		</div>
	{/if}

	{#if enrolledQ && stage !== 'done'}
		<div class="status enabled">
			<Check size={18} />
			Two-factor is <strong>enabled</strong> on your account.
		</div>

		<form
			class="form"
			onsubmit={(e) => {
				e.preventDefault();
				disable();
			}}
		>
			<label>
				<span>Password</span>
				<input type="password" bind:value={password} autocomplete="current-password" />
			</label>
			{#if errorMessage}<p class="error">{errorMessage}</p>{/if}
			<button type="submit" class="danger">Disable two-factor</button>
		</form>
	{:else if stage === 'idle' || stage === 'error'}
		<p class="blurb">
			Enrol an authenticator app (1Password, Authy, Google Authenticator, etc.) to add a
			second factor on sign-in.
		</p>
		<form
			class="form"
			onsubmit={(e) => {
				e.preventDefault();
				enable();
			}}
		>
			<label>
				<span>Password (re-enter to confirm)</span>
				<input
					type="password"
					bind:value={password}
					autocomplete="current-password"
					required
				/>
			</label>
			{#if errorMessage}<p class="error">{errorMessage}</p>{/if}
			<button type="submit">Enable two-factor</button>
		</form>
	{:else if stage === 'enrolling'}
		<p class="muted">Generating secret…</p>
	{:else if stage === 'verify'}
		<div class="step">
			<h3>1. Scan in your authenticator app</h3>
			{#if totpUri}
				<img
					class="qr"
					alt="TOTP QR code"
					src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(totpUri)}"
				/>
				<p class="muted small">
					Or enter the secret manually:
					<code class="secret">{secretValue}</code>
				</p>
			{/if}
		</div>

		<div class="step">
			<h3>2. Save your backup codes</h3>
			<p class="muted small">
				Each code is single-use. Store these somewhere safe — if you lose your authenticator,
				these are how you get back in.
			</p>
			<div class="backup">
				<ul>
					{#each backupCodes as code}
						<li><code>{code}</code></li>
					{/each}
				</ul>
				<button type="button" class="copy" onclick={copyCodes}>
					{#if copiedCodes}<Check size={14} />Copied{:else}<Copy size={14} />Copy all{/if}
				</button>
			</div>
		</div>

		<div class="step">
			<h3>3. Confirm with a code from your app</h3>
			<form
				class="form"
				onsubmit={(e) => {
					e.preventDefault();
					verify();
				}}
			>
				<label>
					<span>6-digit code</span>
					<input
						type="text"
						inputmode="numeric"
						maxlength="6"
						bind:value={verifyCode}
						autocomplete="one-time-code"
						required
					/>
				</label>
				{#if errorMessage}<p class="error">{errorMessage}</p>{/if}
				<button type="submit">
					<KeyRound size={14} />
					Verify
				</button>
			</form>
		</div>
	{:else if stage === 'done'}
		<div class="status enabled">
			<Check size={18} />
			Two-factor enrolled successfully.
		</div>
		{#if required && isAdmin}
			<p>
				<a class="cta" href={redirectTo}>Continue to admin →</a>
			</p>
		{/if}
	{/if}
</section>

<style>
	.wrap {
		max-width: 560px;
		margin: 2rem auto;
		padding: 1.75rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--accent);
	}
	.head h1 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.4rem;
		margin: 0;
	}
	.warning {
		padding: 0.7rem 0.85rem;
		background: #fbf2dc;
		border: 1px solid #e6d3a3;
		color: #6b4d12;
		border-radius: 4px;
		font-size: 0.88rem;
		line-height: 1.5;
	}
	.status {
		padding: 0.6rem 0.85rem;
		border-radius: 4px;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.status.enabled {
		background: #eef7f1;
		border: 1px solid #bce0c6;
		color: #1f6c3a;
	}
	.blurb {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	input {
		font: inherit;
		font-size: 1rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font: inherit;
		font-size: 0.9rem;
		padding: 0.6rem 1rem;
		background: var(--accent);
		color: var(--surface);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		align-self: flex-start;
	}
	button:hover {
		background: var(--accent-hover);
	}
	button.danger {
		background: #9c2a2a;
	}
	button.danger:hover {
		background: #7e1f1f;
	}
	.step {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--border-light);
	}
	.step h3 {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 600;
		margin: 0;
	}
	.qr {
		width: 200px;
		height: 200px;
		border: 1px solid var(--border-light);
		background: white;
		padding: 8px;
		border-radius: 4px;
	}
	.secret {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.82rem;
		background: var(--bg);
		padding: 0.15rem 0.4rem;
		border-radius: 3px;
		user-select: all;
	}
	.backup {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.backup ul {
		list-style: none;
		padding: 0.7rem 0.85rem;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.3rem;
		background: var(--bg);
		border: 1px solid var(--border-light);
		border-radius: 4px;
	}
	.backup code {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.85rem;
		user-select: all;
	}
	.copy {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		padding: 0.35rem 0.7rem;
		font-size: 0.82rem;
	}
	.copy:hover {
		border-color: var(--accent);
		background: var(--surface);
	}
	.muted {
		color: var(--text-muted);
	}
	.muted.small {
		font-size: 0.78rem;
		margin: 0;
	}
	.error {
		color: #9c2a2a;
		font-size: 0.85rem;
		margin: 0;
	}
	.cta {
		color: var(--accent);
		text-decoration: none;
		font-weight: 500;
	}
	.cta:hover {
		text-decoration: underline;
	}
</style>
