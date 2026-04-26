import * as cheerio from 'cheerio';

export type ContentsEntry = { ord: number; page: number; label: string };

/**
 * Parse the HTML body of a {code}C.json contents page into ordered entries.
 *
 * Each entry is a `<p>` (or `<li>`) tag whose text starts with a page number
 * or page range, e.g. "5-16 Work, labour and employment" or "23 Definitions".
 * Lines that don't lead with a number are skipped (headings, empty rows, etc.).
 */
// Page (or page range) optionally followed by ", N", then any whitespace
// (including zero — many sources use "<strong>1</strong>Topic"), then a
// label that must start with a letter or quote (so "12345" alone doesn't
// look like an entry).
const LINE_RE = /^(\d+)(?:[-–]\d+)?(?:,\s*\d+)?\s*(["'A-Za-z][^\n]*?)$/;

// Embedded-entry scan for the "single text blob" fallback — find every
// transition from a page number to a letter-led label, stopping at the
// next page number or end of text.
const EMBEDDED_RE = /(?:^|\s|>)(\d+)(?:[-–]\d+)?\s*(["'A-Za-z][^\d]*?)(?=\s*\d+(?:[-–]\d+)?\s*["'A-Za-z]|$)/g;

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

	// First pass: <p> / <li> with <br> splitting.
	$('p, li').each((_, el) => {
		const $el = $(el).clone();
		$el.find('br').replaceWith('\n');
		const text = $el.text();
		for (const line of text.split('\n')) tryAddLine(line);
	});

	if (entries.length > 0) return entries;

	// Fallback: TOC packed into one block. Scan the flat text for
	// page-then-label transitions.
	const flat = $.root().text().replace(/\s+/g, ' ').trim();
	let m: RegExpExecArray | null;
	while ((m = EMBEDDED_RE.exec(flat))) {
		const page = parseInt(m[1], 10);
		const label = m[2].replace(/\s+/g, ' ').trim();
		if (!Number.isFinite(page) || !label) continue;
		entries.push({ ord: entries.length, page, label });
	}

	return entries;
}
