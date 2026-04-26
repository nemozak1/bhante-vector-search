import { error } from '@sveltejs/kit';
import * as savedQueriesDal from '../dal/saved-queries.ts';
import type { SavedQuery } from '../dal/saved-queries.ts';
import type { SearchScope } from '../dal/search-history.ts';

export type { SavedQuery };

export async function listForUser(userId: string): Promise<SavedQuery[]> {
	return savedQueriesDal.listByUser(userId);
}

export async function save(
	userId: string,
	name: string,
	query: string,
	scope: SearchScope,
	filters: unknown
): Promise<SavedQuery> {
	return savedQueriesDal.upsert(userId, name, query, scope, filters);
}

export async function remove(userId: string, id: number): Promise<void> {
	const ok = await savedQueriesDal.deleteByUserAndId(userId, id);
	if (!ok) error(404, 'Saved query not found');
}
