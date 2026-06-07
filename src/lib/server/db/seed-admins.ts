import { pool } from './pool.ts';
import { adminEmails } from '../env.ts';
import { withEventSource } from '../event-context.ts';
import { buildEventMessage } from '../services/events.ts';

let ran = false;

/** Promote any user whose email is in ADMIN_EMAILS to is_admin=true. Called
 *  once per process boot from runMigrations(); idempotent (re-run is a no-op
 *  on already-admin rows). Won't demote anyone — only promotes. */
export async function seedAdminsFromEnv(): Promise<void> {
	if (ran) return;
	ran = true;

	const emails = [...adminEmails()];
	if (emails.length === 0) return;

	const { rows } = await pool.query<{ id: string; email: string }>(
		`update "user"
		    set is_admin = true
		  where lower(email) = any($1::text[]) and is_admin = false
		  returning id, email`,
		[emails]
	);

	if (rows.length === 0) return;
	console.log(`[seed-admins] promoted ${rows.length} user(s) to admin from ADMIN_EMAILS`);

	// Log each promotion under the 'system' source so the activity log shows
	// who got admin and when, even though no human triggered it.
	await withEventSource('system', async () => {
		for (const u of rows) {
			await buildEventMessage(
				'System promoted {user:0} to admin (ADMIN_EMAILS backfill)',
				[{ type: 'user', id: u.id, label: u.email }]
			).log('admin_promoted', null);
		}
	});
}
