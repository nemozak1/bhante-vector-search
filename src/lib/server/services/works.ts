import type { Work } from '$lib/types';

export type { Work };

export function list(): Work[] {
	return [
		{ title: 'A Survey of Buddhism', page_range: [35, 611] },
		{ title: "The Buddha's Noble Eightfold Path", page_range: [629, 792] }
	];
}
