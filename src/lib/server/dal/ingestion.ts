import { pool } from '../db/pool.ts';

export type IngestEntityKind = 'book' | 'seminar';

export type IngestionRow = {
	id: number;
	entity_kind: IngestEntityKind;
	entity_id: string;
	collection_name: string;
	embedding_model: string;
	chunk_count: number;
	source_sha: string | null;
	ingested_by: string | null;
	ingested_by_email: string | null;
	ingested_at: string;
};

export type IngestionSummary = {
	total_runs: number;
	total_chunks: number;
	unique_seminars: number;
	unique_books: number;
	last_run_at: string | null;
};

export async function listRecent(limit = 100, kind?: IngestEntityKind): Promise<IngestionRow[]> {
	const params: unknown[] = [limit];
	const where = kind ? `where il.entity_kind = $2` : '';
	if (kind) params.push(kind);
	const { rows } = await pool.query<IngestionRow>(
		`select il.id, il.entity_kind, il.entity_id, il.collection_name,
		        il.embedding_model, il.chunk_count, il.source_sha,
		        il.ingested_by, u.email as ingested_by_email,
		        il.ingested_at
		   from ingestion_log il
		   left join "user" u on u.id = il.ingested_by
		   ${where}
		  order by il.ingested_at desc
		  limit $1`,
		params
	);
	return rows;
}

export async function summary(): Promise<IngestionSummary> {
	const { rows } = await pool.query<IngestionSummary>(
		`select
		    count(*)::int as total_runs,
		    coalesce(sum(chunk_count), 0)::int as total_chunks,
		    count(distinct entity_id) filter (where entity_kind = 'seminar')::int as unique_seminars,
		    count(distinct entity_id) filter (where entity_kind = 'book')::int as unique_books,
		    max(ingested_at) as last_run_at
		   from ingestion_log`
	);
	return rows[0];
}
