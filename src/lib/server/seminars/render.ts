import type { SeminarTranscript } from './processor.ts';

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function seminarToHtml(data: SeminarTranscript, opts: { forPrint?: boolean } = {}): string {
	const title = escapeHtml(data.title);
	const subtitleParts = [data.date, data.location].filter(Boolean) as string[];
	const subtitle = subtitleParts.length ? ` — `.concat(subtitleParts.map(escapeHtml).join(' — ')) : '';

	const turnsHtml = data.turns
		.map((turn) => {
			const speaker = turn.speaker ?? '';
			const speakerClass = speaker === 'Sangharakshita' ? ' sangharakshita' : '';
			const speakerEl = speaker ? `<div class="speaker">${escapeHtml(speaker)}</div>` : '';
			const paras = turn.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
			return `<div class="turn${speakerClass}">${speakerEl}<div class="body">${paras}</div></div>`;
		})
		.join('');

	const printStyle = opts.forPrint
		? `@media print { body { font-size: 11pt; } .turn { page-break-inside: avoid; } }`
		: '';

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #2c2418; line-height: 1.8; max-width: 700px; margin: 0 auto; padding: 2rem 1.5rem; }
  h1 { font-size: 1.6rem; font-weight: 500; margin-bottom: 0.4rem; }
  .subtitle { font-family: sans-serif; font-size: 0.88rem; color: #8c7e6a; margin-bottom: 2rem; }
  .turn { margin-bottom: 1.4rem; padding-left: 1rem; border-left: 2px solid transparent; }
  .turn.sangharakshita { border-left-color: #5a7247; }
  .speaker { font-family: sans-serif; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #5a7247; margin-bottom: 0.25rem; }
  .body { font-size: 1.1rem; }
  .body p { margin-bottom: 0.5em; }
  .body p:last-child { margin-bottom: 0; }
  .source { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e8e3da; font-family: sans-serif; font-size: 0.75rem; color: #8c7e6a; }
  ${printStyle}
</style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<p class="subtitle">${subtitle.slice(3)}</p>` : ''}
  ${turnsHtml}
  <div class="source">Source: Free Buddhist Audio — freebuddhistaudio.com</div>
</body>
</html>`;
}
