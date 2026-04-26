export type SearchScope = 'all' | 'books' | 'seminars';
export type BookmarkKind = 'seminar' | 'book_chunk' | 'seminar_chunk';

export type Bookmark = {
	id: number;
	kind: BookmarkKind;
	ref: Record<string, unknown>;
	note: string | null;
	created_at: string;
};

export type SavedQuery = {
	id: number;
	name: string;
	query: string;
	scope: SearchScope;
	filters: unknown;
	created_at: string;
	updated_at: string;
};

export type HistoryRow = {
	id: number;
	query: string;
	scope: SearchScope;
	filters: unknown;
	result_count: number;
	created_at: string;
};

export type BookResult = {
	content: string;
	page: number | null;
	page_label: string | null;
	chapter: string | null;
	work: string | null;
	score: number;
};

export type SeminarResult = {
	content: string;
	seminar_title: string | null;
	seminar_code: string | null;
	speaker: string | null;
	section_heading: string | null;
	date: string | null;
	location: string | null;
	score: number;
};

export type UnifiedResult =
	| (BookResult & { content_type: 'epub' })
	| (SeminarResult & { content_type: 'seminar' });

export type SearchResponse<T> = {
	query: string;
	results: T[];
	total_results: number;
};

export type SpeakerTurn = {
	speaker: string | null;
	paragraphs: string[];
	turn_index: number;
};

export type ContentsEntry = { ord: number; page: number; label: string };

export type SeminarTranscript = {
	code: string;
	title: string;
	date: string | null;
	location: string | null;
	turns: SpeakerTurn[];
};

export type SeminarDetail = SeminarTranscript & { contents: ContentsEntry[] | null };

export type SeminarListItem = {
	code: string;
	title: string;
	date: string | null;
	location: string | null;
};

export type Work = { title: string; page_range: [number, number] };

export type ReviewStatusItem = {
	status: string;
	title: string;
	format_type: string;
	turn_count: number;
	total_paragraphs: number;
	unattributed_pct: number;
	issues: string[];
	has_date: boolean;
	has_location: boolean;
};

export type ReviewStatus = Record<string, ReviewStatusItem>;

export type ReviewDiff = {
	code: string;
	title: string;
	raw_turn_count: number;
	cleaned_turn_count: number;
	diff_lines: string[];
	has_changes: boolean;
};
