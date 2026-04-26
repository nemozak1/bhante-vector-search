import { query, command } from '$app/server';
import * as v from 'valibot';
import * as savedQueries from '$lib/server/services/saved-queries.ts';
import { requireUser } from '$lib/server/auth-context.ts';

const ScopeSchema = v.picklist(['all', 'books', 'seminars']);

const SaveSchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty()),
	query: v.pipe(v.string(), v.nonEmpty()),
	scope: ScopeSchema,
	filters: v.optional(v.unknown())
});

export const list = query(async () => {
	const user = requireUser();
	return savedQueries.listForUser(user.id);
});

export const save = command(SaveSchema, async ({ name, query: q, scope, filters }) => {
	const user = requireUser();
	const saved = await savedQueries.save(user.id, name, q, scope, filters ?? null);
	await list().refresh();
	return saved;
});

export const remove = command(v.number(), async (id) => {
	const user = requireUser();
	await savedQueries.remove(user.id, id);
	await list().refresh();
});
