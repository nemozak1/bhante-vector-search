import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';

const SANGHARAKSHITA_ALIASES = new Set(['S', 'S.', 'Bhante', 'Sangharakshita', 'SANGHARAKSHITA']);

const BOILERPLATE_STARTS = [
	"General Introduction to Sangharakshita's Seminars",
	'Hidden Treasure of the Dharma Cloud'
];

const FOOTER_PATTERNS = [
	/^(Handwritten|Retyped|Typed|Checked and Contented|Printed and Distributed|Transcribed|Edited) by\b/i
];

const SPEAKER_TURN_RE = /^(?:\[\d+\]\s+)?([A-Za-z_][A-Za-z\s_.'-]*?)\s*[;:]\s+/;
const PAGE_MARKER_RE = /^\[(\d+)\]\s*/;

const MAX_SPEAKER_NAME_LENGTH = 40;

const HEADER_LABELS = new Set([
	'HELD AT', 'IN', 'THOSE PRESENT', 'PRESENT', 'DATE', 'PLACE',
	'LOCATION', 'VENUE', 'DAY', 'SESSION', 'TAPE', 'SIDE',
	'NB', 'N.B', 'PLEASE NOTE', 'NOTE', "TRANSCRIBER'S NOTE"
]);

const DATE_RE =
	/\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/;

const LOCATION_KEYWORDS = [
	'New Zealand', 'London', 'Padmaloka', 'Bethnal Green',
	'Sukhavati', 'Glasgow', 'Norfolk', 'Tuscany', 'India'
];

const LOCATION_PHRASE_RE = /(?:in|at)\s+(.+?)(?:\.|$)/;

export type SpeakerTurn = {
	speaker: string | null;
	paragraphs: string[];
	turn_index: number;
};

export type SeminarTranscript = {
	code: string;
	title: string;
	date: string | null;
	location: string | null;
	turns: SpeakerTurn[];
};

type RawSeminar = {
	catNum?: string;
	title?: string;
	content?: string;
};

function normalizeSpeaker(name: string): string {
	if (SANGHARAKSHITA_ALIASES.has(name)) return 'Sangharakshita';
	if (name.startsWith('_')) return 'Unknown';
	return name;
}

function extractHeaderMetadata($: cheerio.CheerioAPI): { date: string | null; location: string | null } {
	let date: string | null = null;
	let location: string | null = null;

	const paragraphs = $('p').slice(0, 10).toArray();
	for (const p of paragraphs) {
		const text = $(p).text().trim();

		if (!date) {
			const match = DATE_RE.exec(text);
			if (match) date = match[0];
		}

		if (LOCATION_KEYWORDS.some((kw) => text.includes(kw))) {
			const phraseMatch = LOCATION_PHRASE_RE.exec(text);
			if (phraseMatch) {
				location = phraseMatch[1].trim();
			} else if (!location) {
				const head = text.slice(0, 5);
				if (text.length < 100 && !/\d/.test(head)) {
					location = text;
				}
			}
		}
	}

	return { date, location };
}

function stripBoilerplate($: cheerio.CheerioAPI): void {
	$('*').each((_, el) => {
		const text = $(el).text().trim();
		if (BOILERPLATE_STARTS.some((bp) => text.startsWith(bp))) {
			$(el).remove();
		}
	});
}

function stripFooter($: cheerio.CheerioAPI): void {
	const ps = $('p').toArray().reverse();
	for (const p of ps) {
		const text = $(p).text().trim();
		if (!text) {
			$(p).remove();
			continue;
		}
		if (FOOTER_PATTERNS.some((pat) => pat.test(text))) {
			$(p).remove();
		} else {
			break;
		}
	}
}

function extractLines($: cheerio.CheerioAPI): string[] {
	const lines: string[] = [];
	$('p').each((_, p) => {
		const $p = $(p);
		$p.find('br').replaceWith('\n');
		const text = $p.text();
		for (const segment of text.split('\n')) {
			const trimmed = segment.trim();
			if (trimmed) lines.push(trimmed);
		}
	});
	return lines;
}

function parseSpeakerTurnsForDisplay($: cheerio.CheerioAPI): Array<{ speaker: string | null; paragraphs: string[] }> {
	const lines = extractLines($);
	const turns: Array<{ speaker: string | null; paragraphs: string[] }> = [];
	let currentSpeaker: string | null = null;
	let currentParagraphs: string[] = [];

	for (let line of lines) {
		if (!line.trim()) continue;

		const match = SPEAKER_TURN_RE.exec(line);
		if (match) {
			const name = match[1].trim();
			if (!HEADER_LABELS.has(name.toUpperCase()) && name.length <= MAX_SPEAKER_NAME_LENGTH) {
				if (currentParagraphs.length > 0) {
					turns.push({ speaker: currentSpeaker, paragraphs: currentParagraphs });
					currentParagraphs = [];
				}
				currentSpeaker = name;
				const remaining = line.slice(match[0].length).trim();
				if (remaining) currentParagraphs.push(remaining);
				continue;
			}
		}

		const markerMatch = PAGE_MARKER_RE.exec(line);
		if (markerMatch) {
			line = line.slice(markerMatch[0].length).trim();
			if (!line) continue;
		}
		currentParagraphs.push(line);
	}

	if (currentParagraphs.length > 0) {
		turns.push({ speaker: currentSpeaker, paragraphs: currentParagraphs });
	}

	return turns;
}

export async function processForDisplay(rawJsonPath: string): Promise<SeminarTranscript> {
	const data: RawSeminar = JSON.parse(await readFile(rawJsonPath, 'utf8'));

	const code = data.catNum ?? rawJsonPath.split('/').pop()?.replace(/\.json$/, '') ?? '';
	const title = data.title ?? 'Unknown Seminar';
	const contentHtml = data.content ?? '';

	if (!contentHtml.trim()) {
		return { code, title, date: null, location: null, turns: [] };
	}

	const $ = cheerio.load(contentHtml);
	const { date, location } = extractHeaderMetadata($);
	stripBoilerplate($);
	stripFooter($);

	const rawTurns = parseSpeakerTurnsForDisplay($);
	const turns: SpeakerTurn[] = rawTurns.map(({ speaker, paragraphs }, i) => ({
		speaker: speaker ? normalizeSpeaker(speaker) : null,
		paragraphs,
		turn_index: i
	}));

	return { code, title, date, location, turns };
}
