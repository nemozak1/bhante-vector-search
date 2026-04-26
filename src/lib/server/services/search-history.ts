import * as searchHistoryDal from '../dal/search-history.ts';
import type { HistoryRow, SearchScope } from '../dal/search-history.ts';

export type { HistoryRow, SearchScope };

export async function record(
	userId: string,
	query: string,
	scope: SearchScope,
	filters: unknown,
	resultCount: number
): Promise<void> {
	return searchHistoryDal.insert(userId, query, scope, filters, resultCount);
}

export async function listRecent(userId: string, limit: number): Promise<HistoryRow[]> {
	const safeLimit = Math.min(200, Math.max(1, limit));
	return searchHistoryDal.listRecent(userId, safeLimit);
}
