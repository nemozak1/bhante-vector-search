/**
 * One-shot seed for the seminars catalog.
 *
 * Walks data/seminars/cleaned/{code}.json (preferred for the
 * agent-edited title/date/location) with raw/{code}.json as fallback,
 * and upserts one row per code into the seminars table. Re-running picks
 * up edits to the source files (each cleaned-file edit by the remote
 * agent → re-run this seed → row updated).
 *
 * Idempotent: ON CONFLICT DO UPDATE on (code).
 *
 * Usage:
 *   npm run seed:catalog
 *   npm run seed:catalog -- --code SEM001
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const DATA_ROOT = resolve(process.cwd(), 'data', 'seminars');
const CLEANED = resolve(DATA_ROOT, 'cleaned');
const RAW = resolve(DATA_ROOT, 'raw');

function parseOnlyCode(): string | null {
	const eq = process.argv.find((a) => a.startsWith('--code='));
	if (eq) return eq.split('=')[1] || null;
	const i = process.argv.indexOf('--code');
	if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
	return null;
}

type Seminar = { code: string; source: 'cleaned' | 'raw'; path: string };

async function listSeminarFiles(onlyCode: string | null): Promise<Seminar[]> {
	const seen = new Map<string, Seminar>();
	for (const dir of [CLEANED, RAW]) {
		let files: string[];
		try {
			files = await readdir(dir);
		} catch {
			continue;
		}
		const source = dir === CLEANED ? 'cleaned' : 'raw';
		for (const name of files) {
			if (!name.endsWith('.json')) continue;
			const code = name.replace(/\.json$/, '');
			if (code.endsWith('C')) continue; // contents companion, not a transcript
			if (onlyCode && code !== onlyCode) continue;
			if (seen.has(code)) continue; // prefer cleaned
			seen.set(code, { code, source, path: resolve(dir, name) });
		}
	}
	return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
}

async function seed() {
	const onlyCode = parseOnlyCode();
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		const seminars = await listSeminarFiles(onlyCode);
		if (!seminars.length) {
			console.log(onlyCode ? `no transcript file found for ${onlyCode}` : 'no seminars found');
			return;
		}
		console.log(`processing ${seminars.length} seminar(s)`);

		for (const s of seminars) {
			const data = JSON.parse(await readFile(s.path, 'utf8'));
			const title = data.title ?? '';
			const date = data.date ?? null;
			const location = data.location ?? null;
			await pool.query(
				`insert into seminars (code, title, date, location, source, updated_at)
				 values ($1, $2, $3, $4, $5, now())
				 on conflict (code) do update
				   set title    = excluded.title,
				       date     = excluded.date,
				       location = excluded.location,
				       source   = excluded.source,
				       updated_at = now()`,
				[s.code, title, date, location, s.source]
			);
		}

		const { rows } = await pool.query<{ source: string; n: string }>(
			"select source, count(*)::text as n from seminars group by source order by source"
		);
		console.log('done. seminars by source:');
		for (const r of rows) console.log(`  ${r.source}: ${r.n}`);
	} finally {
		await pool.end();
	}
}

await seed();
