import { query, command } from '$app/server';
import * as v from 'valibot';
import * as bookmarks from '$lib/server/services/bookmarks.ts';
import { requireUser } from '$lib/server/auth-context.ts';

const KindSchema = v.picklist(['seminar', 'book_chunk', 'seminar_chunk']);

const CreateSchema = v.object({
	kind: KindSchema,
	ref: v.record(v.string(), v.unknown()),
	note: v.nullish(v.string())
});

export const list = query(async () => {
	const user = requireUser();
	return bookmarks.listForUser(user.id);
});

export const create = command(CreateSchema, async ({ kind, ref, note }) => {
	const user = requireUser();
	const created = await bookmarks.create(user.id, kind, ref, note ?? null);
	await list().refresh();
	return created;
});

export const remove = command(v.number(), async (id) => {
	const user = requireUser();
	await bookmarks.remove(user.id, id);
	await list().refresh();
});
