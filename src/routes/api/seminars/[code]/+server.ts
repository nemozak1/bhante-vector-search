import { error, json } from '@sveltejs/kit';
import { loadSeminarForDisplay } from '$lib/server/seminars/load.ts';
import { getContentsForSeminar } from '$lib/server/repos/seminar-contents.ts';

export const GET = async ({ params }) => {
	const data = await loadSeminarForDisplay(params.code);
	if (!data) error(404, `Seminar ${params.code} not found`);
	const contents = await getContentsForSeminar(params.code);
	return json({ ...data, contents: contents.length ? contents : null });
};
