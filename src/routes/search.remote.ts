import { query } from '$app/server';
import * as v from 'valibot';
import * as search from '$lib/server/services/search.ts';
import { requireUser } from '$lib/server/auth-context.ts';

const SearchSchema = v.object({
	query: v.pipe(v.string(), v.nonEmpty()),
	k: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)), 5)
});

export const books = query(SearchSchema, async ({ query: q, k }) => {
	const user = requireUser();
	return search.searchBooks(q, k, user.id);
});

export const seminars = query(SearchSchema, async ({ query: q, k }) => {
	const user = requireUser();
	return search.searchSeminars(q, k, user.id);
});

export const all = query(SearchSchema, async ({ query: q, k }) => {
	const user = requireUser();
	return search.searchAll(q, k, user.id);
});
