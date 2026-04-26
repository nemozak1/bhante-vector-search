import { pool } from '../db/pool.ts';
import type { HistoryRow, SearchScope } from '$lib/types';

export type { HistoryRow, SearchScope };

export async function insert(
	userId: string,
	query: string,
	scope: SearchScope,
	filters: unknown,
	resultCount: number
): Promise<void> {
	await pool.query(
		`insert into search_history (user_id, query, scope, filters, result_count)
		 values ($1, $2, $3, $4, $5)`,
		[userId, query, scope, filters ? JSON.stringify(filters) : null, resultCount]
	);
}

export async function listRecent(userId: string, limit: number): Promise<HistoryRow[]> {
	const { rows } = await pool.query<HistoryRow>(
		`select id, query, scope, filters, result_count, created_at
		   from search_history
		  where user_id = $1
		  order by created_at desc
		  limit $2`,
		[userId, limit]
	);
	return rows;
}
