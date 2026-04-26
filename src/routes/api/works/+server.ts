import { json } from '@sveltejs/kit';

export const GET = () =>
	json({
		works: [
			{ title: 'A Survey of Buddhism', page_range: [35, 611] },
			{ title: "The Buddha's Noble Eightfold Path", page_range: [629, 792] }
		]
	});
