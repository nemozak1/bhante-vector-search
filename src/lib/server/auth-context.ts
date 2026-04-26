import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

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
