import { query } from '$app/server';
import * as v from 'valibot';
import * as searchHistory from '$lib/server/services/search-history.ts';
import { requireUser } from '$lib/server/auth-context.ts';

export const recent = query(v.optional(v.number(), 50), async (limit) => {
	const user = requireUser();
	return searchHistory.listRecent(user.id, limit);
});
