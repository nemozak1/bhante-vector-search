import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { twoFactor } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { pool } from './server/db/pool.ts';
import { buildEventMessage } from './server/services/events.ts';

export const auth = betterAuth({
	database: pool,
	emailAndPassword: { enabled: true, autoSignIn: true },
	plugins: [
		twoFactor({
			issuer: 'Bhante Sangharakshita Search'
		}),
		sveltekitCookies(getRequestEvent)
	],
	user: {
		additionalFields: {
			is_admin: {
				type: 'boolean',
				required: false,
				defaultValue: false,
				input: false
			}
		},
		// Enables auth.api.deleteUser({ body: { password } }) so users can
		// remove their own account from the settings page. Password
		// confirmation prevents drive-by deletion via a stolen session.
		deleteUser: {
			enabled: true,
			beforeDelete: async (user) => {
				// GDPR scrub: keep the feedback rows (other admins still need to
				// triage them) but clear the email so the deleted user isn't
				// identifiable. user_id is already on delete set null via FK.
				await pool.query(
					`update feedback set email_snapshot = '[deleted user]' where user_id = $1`,
					[user.id]
				);
				await buildEventMessage(
					'{user:0} deleted their account',
					[{ type: 'user', id: user.id, label: user.email }]
				).log('user_deleted', null, 'warning');
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
			},
			// Fires when a session row is deleted (sign-out, manual revoke, cleanup).
			// We can't distinguish "user-initiated" from "garbage-collected" here, but
			// in practice almost every delete is a sign-out for an alpha at this scale.
			delete: {
				after: async (session) => {
					const { rows } = await pool.query<{ email: string }>(
						'select email from "user" where id = $1',
						[session.userId]
					);
					const label = rows[0]?.email ?? session.userId;
					await buildEventMessage(
						'{user:0} signed out',
						[{ type: 'user', id: session.userId, label }]
					).log('user_logout', session.userId);
				}
			}
		}
	}
});

export type Session = typeof auth.$Infer.Session;
