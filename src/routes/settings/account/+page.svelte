<script lang="ts">
	import { enhance } from '$app/forms';
	import { ShieldCheck, ShieldOff, TriangleAlert } from '@lucide/svelte';

	let { data, form } = $props<{
		data: {
			profile: { id: string; name: string; email: string; two_factor_enabled: boolean };
		};
		form?: { section: string; success?: string; error?: string };
	}>();

	let name = $state(data.profile.name);
	let email = $state(data.profile.email);
	let deleteConfirmation = $state('');
	let deletePassword = $state('');
	let submitting = $state(false);

	function isSection(s: string) {
		return form?.section === s;
	}
</script>

<section class="page">
	<header class="page-header">
		<h1>Account</h1>
	</header>

	<!-- Profile -->
	<form
		method="POST"
		action="?/profile"
		class="card"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update({ reset: false });
			};
		}}
	>
		<div class="card-head">
			<h2>Profile</h2>
		</div>
		<label>
			<span>Name</span>
			<input type="text" name="name" bind:value={name} required maxlength="100" />
		</label>
		{#if isSection('profile') && form?.error}
			<p class="error">{form.error}</p>
		{:else if isSection('profile') && form?.success}
			<p class="success">{form.success}</p>
		{/if}
		<button type="submit" disabled={submitting || name === data.profile.name}>Save</button>
	</form>

	<!-- Email -->
	<form
		method="POST"
		action="?/email"
		class="card"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update({ reset: false });
			};
		}}
	>
		<div class="card-head">
			<h2>Email</h2>
		</div>
		<label>
			<span>Email address</span>
			<input type="email" name="email" bind:value={email} required />
		</label>
		<p class="hint">
			Your email is used to sign in. Changing it doesn't sign you out.
		</p>
		{#if isSection('email') && form?.error}
			<p class="error">{form.error}</p>
		{:else if isSection('email') && form?.success}
			<p class="success">{form.success}</p>
		{/if}
		<button type="submit" disabled={submitting || email === data.profile.email}>Save</button>
	</form>

	<!-- Password -->
	<form
		method="POST"
		action="?/password"
		class="card"
		use:enhance={() => {
			submitting = true;
			return async ({ update, formElement }) => {
				submitting = false;
				await update({ reset: false });
				formElement.reset();
			};
		}}
	>
		<div class="card-head">
			<h2>Password</h2>
		</div>
		<label>
			<span>Current password</span>
			<input
				type="password"
				name="currentPassword"
				required
				autocomplete="current-password"
			/>
		</label>
		<label>
			<span>New password</span>
			<input
				type="password"
				name="newPassword"
				minlength="8"
				required
				autocomplete="new-password"
			/>
		</label>
		<label>
			<span>Confirm new password</span>
			<input
				type="password"
				name="confirmPassword"
				minlength="8"
				required
				autocomplete="new-password"
			/>
		</label>
		<p class="hint">Saving signs out your other sessions.</p>
		{#if isSection('password') && form?.error}
			<p class="error">{form.error}</p>
		{:else if isSection('password') && form?.success}
			<p class="success">{form.success}</p>
		{/if}
		<button type="submit" disabled={submitting}>Update password</button>
	</form>

	<!-- 2FA -->
	<div class="card">
		<div class="card-head">
			<h2>Two-factor authentication</h2>
			{#if data.profile.two_factor_enabled}
				<span class="badge badge-on"><ShieldCheck size={12} /> Enabled</span>
			{:else}
				<span class="badge badge-off"><ShieldOff size={12} /> Off</span>
			{/if}
		</div>
		<p class="hint">
			{#if data.profile.two_factor_enabled}
				Two-factor is enabled. You can disable it or reset your backup codes from the
				dedicated page.
			{:else}
				Add a second factor on sign-in via an authenticator app. Strongly recommended;
				required for admin accounts in production.
			{/if}
		</p>
		<a class="link-btn" href="/settings/two-factor">
			{data.profile.two_factor_enabled ? 'Manage two-factor' : 'Enable two-factor'}
		</a>
	</div>

	<!-- Danger zone -->
	<form
		method="POST"
		action="?/deleteAccount"
		class="card danger"
		use:enhance={({ cancel }) => {
			if (!confirm('Permanently delete your account and all personal data? This cannot be undone.')) {
				cancel();
				return;
			}
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update({ reset: false });
			};
		}}
	>
		<div class="card-head">
			<h2><TriangleAlert size={16} /> Delete account</h2>
		</div>
		<p class="hint">
			Removes your account, sessions, bookmarks, search history, and saved queries. Feedback
			you submitted stays but is anonymised (your email is replaced with
			<code>[deleted user]</code>). Activity log entries are kept for audit but no longer
			linked to you.
		</p>
		<label>
			<span>Password</span>
			<input
				type="password"
				name="password"
				bind:value={deletePassword}
				required
				autocomplete="current-password"
			/>
		</label>
		<label>
			<span>Type <code>DELETE</code> to confirm</span>
			<input type="text" name="confirmation" bind:value={deleteConfirmation} required />
		</label>
		{#if isSection('delete') && form?.error}
			<p class="error">{form.error}</p>
		{/if}
		<button
			type="submit"
			class="danger-btn"
			disabled={submitting || deleteConfirmation !== 'DELETE' || !deletePassword}
		>
			Delete my account
		</button>
	</form>
</section>

<style>
	.page {
		max-width: 640px;
		margin: 1rem auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.page-header h1 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.6rem;
		margin: 0 0 0.5rem;
	}
	.card {
		padding: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.card.danger {
		border-color: #e8c8be;
		background: #fbf3f0;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}
	.card-head h2 {
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.15rem;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.card.danger .card-head h2 {
		color: #9c2a2a;
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
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
	}
	input:focus {
		outline: none;
		border-color: var(--accent);
	}
	button {
		font: inherit;
		font-size: 0.88rem;
		padding: 0.55rem 1rem;
		background: var(--accent);
		color: var(--surface);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		align-self: flex-start;
	}
	button:hover:not(:disabled) {
		background: var(--accent-hover);
	}
	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.danger-btn {
		background: #9c2a2a;
	}
	.danger-btn:hover:not(:disabled) {
		background: #7e1f1f;
	}
	.link-btn {
		font-size: 0.88rem;
		padding: 0.55rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text);
		text-decoration: none;
		align-self: flex-start;
	}
	.link-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.55rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		border-radius: 999px;
	}
	.badge-on {
		background: #eef7f1;
		color: #1f6c3a;
	}
	.badge-off {
		background: var(--border-light);
		color: var(--text-muted);
	}
	.hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.5;
	}
	.error {
		color: #9c2a2a;
		font-size: 0.85rem;
		padding: 0.5rem 0.65rem;
		background: #fbebe7;
		border: 1px solid #e8c8be;
		border-radius: 4px;
		margin: 0;
	}
	.success {
		color: #1f6c3a;
		font-size: 0.85rem;
		padding: 0.5rem 0.65rem;
		background: #eef7f1;
		border: 1px solid #bce0c6;
		border-radius: 4px;
		margin: 0;
	}
	code {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.85em;
		background: var(--bg);
		padding: 0 0.25rem;
		border-radius: 2px;
	}
</style>
