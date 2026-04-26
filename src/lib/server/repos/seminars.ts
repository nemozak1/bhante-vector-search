import { pool } from '../db/pool.ts';

export type Seminar = {
	code: string;
	title: string;
	date: string | null;
	location: string | null;
	source: 'cleaned' | 'raw' | 'placeholder';
};

export async function listSeminars(): Promise<Seminar[]> {
	const { rows } = await pool.query<Seminar>(
		`select code, title, date, location, source
		   from seminars
		  where source <> 'placeholder'
		  order by code asc`
	);
	return rows;
}

export async function getSeminar(code: string): Promise<Seminar | null> {
	const { rows } = await pool.query<Seminar>(
		`select code, title, date, location, source
		   from seminars
		  where code = $1`,
		[code]
	);
	return rows[0] ?? null;
}
