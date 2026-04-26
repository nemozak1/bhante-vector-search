/**
 * Idempotent dev-user seed.
 *
 * Creates dev@bhante.local / devpassword via Better Auth so the quick-login
 * button on /login has someone to sign in as. Re-runs are no-ops.
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

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET not set');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const auth = betterAuth({
	database: pool,
	emailAndPassword: { enabled: true, autoSignIn: false },
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
});

const existing = await pool.query<{ id: string }>('select id from "user" where email = $1', [DEV_EMAIL]);
if (existing.rowCount && existing.rowCount > 0) {
	console.log(`✓ ${DEV_EMAIL} already exists (id=${existing.rows[0].id})`);
} else {
	const res = await auth.api.signUpEmail({
		body: { email: DEV_EMAIL, password: DEV_PASSWORD, name: DEV_NAME }
	});
	console.log(`✓ created ${DEV_EMAIL} (id=${res.user.id})`);
}

await pool.end();
