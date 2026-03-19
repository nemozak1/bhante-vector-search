import type { UnifiedResult, BookResult, SeminarResult } from './api';

interface SearchState<T> {
	query: string;
	k: number;
	results: T[];
	searched: boolean;
}

function createSearchState<T>() {
	let state: SearchState<T> = {
		query: '',
		k: 5,
		results: [],
		searched: false,
	};

	return {
		get: () => state,
		set: (s: SearchState<T>) => { state = s; },
	};
}

export const allSearchState = createSearchState<UnifiedResult>();
export const bookSearchState = createSearchState<BookResult>();
export const seminarSearchState = createSearchState<SeminarResult>();
