import { pool } from './pool.ts';
import { adminEmails } from '../env.ts';

let ran = false;

/** Promote any user whose email is in ADMIN_EMAILS to is_admin=true. Called
 *  once per process boot from runMigrations(); idempotent (re-run is a no-op
 *  on already-admin rows). Won't demote anyone — only promotes. */
export async function seedAdminsFromEnv(): Promise<void> {
	if (ran) return;
	ran = true;

	const emails = [...adminEmails()];
	if (emails.length === 0) return;

	const { rowCount } = await pool.query(
		`update "user" set is_admin = true where lower(email) = any($1::text[]) and is_admin = false`,
		[emails]
	);
	if (rowCount && rowCount > 0) {
		console.log(`[seed-admins] promoted ${rowCount} user(s) to admin from ADMIN_EMAILS`);
	}
}
