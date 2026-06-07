import { fail, redirect, type Actions } from '@sveltejs/kit';
import { auth } from '$lib/auth';
import { requireUser } from '$lib/server/auth-context.ts';
import { pool } from '$lib/server/db/pool.ts';
import { buildEventMessage } from '$lib/server/services/events.ts';

export const load = async () => {
	const user = requireUser();
	// Pull fresh profile + 2FA status so the form reflects the latest server state.
	const { rows } = await pool.query<{
		name: string;
		email: string;
		twoFactorEnabled: boolean | null;
	}>(
		`select name, email, "twoFactorEnabled" from "user" where id = $1`,
		[user.id]
	);
	const row = rows[0];
	return {
		profile: {
			id: user.id,
			name: row?.name ?? '',
			email: row?.email ?? user.email,
			two_factor_enabled: row?.twoFactorEnabled === true
		}
	};
};

export const actions: Actions = {
	profile: async (event) => {
		const user = requireUser();
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (name.length === 0 || name.length > 100) {
			return fail(400, { section: 'profile', error: 'Name must be 1–100 chars' });
		}
		try {
			await auth.api.updateUser({
				body: { name },
				headers: event.request.headers
			});
		} catch (e) {
			return fail(400, {
				section: 'profile',
				error: e instanceof Error ? e.message : 'Update failed'
			});
		}
		await buildEventMessage(
			'{user:0} updated their name',
			[{ type: 'user', id: user.id, label: user.email }]
		).log('user_account_updated', user.id);
		return { section: 'profile', success: 'Name updated' };
	},

	email: async (event) => {
		const user = requireUser();
		const form = await event.request.formData();
		const newEmail = String(form.get('email') ?? '').trim().toLowerCase();
		if (!newEmail.includes('@')) {
			return fail(400, { section: 'email', error: 'Invalid email' });
		}
		try {
			await auth.api.changeEmail({
				body: { newEmail },
				headers: event.request.headers
			});
		} catch (e) {
			return fail(400, {
				section: 'email',
				error: e instanceof Error ? e.message : 'Email change failed'
			});
		}
		await buildEventMessage(
			'{user:0} changed their email to ' + newEmail,
			[{ type: 'user', id: user.id, label: user.email }]
		).log('user_account_updated', user.id);
		return { section: 'email', success: 'Email updated' };
	},

	password: async (event) => {
		const user = requireUser();
		const form = await event.request.formData();
		const currentPassword = String(form.get('currentPassword') ?? '');
		const newPassword = String(form.get('newPassword') ?? '');
		const confirmPassword = String(form.get('confirmPassword') ?? '');
		if (newPassword.length < 8) {
			return fail(400, { section: 'password', error: 'New password must be ≥ 8 chars' });
		}
		if (newPassword !== confirmPassword) {
			return fail(400, { section: 'password', error: 'Passwords do not match' });
		}
		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions: true },
				headers: event.request.headers
			});
		} catch (e) {
			return fail(400, {
				section: 'password',
				error: e instanceof Error ? e.message : 'Password change failed'
			});
		}
		await buildEventMessage(
			'{user:0} changed their password',
			[{ type: 'user', id: user.id, label: user.email }]
		).log('user_password_changed', user.id);
		return { section: 'password', success: 'Password updated' };
	},

	deleteAccount: async (event) => {
		const user = requireUser();
		const form = await event.request.formData();
		const password = String(form.get('password') ?? '');
		const confirmation = String(form.get('confirmation') ?? '');
		if (confirmation !== 'DELETE') {
			return fail(400, {
				section: 'delete',
				error: "Type DELETE in the confirmation field to proceed"
			});
		}
		try {
			// Better Auth deletes the user row; FK cascades clean up sessions,
			// accounts, bookmarks, search_history, saved_queries, twoFactor.
			// feedback + system_events keep their rows (user_id ON DELETE SET NULL);
			// email_snapshot in feedback is scrubbed by the beforeDelete hook in lib/auth.ts.
			await auth.api.deleteUser({
				body: { password },
				headers: event.request.headers
			});
		} catch (e) {
			return fail(400, {
				section: 'delete',
				error: e instanceof Error ? e.message : 'Delete failed (wrong password?)'
			});
		}
		redirect(303, '/login?deleted=1');
	}
};
