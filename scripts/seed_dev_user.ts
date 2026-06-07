/**
 * Idempotent dev-user seed.
 *
 * Creates two accounts for the quick-login buttons on /login:
 *   - dev@bhante.local   / devpassword     (admin, if ADMIN_EMAILS includes it)
 *   - tester@bhante.local / testerpassword (regular alpha-tester role)
 *
 * Re-runs are no-ops. Run after adding ADMIN_EMAILS to .env so the boot-time
 * admin backfill in src/lib/server/db/seed-admins.ts picks up the dev account.
 *
 * Usage:
 *   node --env-file=.env --experimental-strip-types --no-warnings scripts/seed_dev_user.ts
 *   (or: npm run seed:dev)
 */
import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

export const DEV_EMAIL = 'dev@bhante.local';
export const DEV_PASSWORD = 'devpassword';
export const DEV_NAME = 'Dev User';

export const TESTER_EMAIL = 'tester@bhante.local';
export const TESTER_PASSWORD = 'testerpassword';
export const TESTER_NAME = 'Alpha Tester';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET not set');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const auth = betterAuth({
	database: pool,
	emailAndPassword: { enabled: true, autoSignIn: false },
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
});

async function ensureUser(email: string, password: string, name: string): Promise<void> {
	const existing = await pool.query<{ id: string }>(
		'select id from "user" where email = $1',
		[email]
	);
	if (existing.rowCount && existing.rowCount > 0) {
		console.log(`✓ ${email} already exists (id=${existing.rows[0].id})`);
		return;
	}
	const res = await auth.api.signUpEmail({ body: { email, password, name } });
	console.log(`✓ created ${email} (id=${res.user.id})`);
}

await ensureUser(DEV_EMAIL, DEV_PASSWORD, DEV_NAME);
await ensureUser(TESTER_EMAIL, TESTER_PASSWORD, TESTER_NAME);

await pool.end();
