import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { adminEmails } from './env.ts';
import { isAdmin } from './dal/users.ts';

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
 * user table (set on signup or via the ADMIN_EMAILS env-var backfill at boot,
 * see seed-admins.ts). Returns 404 — not 403 — for unauthorised so the route's
 * existence isn't confirmed to non-admins.
 */
export async function requireAdmin() {
	const user = requireUser();
	const ok = await isAdmin(user.id);
	if (!ok) {
		// Defence in depth: also accept the env-var allowlist during the
		// migration window. Removable once the admin UI can promote users
		// directly (see GH #11).
		const allowed = adminEmails();
		if (!allowed.has(user.email.toLowerCase())) {
			error(404, 'Not found');
		}
	}
	return user;
}
