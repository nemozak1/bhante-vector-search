import { pool } from '../db/pool.ts';
import type { SeminarTranscript } from '../seminars/processor.ts';

export type Seminar = {
	code: string;
	title: string;
	date: string | null;
	location: string | null;
	source: 'cleaned' | 'raw' | 'placeholder';
};

export async function list(): Promise<Seminar[]> {
	const { rows } = await pool.query<Seminar>(
		`select code, title, date, location, source
		   from seminars
		  where source <> 'placeholder'
		  order by code asc`
	);
	return rows;
}

export async function getByCode(code: string): Promise<Seminar | null> {
	const { rows } = await pool.query<Seminar>(
		`select code, title, date, location, source
		   from seminars
		  where code = $1`,
		[code]
	);
	return rows[0] ?? null;
}

/**
 * Return the full transcript (turns + metadata) stored on the seminars row.
 * Returns null when the seminar isn't catalogued or has no transcript JSONB
 * (e.g. raw-only entries that haven't been seeded with content yet).
 *
 * `turn_index` is added at read time so the call site doesn't need to compute
 * offsets — keeps the wire shape the same as the legacy filesystem loader.
 */
export async function getTranscriptByCode(code: string): Promise<SeminarTranscript | null> {
	const { rows } = await pool.query<{ transcript: SeminarTranscript | null }>(
		`select transcript from seminars where code = $1`,
		[code]
	);
	const t = rows[0]?.transcript;
	if (!t) return null;
	return {
		...t,
		turns: (t.turns ?? []).map((turn, i) => ({ ...turn, turn_index: i }))
	};
}
