import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { pool } from './server/db/pool.ts';
import { buildEventMessage } from './server/services/events.ts';

export const auth = betterAuth({
	database: pool,
	emailAndPassword: { enabled: true, autoSignIn: true },
	plugins: [sveltekitCookies(getRequestEvent)],
	user: {
		additionalFields: {
			is_admin: {
				type: 'boolean',
				required: false,
				defaultValue: false,
				input: false
			}
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: true, maxAge: 5 * 60 }
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					await buildEventMessage(
						'{user:0} signed up',
						[{ type: 'user', id: user.id, label: user.email }]
					).log('user_signed_up', user.id);
				}
			}
		},
		session: {
			create: {
				after: async (session) => {
					// Look up the user's email for a nicer label without an extra DB roundtrip
					// would require it in the session payload. Fall back to id.
					const { rows } = await pool.query<{ email: string }>(
						'select email from "user" where id = $1',
						[session.userId]
					);
					const label = rows[0]?.email ?? session.userId;
					await buildEventMessage(
						'{user:0} signed in',
						[{ type: 'user', id: session.userId, label }]
					).log('user_login', session.userId);
				}
			}
		}
	}
});

export type Session = typeof auth.$Infer.Session;
