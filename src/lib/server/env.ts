import 'dotenv/config';

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

function optional(name: string, fallback: string): string {
	return process.env[name] ?? fallback;
}

function bool(name: string, fallback: boolean): boolean {
	const v = process.env[name];
	if (v === undefined) return fallback;
	return v === '1' || v.toLowerCase() === 'true';
}

function int(name: string, fallback: number): number {
	const v = process.env[name];
	if (v === undefined) return fallback;
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : fallback;
}

export const env = {
	OPENAI_API_KEY: required('OPENAI_API_KEY'),
	DATABASE_URL: required('DATABASE_URL'),
	BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
	BETTER_AUTH_URL: required('BETTER_AUTH_URL'),
	EMBEDDING_MODEL: optional('EMBEDDING_MODEL', 'text-embedding-3-large'),
	BOOK_COLLECTION: optional('BOOK_COLLECTION', 'bhante_epub_search'),
	SEMINAR_COLLECTION: optional('SEMINAR_COLLECTION', 'bhante_seminar_search'),
	VOYAGE_API_KEY: process.env.VOYAGE_API_KEY ?? '',
	RERANK_ENABLED: bool('RERANK_ENABLED', false),
	RERANK_MODEL: optional('RERANK_MODEL', 'rerank-2.5-lite'),
	RERANK_OVERFETCH: int('RERANK_OVERFETCH', 4)
};
