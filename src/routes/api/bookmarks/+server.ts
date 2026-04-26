import { error, json } from '@sveltejs/kit';
import { addBookmark, deleteBookmark, listBookmarks, type BookmarkKind } from '$lib/server/repos/bookmarks.ts';

export const GET = async ({ locals }) => {
	if (!locals.user) error(401);
	return json({ bookmarks: await listBookmarks(locals.user.id) });
};

export const POST = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const body = (await request.json()) as {
		kind: BookmarkKind;
		ref: Record<string, unknown>;
		note?: string | null;
	};
	const bookmark = await addBookmark(locals.user.id, body.kind, body.ref, body.note ?? null);
	return json(bookmark, { status: 201 });
};

export const DELETE = async ({ url, locals }) => {
	if (!locals.user) error(401);
	const id = Number(url.searchParams.get('id'));
	if (!Number.isFinite(id)) error(400, 'id required');
	const ok = await deleteBookmark(locals.user.id, id);
	if (!ok) error(404);
	return new Response(null, { status: 204 });
};
