import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.ts';

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../migrations');

let applied = false;

export async function runMigrations(): Promise<void> {
	if (applied) return;
	applied = true;

	const client = await pool.connect();
	try {
		await client.query(`create table if not exists schema_migrations (
			version    text primary key,
			applied_at timestamptz not null default now()
		)`);

		const { rows } = await client.query<{ version: string }>('select version from schema_migrations');
		const done = new Set(rows.map((r) => r.version));

		const files = (await readdir(MIGRATIONS_DIR))
			.filter((f) => f.endsWith('.sql'))
			.sort();

		for (const file of files) {
			const version = file.replace(/\.sql$/, '');
			if (done.has(version)) continue;

			const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
			console.log(`[migrate] applying ${version}`);
			await client.query('begin');
			try {
				await client.query(sql);
				await client.query('insert into schema_migrations (version) values ($1)', [version]);
				await client.query('commit');
			} catch (err) {
				await client.query('rollback');
				throw new Error(`migration ${version} failed: ${(err as Error).message}`);
			}
		}
	} finally {
		client.release();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runMigrations()
		.then(() => {
			console.log('[migrate] done');
			return pool.end();
		})
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
