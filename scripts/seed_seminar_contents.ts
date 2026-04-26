/**
 * One-shot seed for the seminar_contents table.
 *
 * Walks data/seminars/raw/*C.json (and cleaned/*C.json if any), parses each
 * via parseContentsHtml, and writes the entries into seminar_contents keyed
 * by the parent seminar code (the C suffix is stripped).
 *
 * Idempotent: each run truncates that seminar's prior rows before inserting,
 * so re-running picks up edits to the source files.
 *
 * Usage:
 *   npm run seed:contents
 *   npm run seed:contents -- --code SEM001     # one seminar only
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { parseContentsHtml } from '../src/lib/server/seminars/parse-contents.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const DATA_ROOT = resolve(process.cwd(), 'data', 'seminars');
const CLEANED_DIR = resolve(DATA_ROOT, 'cleaned');
const RAW_DIR = resolve(DATA_ROOT, 'raw');

function parseOnlyCode(): string | null {
	const eq = process.argv.find((a) => a.startsWith('--code='));
	if (eq) return eq.split('=')[1] || null;
	const i = process.argv.indexOf('--code');
	if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
	return null;
}
const onlyCode = parseOnlyCode();

async function listContentsFiles(): Promise<Array<{ code: string; path: string }>> {
	const found = new Map<string, string>();
	for (const dir of [CLEANED_DIR, RAW_DIR]) {
		let names: string[];
		try {
			names = await readdir(dir);
		} catch {
			continue;
		}
		for (const name of names) {
			if (!name.endsWith('C.json')) continue;
			const code = name.replace(/C\.json$/, '');
			if (found.has(code)) continue; // prefer cleaned over raw
			found.set(code, resolve(dir, name));
		}
	}
	return [...found.entries()].map(([code, path]) => ({ code, path }));
}

async function seed() {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		const files = await listContentsFiles();
		const targets = onlyCode ? files.filter((f) => f.code === onlyCode) : files;
		if (!targets.length) {
			console.log(onlyCode ? `no contents file found for ${onlyCode}` : 'no contents files found');
			return;
		}
		console.log(`processing ${targets.length} contents file(s)`);

		let total = 0;
		for (const { code, path } of targets) {
			const data = JSON.parse(await readFile(path, 'utf8'));
			const html: string = data.content ?? '';
			const entries = html.trim() ? parseContentsHtml(html) : [];

			const client = await pool.connect();
			try {
				await client.query('begin');
				await client.query('delete from seminar_contents where seminar_code = $1', [code]);
				if (entries.length) {
					const values: unknown[] = [];
					const placeholders = entries
						.map((e, i) => {
							const base = i * 4;
							values.push(code, e.ord, e.page, e.label);
							return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
						})
						.join(',');
					await client.query(
						`insert into seminar_contents (seminar_code, ord, page, label) values ${placeholders}`,
						values
					);
				}
				await client.query('commit');
			} catch (err) {
				await client.query('rollback');
				throw err;
			} finally {
				client.release();
			}

			console.log(`  ${code}: ${entries.length} entries`);
			total += entries.length;
		}

		console.log(`\ndone. ${total} entries across ${targets.length} seminars.`);
	} finally {
		await pool.end();
	}
}

await seed();
