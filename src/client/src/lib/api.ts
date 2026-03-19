const BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8000';

export interface BookResult {
	content: string;
	page: number | null;
	page_label: string | null;
	chapter: string | null;
	work: string | null;
	score: number | null;
}

export interface SeminarResult {
	content: string;
	seminar_title: string | null;
	seminar_code: string | null;
	speaker: string | null;
	section_heading: string | null;
	date: string | null;
	location: string | null;
	score: number | null;
}

export interface UnifiedResult {
	content: string;
	content_type: 'epub' | 'seminar';
	score: number | null;
	page: number | null;
	page_label: string | null;
	chapter: string | null;
	work: string | null;
	seminar_title: string | null;
	seminar_code: string | null;
	speaker: string | null;
	section_heading: string | null;
	date: string | null;
	location: string | null;
}

interface SearchResponse<T> {
	query: string;
	results: T[];
	total_results: number;
}

async function fetchJSON<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
	return res.json();
}

export async function searchBooks(query: string, k: number = 5): Promise<SearchResponse<BookResult>> {
	return fetchJSON(`${BASE_URL}/api/search?query=${encodeURIComponent(query)}&k=${k}`);
}

export async function searchSeminars(query: string, k: number = 5): Promise<SearchResponse<SeminarResult>> {
	return fetchJSON(`${BASE_URL}/api/seminars/search?query=${encodeURIComponent(query)}&k=${k}`);
}

export async function searchAll(query: string, k: number = 5): Promise<SearchResponse<UnifiedResult>> {
	return fetchJSON(`${BASE_URL}/api/search/all?query=${encodeURIComponent(query)}&k=${k}`);
}

export interface SpeakerTurn {
	speaker: string | null;
	paragraphs: string[];
	turn_index: number;
}

export interface SeminarTranscript {
	code: string;
	title: string;
	date: string | null;
	location: string | null;
	turns: SpeakerTurn[];
}

export async function getSeminarTranscript(code: string): Promise<SeminarTranscript> {
	return fetchJSON(`${BASE_URL}/api/seminars/${encodeURIComponent(code)}`);
}

export interface SeminarListItem {
	code: string;
	title: string;
	date: string | null;
	location: string | null;
}

export interface SeminarListResponse {
	seminars: SeminarListItem[];
}

export async function listSeminars(): Promise<SeminarListResponse> {
	return fetchJSON(`${BASE_URL}/api/seminars`);
}

export interface ReviewStatusItem {
	status: string;
	title: string;
	format_type: string;
	turn_count: number;
	total_paragraphs: number;
	unattributed_pct: number;
	issues: string[];
	has_date: boolean;
	has_location: boolean;
}

export async function getReviewStatus(): Promise<Record<string, ReviewStatusItem>> {
	return fetchJSON(`${BASE_URL}/api/review/status`);
}

export interface ReviewDiff {
	code: string;
	title: string;
	raw_turn_count: number;
	cleaned_turn_count: number;
	diff_lines: string[];
	has_changes: boolean;
}

export async function getReviewDiff(code: string): Promise<ReviewDiff> {
	return fetchJSON(`${BASE_URL}/api/review/${encodeURIComponent(code)}/diff`);
}

export async function checkHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${BASE_URL}/health`);
		return res.ok;
	} catch {
		return false;
	}
}
