import { error } from '@sveltejs/kit';
import PDFDocument from 'pdfkit';
import { loadSeminarForDisplay } from '$lib/server/seminars/load.ts';

export const GET = async ({ params }) => {
	const data = await loadSeminarForDisplay(params.code);
	if (!data) error(404, `Seminar ${params.code} not found`);

	const doc = new PDFDocument({ size: 'A4', margin: 56 });
	const chunks: Buffer[] = [];

	const finished = new Promise<Buffer>((resolveBuf, rejectBuf) => {
		doc.on('data', (c: Buffer) => chunks.push(c));
		doc.on('end', () => resolveBuf(Buffer.concat(chunks)));
		doc.on('error', rejectBuf);
	});

	doc.font('Times-Roman');
	doc.fontSize(18).text(data.title, { paragraphGap: 4 });

	const subtitleParts = [data.date, data.location].filter(Boolean) as string[];
	if (subtitleParts.length) {
		doc.fontSize(10).fillColor('#8c7e6a').text(subtitleParts.join(' — '), { paragraphGap: 16 });
	}
	doc.fillColor('#2c2418');

	for (const turn of data.turns) {
		if (turn.speaker) {
			doc
				.moveDown(0.6)
				.fontSize(8)
				.fillColor('#5a7247')
				.text(turn.speaker.toUpperCase(), { characterSpacing: 1.2, paragraphGap: 2 });
		}
		doc.fontSize(11).fillColor('#2c2418');
		for (const p of turn.paragraphs) {
			doc.text(p, { paragraphGap: 4, align: 'left' });
		}
	}

	doc
		.moveDown(2)
		.fontSize(8)
		.fillColor('#8c7e6a')
		.text('Source: Free Buddhist Audio — freebuddhistaudio.com');

	doc.end();
	const pdfBuf = await finished;

	const filename = `${params.code} - ${data.title}.pdf`;
	return new Response(pdfBuf as unknown as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};
