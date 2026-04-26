import 'dotenv/config';

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

function optional(name: string, fallback: string): string {
	return process.env[name] ?? fallback;
}

export const env = {
	OPENAI_API_KEY: required('OPENAI_API_KEY'),
	DATABASE_URL: required('DATABASE_URL'),
	BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
	BETTER_AUTH_URL: required('BETTER_AUTH_URL'),
	EMBEDDING_MODEL: optional('EMBEDDING_MODEL', 'text-embedding-3-large'),
	BOOK_COLLECTION: optional('BOOK_COLLECTION', 'bhante_epub_search'),
	SEMINAR_COLLECTION: optional('SEMINAR_COLLECTION', 'bhante_seminar_search')
};
