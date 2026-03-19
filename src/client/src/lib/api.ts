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

export async function checkHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${BASE_URL}/health`);
		return res.ok;
	} catch {
		return false;
	}
}
