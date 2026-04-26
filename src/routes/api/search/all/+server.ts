import { error, json } from '@sveltejs/kit';
import { embed } from '$lib/server/vector/embed.ts';
import { searchBooks, searchSeminars, type SearchHit } from '$lib/server/vector/search.ts';
import { recordSearch } from '$lib/server/repos/search-history.ts';

type Body = { query: string; k?: number };

function bookResult(h: SearchHit) {
	return {
		content: h.document,
		content_type: 'epub' as const,
		score: h.distance,
		page: typeof h.metadata.page === 'number' ? h.metadata.page : null,
		page_label: typeof h.metadata.page_label === 'string' ? h.metadata.page_label : null,
		chapter: typeof h.metadata.chapter === 'string' ? h.metadata.chapter : null,
		work: typeof h.metadata.work === 'string' ? h.metadata.work : null
	};
}

function seminarResult(h: SearchHit) {
	return {
		content: h.document,
		content_type: 'seminar' as const,
		score: h.distance,
		seminar_title: typeof h.metadata.seminar_title === 'string' ? h.metadata.seminar_title : null,
		seminar_code: typeof h.metadata.seminar_code === 'string' ? h.metadata.seminar_code : null,
		speaker: typeof h.metadata.speaker === 'string' ? h.metadata.speaker : null,
		section_heading: typeof h.metadata.section_heading === 'string' ? h.metadata.section_heading : null,
		date: typeof h.metadata.date === 'string' ? h.metadata.date : null,
		location: typeof h.metadata.location === 'string' ? h.metadata.location : null
	};
}

async function runUnifiedSearch(query: string, k: number, userId: string | null) {
	if (!query.trim()) error(400, 'query required');
	const emb = await embed(query);
	const [books, seminars] = await Promise.all([searchBooks(emb, k), searchSeminars(emb, k)]);

	const merged = [...books.map(bookResult), ...seminars.map(seminarResult)]
		.sort((a, b) => a.score - b.score)
		.slice(0, k);

	if (userId) recordSearch(userId, query, 'all', null, merged.length).catch(() => {});

	return { query, results: merged, total_results: merged.length };
}

export const POST = async ({ request, locals }) => {
	const body = (await request.json()) as Body;
	return json(await runUnifiedSearch(body.query, body.k ?? 5, locals.user?.id ?? null));
};

export const GET = async ({ url, locals }) => {
	const query = url.searchParams.get('query') ?? '';
	const k = Number(url.searchParams.get('k') ?? 5);
	return json(await runUnifiedSearch(query, k, locals.user?.id ?? null));
};
