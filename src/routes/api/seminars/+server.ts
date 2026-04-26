import { json } from '@sveltejs/kit';
import { listSeminars } from '$lib/server/repos/seminars.ts';

export const GET = async () => {
	const seminars = await listSeminars();
	return json({
		seminars: seminars.map((s) => ({
			code: s.code,
			title: s.title,
			date: s.date,
			location: s.location
		})),
		total: seminars.length
	});
};
