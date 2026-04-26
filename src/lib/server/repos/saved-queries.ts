import { pool } from '../db/pool.ts';
import type { SearchScope } from './search-history.ts';

export type SavedQuery = {
	id: number;
	name: string;
	query: string;
	scope: SearchScope;
	filters: unknown;
	created_at: string;
	updated_at: string;
};

export async function listSavedQueries(userId: string): Promise<SavedQuery[]> {
	const { rows } = await pool.query<SavedQuery>(
		`select id, name, query, scope, filters, created_at, updated_at
		   from saved_queries
		  where user_id = $1
		  order by updated_at desc`,
		[userId]
	);
	return rows;
}

export async function saveQuery(
	userId: string,
	name: string,
	query: string,
	scope: SearchScope,
	filters: unknown
): Promise<SavedQuery> {
	const { rows } = await pool.query<SavedQuery>(
		`insert into saved_queries (user_id, name, query, scope, filters)
		 values ($1, $2, $3, $4, $5)
		 on conflict (user_id, name) do update
		   set query = excluded.query, scope = excluded.scope,
		       filters = excluded.filters, updated_at = now()
		 returning id, name, query, scope, filters, created_at, updated_at`,
		[userId, name, query, scope, filters ? JSON.stringify(filters) : null]
	);
	return rows[0];
}

export async function deleteSavedQuery(userId: string, id: number): Promise<boolean> {
	const { rowCount } = await pool.query('delete from saved_queries where user_id = $1 and id = $2', [userId, id]);
	return (rowCount ?? 0) > 0;
}
