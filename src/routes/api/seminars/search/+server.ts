import { error, json } from '@sveltejs/kit';
import { embed } from '$lib/server/vector/embed.ts';
import { searchSeminars } from '$lib/server/vector/search.ts';
import { recordSearch } from '$lib/server/repos/search-history.ts';

type Body = { query: string; k?: number };

async function runSeminarSearch(query: string, k: number, userId: string | null) {
	if (!query.trim()) error(400, 'query required');
	const emb = await embed(query);
	const hits = await searchSeminars(emb, k);

	const results = hits.map((h) => ({
		content: h.document,
		seminar_title: typeof h.metadata.seminar_title === 'string' ? h.metadata.seminar_title : null,
		seminar_code: typeof h.metadata.seminar_code === 'string' ? h.metadata.seminar_code : null,
		speaker: typeof h.metadata.speaker === 'string' ? h.metadata.speaker : null,
		section_heading: typeof h.metadata.section_heading === 'string' ? h.metadata.section_heading : null,
		date: typeof h.metadata.date === 'string' ? h.metadata.date : null,
		location: typeof h.metadata.location === 'string' ? h.metadata.location : null,
		score: 1 - h.distance
	}));

	if (userId) recordSearch(userId, query, 'seminars', null, results.length).catch(() => {});

	return { query, results, total_results: results.length };
}

export const POST = async ({ request, locals }) => {
	const body = (await request.json()) as Body;
	return json(await runSeminarSearch(body.query, body.k ?? 5, locals.user?.id ?? null));
};

export const GET = async ({ url, locals }) => {
	const query = url.searchParams.get('query') ?? '';
	const k = Number(url.searchParams.get('k') ?? 5);
	return json(await runSeminarSearch(query, k, locals.user?.id ?? null));
};
