<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { signIn, signUp, verifyTotp, verifyBackupCode } from '$lib/auth.svelte';

	const DEV_ACCOUNTS = [
		{ email: 'dev@bhante.local', password: 'devpassword', label: 'admin' },
		{ email: 'tester@bhante.local', password: 'testerpassword', label: 'tester' }
	] as const;
	const isDev = import.meta.env.DEV;

	let email = $state('');
	let password = $state('');
	let mode: 'signin' | 'signup' = $state('signin');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let info = $state<string | null>(null);

	type Stage = 'credentials' | 'totp' | 'backup';
	let stage: Stage = $state('credentials');
	let totpCode = $state('');
	let backupCode = $state('');

	function redirectTo() {
		return page.url.searchParams.get('redirect') ?? '/search';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		info = null;
		try {
			if (mode === 'signin') {
				const result = await signIn(email, password);
				if (result.status === 'totp-required') {
					stage = 'totp';
					return;
				}
				goto(redirectTo());
			} else {
				await signUp(email, password);
				goto('/search');
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function devLogin(devEmail: string, devPassword: string) {
		loading = true;
		error = null;
		info = null;
		try {
			email = devEmail;
			password = devPassword;
			const result = await signIn(devEmail, devPassword);
			if (result.status === 'totp-required') {
				stage = 'totp';
				return;
			}
			goto(redirectTo());
		} catch (e) {
			error =
				(e instanceof Error ? e.message : String(e)) +
				' — run `npm run seed:dev` to create the dev accounts.';
		} finally {
			loading = false;
		}
	}

	async function handleTotp(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		try {
			await verifyTotp(totpCode);
			goto(redirectTo());
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function handleBackup(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		try {
			await verifyBackupCode(backupCode);
			goto(redirectTo());
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-wrap">
	{#if stage === 'totp'}
		<h2>Two-factor code</h2>
		<p class="hint">Enter the 6-digit code from your authenticator app.</p>
		<form onsubmit={handleTotp}>
			<label>
				<span>Code</span>
				<input
					type="text"
					inputmode="numeric"
					maxlength="6"
					bind:value={totpCode}
					required
					autocomplete="one-time-code"
					autofocus
				/>
			</label>
			{#if error}<p class="error">{error}</p>{/if}
			<button type="submit" disabled={loading}>
				{loading ? '…' : 'Verify'}
			</button>
		</form>
		<p class="toggle">
			Lost your authenticator?
			<button type="button" class="link" onclick={() => (stage = 'backup')}>
				Use a backup code
			</button>
		</p>
	{:else if stage === 'backup'}
		<h2>Backup code</h2>
		<p class="hint">Enter one of the backup codes you saved when enrolling.</p>
		<form onsubmit={handleBackup}>
			<label>
				<span>Backup code</span>
				<input
					type="text"
					bind:value={backupCode}
					required
					autocomplete="off"
					autofocus
				/>
			</label>
			{#if error}<p class="error">{error}</p>{/if}
			<button type="submit" disabled={loading}>{loading ? '…' : 'Verify'}</button>
		</form>
		<p class="toggle">
			<button type="button" class="link" onclick={() => (stage = 'totp')}>
				Back to authenticator code
			</button>
		</p>
	{:else}
		<h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>

		{#if isDev}
			<div class="dev-buttons">
				{#each DEV_ACCOUNTS as account (account.email)}
					<button
						type="button"
						class="dev-login"
						disabled={loading}
						onclick={() => devLogin(account.email, account.password)}
					>
						<span class="dev-tag dev-tag-{account.label}">{account.label}</span>
						Sign in as {account.email}
					</button>
				{/each}
			</div>
			<div class="divider"><span>or</span></div>
		{/if}

		<form onsubmit={handleSubmit}>
			<label>
				<span>Email</span>
				<input type="email" bind:value={email} required autocomplete="email" />
			</label>
			<label>
				<span>Password</span>
				<input
					type="password"
					bind:value={password}
					required
					minlength="6"
					autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
				/>
			</label>

			{#if error}<p class="error">{error}</p>{/if}
			{#if info}<p class="info">{info}</p>{/if}

			<button type="submit" disabled={loading}>
				{loading ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
			</button>
		</form>

		<p class="toggle">
			{#if mode === 'signin'}
				No account?
				<button type="button" class="link" onclick={() => (mode = 'signup')}>Sign up</button>
			{:else}
				Already have an account?
				<button type="button" class="link" onclick={() => (mode = 'signin')}>Sign in</button>
			{/if}
		</p>
	{/if}
</div>

<style>
	.auth-wrap {
		max-width: 360px;
		margin: 3rem auto;
		padding: 2rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 6px;
	}
	h2 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.5rem;
		margin-bottom: 1.25rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	input {
		font-family: inherit;
		font-size: 1rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
	}
	input:focus {
		outline: none;
		border-color: var(--accent);
	}
	button[type='submit'] {
		font-family: inherit;
		font-size: 0.9rem;
		padding: 0.6rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		margin-top: 0.3rem;
	}
	button[type='submit']:hover:not(:disabled) {
		background: var(--accent-hover);
	}
	button[type='submit']:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.error {
		color: #a04040;
		font-size: 0.85rem;
	}
	.info {
		color: var(--seminar-accent);
		font-size: 0.85rem;
	}
	.toggle {
		margin-top: 1.25rem;
		font-size: 0.85rem;
		color: var(--text-muted);
		text-align: center;
	}
	.hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0 0 1rem;
	}
	.link {
		background: none;
		border: none;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}
	.dev-login {
		font-family: inherit;
		font-size: 0.85rem;
		width: 100%;
		padding: 0.55rem 0.75rem;
		background: var(--bg);
		color: var(--text);
		border: 1px dashed var(--border);
		border-radius: 4px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
	}
	.dev-login:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}
	.dev-login:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.dev-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.dev-tag {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: white;
		padding: 0.12rem 0.4rem;
		border-radius: 3px;
	}
	.dev-tag-admin {
		background: var(--book-accent);
	}
	.dev-tag-tester {
		background: var(--seminar-accent);
	}
	.divider {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin: 1rem 0;
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-light);
	}
</style>
