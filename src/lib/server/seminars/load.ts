import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { processForDisplay, type SeminarTranscript } from './processor.ts';

export type ContentsEntry = { page: number; label: string };

const DATA_ROOT = resolve(process.cwd(), 'data', 'seminars');
const CLEANED_DIR = resolve(DATA_ROOT, 'cleaned');
const RAW_DIR = resolve(DATA_ROOT, 'raw');

export const REVIEW_STATUS_PATH = resolve(DATA_ROOT, 'review_status.json');

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export function cleanedPath(code: string): string {
	return resolve(CLEANED_DIR, `${code}.json`);
}

export function rawPath(code: string): string {
	return resolve(RAW_DIR, `${code}.json`);
}

function contentsCleanedPath(code: string): string {
	return resolve(CLEANED_DIR, `${code}C.json`);
}

function contentsRawPath(code: string): string {
	return resolve(RAW_DIR, `${code}C.json`);
}

export { CLEANED_DIR, RAW_DIR };

/**
 * If a {code}C.json companion file exists, parse it for "<page> <topic>"
 * entries (e.g. "23-24 Definition of terms") and return them as anchors.
 */
export async function loadContentsForCode(code: string): Promise<ContentsEntry[] | null> {
	for (const path of [contentsCleanedPath(code), contentsRawPath(code)]) {
		if (!(await exists(path))) continue;
		const data = JSON.parse(await readFile(path, 'utf8'));
		const html: string = data.content ?? '';
		if (!html.trim()) continue;
		return parseContentsHtml(html);
	}
	return null;
}

function parseContentsHtml(html: string): ContentsEntry[] {
	const $ = cheerio.load(html);
	const entries: ContentsEntry[] = [];
	const seen = new Set<number>();

	$('p, li').each((_, el) => {
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		if (!text) return;
		// Page-prefixed line: "23 topic" or "23-24 topic" or "23-24, 30 topic"
		const m = /^(\d+)(?:[-–]\d+)?(?:,\s*\d+)?\s+(.+)$/.exec(text);
		if (!m) return;
		const page = parseInt(m[1], 10);
		const label = m[2].replace(/\s+$/, '');
		if (!Number.isFinite(page) || !label) return;
		if (seen.has(page)) return;
		seen.add(page);
		entries.push({ page, label });
	});

	return entries;
}

/**
 * Load a seminar's display data, preferring cleaned/{code}.json over raw/{code}.json.
 * Returns null if neither exists.
 */
export async function loadSeminarForDisplay(code: string): Promise<SeminarTranscript | null> {
	const cleaned = cleanedPath(code);
	if (await exists(cleaned)) {
		const data = JSON.parse(await readFile(cleaned, 'utf8'));
		return {
			code: data.code ?? code,
			title: data.title ?? '',
			date: data.date ?? null,
			location: data.location ?? null,
			turns: (data.turns ?? []).map((t: { speaker?: string | null; paragraphs: string[] }, i: number) => ({
				speaker: t.speaker ?? null,
				paragraphs: t.paragraphs,
				turn_index: i
			}))
		};
	}

	const raw = rawPath(code);
	if (await exists(raw)) {
		return processForDisplay(raw);
	}

	return null;
}
