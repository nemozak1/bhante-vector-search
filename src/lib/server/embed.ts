import OpenAI from 'openai';
import { env } from './env.ts';

let _client: OpenAI | null = null;

function client(): OpenAI {
	if (_client) return _client;
	_client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	return _client;
}

export async function embed(text: string): Promise<number[]> {
	const res = await client().embeddings.create({
		model: env.EMBEDDING_MODEL,
		input: text
	});
	return res.data[0].embedding;
}

/**
 * Shorten a text-embedding-3 vector to `dims` by truncating and L2-normalising,
 * the same shortening ingest_seminars.py applies before storing seminar chunks.
 */
export function shorten(vec: number[], dims: number): number[] {
	const head = vec.slice(0, dims);
	const norm = Math.sqrt(head.reduce((sum, x) => sum + x * x, 0));
	return head.map((x) => x / norm);
}
