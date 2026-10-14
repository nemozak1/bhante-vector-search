import { error } from '@sveltejs/kit';
import { embed, shorten } from '../embed.ts';
import * as chunksDal from '../dal/chunks.ts';
import type { ChunkHit } from '../dal/chunks.ts';
import * as seminarChunksDal from '../dal/seminar-chunks.ts';
import { SEMINAR_CHUNK_DIMS, type SeminarChunkHit } from '../dal/seminar-chunks.ts';
import * as searchHistory from './search-history.ts';
import * as rerankSvc from '../rerank.ts';
import { env } from '../env.ts';
import { logEvent } from './events.ts';
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

function toSeminarResult(h: SeminarChunkHit): SeminarResult {
	return {
		content: h.document,
		seminar_title: h.seminar_title,
		seminar_code: h.seminar_code,
		speakers: h.speakers,
		turn_start: h.turn_start,
		turn_end: h.turn_end,
		date: h.date,
		location: h.location,
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
	if (!userId) return;
	searchHistory.record(userId, query, scope, null, count).catch(() => {});
	// Fire-and-forget; never block the response on a log write.
	logEvent(
		'search_executed',
		`searched ${scope} for "${query}" (${count} results)`,
		userId,
		undefined,
		'debug'
	).catch(() => {});
}

// When the reranker is on, ask pgvector for more candidates than we'll return,
// rerank them, then take top K. With it off, ask for a few spare seminar windows
// so dropping overlapping ones (see dropOverlapping) still leaves K.
const overfetch = (k: number) => (rerankSvc.isEnabled() ? k * env.RERANK_OVERFETCH : k * 2);

// Book results have only content + score; seminar windows also carry where
// they sit in the transcript.
type Rankable = {
	content: string;
	score: number;
	seminar_title?: string | null;
	seminar_code?: string;
	turn_start?: number;
	turn_end?: number;
};

// Seminar windows go to the reranker with their seminar title for context.
function rerankText(r: Rankable): string {
	return r.turn_start != null && r.seminar_title ? `${r.seminar_title}\n\n${r.content}` : r.content;
}

const overlaps = (a: Rankable, b: Rankable) =>
	a.turn_start != null &&
	b.turn_start != null &&
	a.seminar_code === b.seminar_code &&
	a.turn_start <= b.turn_end! &&
	b.turn_start <= a.turn_end!;

// Consecutive windows can repeat a short turn; keep only the best-ranked of
// any that share a turn so results don't show the same text twice. (Also
// dropping merely adjacent windows was tried and cost known-item hits.)
function dropOverlapping<T extends Rankable>(results: T[]): T[] {
	const kept: T[] = [];
	for (const r of results) {
		if (!kept.some((k) => overlaps(k, r))) kept.push(r);
	}
	return kept;
}

async function rerankAndTake<T extends Rankable>(query: string, results: T[], k: number): Promise<T[]> {
	if (!rerankSvc.isEnabled() || results.length === 0) return dropOverlapping(results).slice(0, k);
	const ranked = await rerankSvc.rerank(query, results, rerankText);
	return dropOverlapping(ranked.map(({ doc, score }) => ({ ...doc, score }))).slice(0, k);
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
	const emb = shorten(await embed(q), SEMINAR_CHUNK_DIMS);
	const hits = await seminarChunksDal.searchByEmbedding(emb, overfetch(k));
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
		seminarChunksDal.searchByEmbedding(shorten(emb, SEMINAR_CHUNK_DIMS), ofK)
	]);

	const merged: UnifiedResult[] = [
		...books.map((h) => ({ ...toBookResult(h), content_type: 'epub' as const })),
		...seminars.map((h) => ({ ...toSeminarResult(h), content_type: 'seminar' as const }))
	].sort((a, b) => b.score - a.score);

	const results = await rerankAndTake(q, merged, k);
	recordIfUser(userId, q, 'all', results.length);
	return { query: q, results, total_results: results.length };
}
