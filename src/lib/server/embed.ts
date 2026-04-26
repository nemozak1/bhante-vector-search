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
