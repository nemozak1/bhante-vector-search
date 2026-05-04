<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { signIn, signUp } from '$lib/auth.svelte';

	const DEV_EMAIL = 'dev@bhante.local';
	const DEV_PASSWORD = 'devpassword';
	const isDev = import.meta.env.DEV;

	let email = $state('');
	let password = $state('');
	let mode: 'signin' | 'signup' = $state('signin');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let info = $state<string | null>(null);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		info = null;
		try {
			if (mode === 'signin') {
				await signIn(email, password);
				const redirect = page.url.searchParams.get('redirect') ?? '/search';
				goto(redirect);
			} else {
				await signUp(email, password);
				// autoSignIn: true sets the session cookie; the layout's auth
				// gate will pick it up on the next page. No email verification
				// is wired up — there's nothing to confirm.
				goto('/search');
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function devLogin() {
		loading = true;
		error = null;
		info = null;
		try {
			await signIn(DEV_EMAIL, DEV_PASSWORD);
			const redirect = page.url.searchParams.get('redirect') ?? '/search';
			goto(redirect);
		} catch (e) {
			error =
				(e instanceof Error ? e.message : String(e)) +
				' — run `npm run seed:dev` to create the dev account.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-wrap">
	<h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>

	{#if isDev}
		<button type="button" class="dev-login" disabled={loading} onclick={devLogin}>
			<span class="dev-tag">dev</span>
			Sign in as {DEV_EMAIL}
		</button>
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
	.dev-tag {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		background: var(--seminar-accent);
		color: white;
		padding: 0.12rem 0.4rem;
		border-radius: 3px;
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
