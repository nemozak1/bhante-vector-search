import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import { error, type Handle } from '@sveltejs/kit';
import { runMigrations } from '$lib/server/db/migrate.ts';

let migrated = false;

const sessionResolver: Handle = async ({ event, resolve }) => {
	if (!migrated) {
		migrated = true;
		await runMigrations();
	}

	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	return svelteKitHandler({ event, resolve, auth, building });
};

const PUBLIC_API_PATHS = new Set(['/api/health']);

const apiGate: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const needsAuth =
		path.startsWith('/api/') &&
		!path.startsWith('/api/auth/') &&
		!PUBLIC_API_PATHS.has(path);

	if (needsAuth && !event.locals.user) {
		error(401, 'Authentication required');
	}

	return resolve(event);
};

export const handle = sequence(sessionResolver, apiGate);
