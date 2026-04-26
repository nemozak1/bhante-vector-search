import { error, json } from '@sveltejs/kit';
import { loadSeminarForDisplay } from '$lib/server/seminars/load.ts';

export const GET = async ({ params }) => {
	const data = await loadSeminarForDisplay(params.code);
	if (!data) error(404, `Seminar ${params.code} not found`);
	return json(data);
};
