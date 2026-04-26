import { error } from '@sveltejs/kit';
import { embed } from '../embed.ts';
import * as chunksDal from '../dal/chunks.ts';
import type { ChunkHit } from '../dal/chunks.ts';
import * as searchHistory from './search-history.ts';
import * as rerankSvc from '../rerank.ts';
import { env } from '../env.ts';
import type {
	BookResult,
	SeminarResult,
	UnifiedResult,
	SearchResponse
} from '$lib/types';

export type { BookResult, SeminarResult, UnifiedResult, SearchResponse };

function toBookResult(h: ChunkHit): BookResult {
	return {
		content: h.document,
		page: typeof h.metadata.page === 'number' ? h.metadata.page : null,
		page_label: typeof h.metadata.page_label === 'string' ? h.metadata.page_label : null,
		chapter: typeof h.metadata.chapter === 'string' ? h.metadata.chapter : null,
		work: typeof h.metadata.work === 'string' ? h.metadata.work : null,
		score: 1 - h.distance
	};
}

function toSeminarResult(h: ChunkHit): SeminarResult {
	return {
		content: h.document,
		seminar_title: typeof h.metadata.seminar_title === 'string' ? h.metadata.seminar_title : null,
		seminar_code: typeof h.metadata.seminar_code === 'string' ? h.metadata.seminar_code : null,
		speaker: typeof h.metadata.speaker === 'string' ? h.metadata.speaker : null,
		section_heading:
			typeof h.metadata.section_heading === 'string' ? h.metadata.section_heading : null,
		date: typeof h.metadata.date === 'string' ? h.metadata.date : null,
		location: typeof h.metadata.location === 'string' ? h.metadata.location : null,
		score: 1 - h.distance
	};
}

function validateQuery(query: string): string {
	const trimmed = query.trim();
	if (!trimmed) error(400, 'query required');
	return trimmed;
}

function recordIfUser(
	userId: string | null,
	query: string,
	scope: 'all' | 'books' | 'seminars',
	count: number
) {
	if (userId) searchHistory.record(userId, query, scope, null, count).catch(() => {});
}

// When the reranker is on, ask pgvector for more candidates than we'll return,
// rerank them, then take top K. With it off, ask for exactly K.
const overfetch = (k: number) => (rerankSvc.isEnabled() ? k * env.RERANK_OVERFETCH : k);

async function rerankAndTake<T extends { content: string; score: number }>(
	query: string,
	results: T[],
	k: number
): Promise<T[]> {
	if (!rerankSvc.isEnabled() || results.length === 0) return results.slice(0, k);
	const ranked = await rerankSvc.rerank(query, results, (r) => r.content);
	return ranked.slice(0, k).map(({ doc, score }) => ({ ...doc, score }));
}

export async function searchBooks(
	query: string,
	k: number,
	userId: string | null
): Promise<SearchResponse<BookResult>> {
	const q = validateQuery(query);
	const emb = await embed(q);
	const hits = await chunksDal.searchByEmbedding(env.BOOK_COLLECTION, emb, overfetch(k));
	const results = await rerankAndTake(q, hits.map(toBookResult), k);
	recordIfUser(userId, q, 'books', results.length);
	return { query: q, results, total_results: results.length };
}

export async function searchSeminars(
	query: string,
	k: number,
	userId: string | null
): Promise<SearchResponse<SeminarResult>> {
	const q = validateQuery(query);
	const emb = await embed(q);
	const hits = await chunksDal.searchByEmbedding(env.SEMINAR_COLLECTION, emb, overfetch(k));
	const results = await rerankAndTake(q, hits.map(toSeminarResult), k);
	recordIfUser(userId, q, 'seminars', results.length);
	return { query: q, results, total_results: results.length };
}

export async function searchAll(
	query: string,
	k: number,
	userId: string | null
): Promise<SearchResponse<UnifiedResult>> {
	const q = validateQuery(query);
	const emb = await embed(q);
	const ofK = overfetch(k);
	const [books, seminars] = await Promise.all([
		chunksDal.searchByEmbedding(env.BOOK_COLLECTION, emb, ofK),
		chunksDal.searchByEmbedding(env.SEMINAR_COLLECTION, emb, ofK)
	]);

	const merged: UnifiedResult[] = [
		...books.map((h) => ({ ...toBookResult(h), content_type: 'epub' as const })),
		...seminars.map((h) => ({ ...toSeminarResult(h), content_type: 'seminar' as const }))
	].sort((a, b) => b.score - a.score);

	const results = await rerankAndTake(q, merged, k);
	recordIfUser(userId, q, 'all', results.length);
	return { query: q, results, total_results: results.length };
}
