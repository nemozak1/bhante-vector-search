import { pool } from '../db/pool.ts';

export type ContentsEntry = { ord: number; page: number; label: string };

export async function getContentsForSeminar(seminarCode: string): Promise<ContentsEntry[]> {
	const { rows } = await pool.query<ContentsEntry>(
		`select ord, page, label
		   from seminar_contents
		  where seminar_code = $1
		  order by ord asc`,
		[seminarCode]
	);
	return rows;
}
