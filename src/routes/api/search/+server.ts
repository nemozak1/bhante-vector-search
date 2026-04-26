import { error, json } from '@sveltejs/kit';
import { embed } from '$lib/server/vector/embed.ts';
import { searchBooks } from '$lib/server/vector/search.ts';
import { recordSearch } from '$lib/server/repos/search-history.ts';

type Body = { query: string; k?: number };

async function runBookSearch(query: string, k: number, userId: string | null) {
	if (!query.trim()) error(400, 'query required');
	const emb = await embed(query);
	const hits = await searchBooks(emb, k);

	const results = hits.map((h) => ({
		content: h.document,
		page: typeof h.metadata.page === 'number' ? h.metadata.page : null,
		page_label: typeof h.metadata.page_label === 'string' ? h.metadata.page_label : null,
		chapter: typeof h.metadata.chapter === 'string' ? h.metadata.chapter : null,
		work: typeof h.metadata.work === 'string' ? h.metadata.work : null,
		score: h.distance
	}));

	if (userId) recordSearch(userId, query, 'books', null, results.length).catch(() => {});

	return { query, results, total_results: results.length };
}

export const POST = async ({ request, locals }) => {
	const body = (await request.json()) as Body;
	return json(await runBookSearch(body.query, body.k ?? 5, locals.user?.id ?? null));
};

export const GET = async ({ url, locals }) => {
	const query = url.searchParams.get('query') ?? '';
	const k = Number(url.searchParams.get('k') ?? 5);
	return json(await runBookSearch(query, k, locals.user?.id ?? null));
};
