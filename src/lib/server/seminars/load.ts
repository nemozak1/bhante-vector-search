import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { processForDisplay, type SeminarTranscript } from './processor.ts';

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

export { CLEANED_DIR, RAW_DIR };

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
