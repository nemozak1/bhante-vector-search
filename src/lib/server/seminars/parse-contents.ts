import * as cheerio from 'cheerio';

export type ContentsEntry = { ord: number; page: number; label: string };

/**
 * Parse the HTML body of a {code}C.json contents page into ordered entries.
 *
 * Each entry is a `<p>` (or `<li>`) tag whose text starts with a page number
 * or page range, e.g. "5-16 Work, labour and employment" or "23 Definitions".
 * Lines that don't lead with a number are skipped (headings, empty rows, etc.).
 */
const LINE_RE = /^(\d+)(?:[-–]\d+)?(?:,\s*\d+)?\s+(.+)$/;

export function parseContentsHtml(html: string): ContentsEntry[] {
	const $ = cheerio.load(html);
	const entries: ContentsEntry[] = [];

	const tryAddLine = (raw: string) => {
		const text = raw.replace(/\s+/g, ' ').trim();
		if (!text) return;
		const m = LINE_RE.exec(text);
		if (!m) return;
		const page = parseInt(m[1], 10);
		const label = m[2].replace(/\s+$/, '');
		if (!Number.isFinite(page) || !label) return;
		entries.push({ ord: entries.length, page, label });
	};

	// First pass: <p> / <li> with <br> splitting (handles both pure-<p> and br-based formats).
	$('p, li').each((_, el) => {
		const $el = $(el).clone();
		$el.find('br').replaceWith('\n');
		const text = $el.text();
		for (const line of text.split('\n')) tryAddLine(line);
	});

	if (entries.length > 0) return entries;

	// Fallback: some C files embed the whole TOC in one block of free text, with
	// no <br> at all. Scan for "(start-or-newline)(page) (label-up-to-next-page)".
	const flat = $.root().text().replace(/\s+/g, ' ').trim();
	const re = /(?:^|\s)(\d+)(?:[-–]\d+)?\s+([^\s][\s\S]*?)(?=\s\d+(?:[-–]\d+)?\s+[^\d]|$)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(flat))) {
		const page = parseInt(m[1], 10);
		const label = m[2].replace(/\s+/g, ' ').trim();
		if (!Number.isFinite(page) || !label) continue;
		entries.push({ ord: entries.length, page, label });
	}

	return entries;
}
