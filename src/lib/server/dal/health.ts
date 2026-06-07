import { pool } from '../db/pool.ts';

export type ChunkStat = {
	collection: string;
	chunk_count: number;
	distinct_entities: number;
};

export async function chunkStats(): Promise<ChunkStat[]> {
	const { rows } = await pool.query<ChunkStat>(
		`select
		    collection,
		    count(*)::int as chunk_count,
		    count(distinct (metadata->>'seminar_code')) filter (where metadata ? 'seminar_code')::int
		      + count(distinct (metadata->>'work')) filter (where metadata ? 'work')::int as distinct_entities
		   from chunks
		  group by collection
		  order by collection`
	);
	return rows;
}

export type TableCount = { table_name: string; row_count: number };

export async function tableCounts(): Promise<TableCount[]> {
	// Approximate count via pg_class.reltuples; fast even on big tables.
	const { rows } = await pool.query<TableCount>(
		`select c.relname as table_name, c.reltuples::bigint::int as row_count
		   from pg_class c
		   join pg_namespace n on n.oid = c.relnamespace
		  where n.nspname = 'public'
		    and c.relkind = 'r'
		    and c.relname in ('user','session','feedback','system_events','ingestion_log','bookmarks',
		                     'search_history','saved_queries','seminars','seminar_contents')
		  order by c.relname`
	);
	return rows;
}

export type RecentError = {
	id: string;
	type: string;
	message: string;
	created_at: string;
};

export async function recentErrors(hours = 24, limit = 20): Promise<RecentError[]> {
	const { rows } = await pool.query<RecentError>(
		`select id::text, type, message, created_at
		   from system_events
		  where level in ('error','warning')
		    and created_at > now() - ($1 || ' hours')::interval
		  order by created_at desc
		  limit $2`,
		[String(hours), limit]
	);
	return rows;
}

export async function lastIngestion(): Promise<string | null> {
	const { rows } = await pool.query<{ max: string | null }>(
		`select max(ingested_at)::text as max from ingestion_log`
	);
	return rows[0]?.max ?? null;
}
