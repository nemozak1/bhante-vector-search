import { pool } from '../db/pool.ts';
import { env } from '../env.ts';

export type SearchHit = {
	id: string;
	document: string;
	metadata: Record<string, unknown>;
	distance: number;
};

async function searchCollection(
	collection: string,
	queryEmbedding: number[],
	k: number
): Promise<SearchHit[]> {
	const vec = `[${queryEmbedding.join(',')}]`;
	const { rows } = await pool.query<SearchHit>(
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

export function searchBooks(queryEmbedding: number[], k: number) {
	return searchCollection(env.BOOK_COLLECTION, queryEmbedding, k);
}

export function searchSeminars(queryEmbedding: number[], k: number) {
	return searchCollection(env.SEMINAR_COLLECTION, queryEmbedding, k);
}
