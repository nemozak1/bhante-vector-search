import { pool } from '../db/pool.ts';

export type SearchScope = 'all' | 'books' | 'seminars';

export type HistoryRow = {
	id: number;
	query: string;
	scope: SearchScope;
	filters: unknown;
	result_count: number;
	created_at: string;
};

export async function recordSearch(
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

export async function recentSearches(userId: string, limit = 50): Promise<HistoryRow[]> {
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
