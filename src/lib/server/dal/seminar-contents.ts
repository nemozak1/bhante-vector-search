import { pool } from '../db/pool.ts';
import type { ContentsEntry } from '$lib/types';

export type { ContentsEntry };

export async function listBySeminar(seminarCode: string): Promise<ContentsEntry[]> {
	const { rows } = await pool.query<ContentsEntry>(
		`select ord, page, label
		   from seminar_contents
		  where seminar_code = $1
		  order by ord asc`,
		[seminarCode]
	);
	return rows;
}
