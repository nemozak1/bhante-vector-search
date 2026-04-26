import { error, json } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { REVIEW_STATUS_PATH } from '$lib/server/seminars/load.ts';

export const GET = async () => {
	try {
		const data = JSON.parse(await readFile(REVIEW_STATUS_PATH, 'utf8'));
		return json(data);
	} catch {
		error(404, 'Review status file not found');
	}
};
