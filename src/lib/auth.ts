import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { pool } from './server/db/pool.ts';

export const auth = betterAuth({
	database: pool,
	emailAndPassword: { enabled: true, autoSignIn: true },
	plugins: [sveltekitCookies(getRequestEvent)],
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: true, maxAge: 5 * 60 }
	}
});

export type Session = typeof auth.$Infer.Session;
