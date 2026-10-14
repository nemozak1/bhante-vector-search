import { pool } from '../db/pool.ts';

/** Embedding size of seminar_chunks.embedding (see migrations/0012_seminar_chunks.sql). */
export const SEMINAR_CHUNK_DIMS = 1536;

export type SeminarChunkHit = {
	id: string;
	seminar_code: string;
	turn_start: number;
	turn_end: number;
	speakers: string[];
	document: string;
	seminar_title: string | null;
	date: string | null;
	location: string | null;
	distance: number;
};

export async function searchByEmbedding(
	queryEmbedding: number[],
	k: number
): Promise<SeminarChunkHit[]> {
	const client = await pool.connect();
	try {
		await client.query('begin');
		// An HNSW scan returns at most hnsw.ef_search rows (default 40), so raise
		// it when asking for more candidates than that.
		await client.query(`select set_config('hnsw.ef_search', $1, true)`, [String(Math.max(40, k))]);
		const { rows } = await client.query<SeminarChunkHit>(
			`with hits as (
			   select id, seminar_code, turn_start, turn_end, speakers, document,
			          embedding <=> $1::vector(1536) as distance
			     from seminar_chunks
			    order by embedding <=> $1::vector(1536)
			    limit $2
			 )
			 select h.*, s.title as seminar_title, s.date, s.location
			   from hits h
			   left join seminars s on s.code = h.seminar_code
			  order by h.distance`,
			[`[${queryEmbedding.join(',')}]`, k]
		);
		await client.query('commit');
		return rows;
	} catch (err) {
		await client.query('rollback');
		throw err;
	} finally {
		client.release();
	}
}
