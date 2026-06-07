import { error, redirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { adminEmails, env } from './env.ts';
import { hasTwoFactor, isAdmin } from './dal/users.ts';

/**
 * Resolve the authenticated user for the current request. Throws 401 if not signed in.
 * Use inside remote functions; this is the layer where future RBAC checks will live.
 */
export function requireUser() {
	const event = getRequestEvent();
	const user = event.locals.user;
	if (!user) error(401, 'Authentication required');
	return user;
}

/**
 * Require an authenticated user with the admin role. Reads is_admin from the
 * user table (set on signup or via the ADMIN_EMAILS env-var backfill at boot).
 * Returns 404 — not 403 — for non-admins so the route's existence isn't
 * confirmed.
 *
 * When ADMIN_REQUIRE_TOTP is on, admins without TOTP enrolled get a 303
 * redirect to /settings/two-factor. Pass `{ require2fa: false }` for callers
 * that shouldn't trigger the redirect (the TOTP setup page itself, command
 * handlers).
 */
export async function requireAdmin(opts: { require2fa?: boolean } = {}) {
	const user = requireUser();
	const ok = await isAdmin(user.id);
	if (!ok) {
		const allowed = adminEmails();
		if (!allowed.has(user.email.toLowerCase())) {
			error(404, 'Not found');
		}
	}

	if (env.ADMIN_REQUIRE_TOTP && opts.require2fa !== false) {
		const enrolled = await hasTwoFactor(user.id);
		if (!enrolled) {
			const event = getRequestEvent();
			const path = event.url.pathname + event.url.search;
			redirect(303, `/settings/two-factor?required=admin&redirect=${encodeURIComponent(path)}`);
		}
	}

	return user;
}
