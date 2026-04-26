import { error } from '@sveltejs/kit';
import { EPub } from 'epub-gen-memory';
import { loadSeminarForDisplay } from '$lib/server/seminars/load.ts';

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export const GET = async ({ params }) => {
	const data = await loadSeminarForDisplay(params.code);
	if (!data) error(404, `Seminar ${params.code} not found`);

	const subtitleParts = [data.date, data.location].filter(Boolean) as string[];
	const bodyParts: string[] = [`<h1>${escapeHtml(data.title)}</h1>`];
	if (subtitleParts.length) {
		bodyParts.push(`<p><em>${escapeHtml(subtitleParts.join(' — '))}</em></p>`);
	}
	bodyParts.push('<hr/>');

	for (const turn of data.turns) {
		if (turn.speaker) bodyParts.push(`<p><strong>${escapeHtml(turn.speaker)}</strong></p>`);
		for (const p of turn.paragraphs) bodyParts.push(`<p>${escapeHtml(p)}</p>`);
	}

	const epub = new EPub(
		{
			title: data.title,
			author: 'Sangharakshita',
			lang: 'en',
			css: 'body { font-family: serif; line-height: 1.8; } strong { font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em; }'
		},
		[
			{
				title: data.title,
				content: bodyParts.join('\n')
			}
		]
	);
	const buf = await epub.genEpub();

	const filename = `${params.code} - ${data.title}.epub`;
	return new Response(buf as unknown as BodyInit, {
		headers: {
			'content-type': 'application/epub+zip',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};
