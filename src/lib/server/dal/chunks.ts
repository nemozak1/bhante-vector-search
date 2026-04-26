import { pool } from '../db/pool.ts';

export type ChunkHit = {
	id: string;
	document: string;
	metadata: Record<string, unknown>;
	distance: number;
};

export async function searchByEmbedding(
	collection: string,
	queryEmbedding: number[],
	k: number
): Promise<ChunkHit[]> {
	const vec = `[${queryEmbedding.join(',')}]`;
	const { rows } = await pool.query<ChunkHit>(
		`select id,
		        document,
		        metadata,
		        embedding::halfvec(3072) <=> $1::halfvec(3072) as distance
		   from chunks
		  where collection = $2
		  order by distance
		  limit $3`,
		[vec, collection, k]
	);
	return rows;
}
