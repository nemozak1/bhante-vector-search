import { error, json } from '@sveltejs/kit';
import { deleteSavedQuery, listSavedQueries, saveQuery } from '$lib/server/repos/saved-queries.ts';
import type { SearchScope } from '$lib/server/repos/search-history.ts';

export const GET = async ({ locals }) => {
	if (!locals.user) error(401);
	return json({ queries: await listSavedQueries(locals.user.id) });
};

export const POST = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const body = (await request.json()) as {
		name: string;
		query: string;
		scope: SearchScope;
		filters?: unknown;
	};
	const saved = await saveQuery(locals.user.id, body.name, body.query, body.scope, body.filters ?? null);
	return json(saved, { status: 201 });
};

export const DELETE = async ({ url, locals }) => {
	if (!locals.user) error(401);
	const id = Number(url.searchParams.get('id'));
	if (!Number.isFinite(id)) error(400, 'id required');
	const ok = await deleteSavedQuery(locals.user.id, id);
	if (!ok) error(404);
	return new Response(null, { status: 204 });
};
