import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { adminEmails } from './env.ts';

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
 * Require an authenticated user whose email is in ADMIN_EMAILS. Stop-gap until
 * a proper role system lands; check the email case-insensitively.
 */
export function requireAdmin() {
	const user = requireUser();
	const allowed = adminEmails();
	if (!allowed.has(user.email.toLowerCase())) error(403, 'Admin access required');
	return user;
}
