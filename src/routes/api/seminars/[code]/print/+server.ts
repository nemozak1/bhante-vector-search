import { error } from '@sveltejs/kit';
import { getTranscript } from '$lib/server/services/seminars.ts';
import { seminarToHtml } from '$lib/server/seminars/render.ts';

export const GET = async ({ params }) => {
	const data = await getTranscript(params.code);
	if (!data) error(404, `Seminar ${params.code} not found`);
	const html = seminarToHtml(data, { forPrint: true });
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
