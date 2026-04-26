import { error, json } from '@sveltejs/kit';
import { recentSearches } from '$lib/server/repos/search-history.ts';

export const GET = async ({ url, locals }) => {
	if (!locals.user) error(401);
	const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50));
	return json({ history: await recentSearches(locals.user.id, limit) });
};
