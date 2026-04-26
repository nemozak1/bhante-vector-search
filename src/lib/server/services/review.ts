import { error } from '@sveltejs/kit';
import { readFile, access } from 'node:fs/promises';
import { createTwoFilesPatch } from 'diff';
import {
	REVIEW_STATUS_PATH,
	cleanedPath,
	rawPath
} from '../seminars/load.ts';
import { processForDisplay, type SpeakerTurn } from '../seminars/processor.ts';
import type { ReviewStatus, ReviewStatusItem, ReviewDiff } from '$lib/types';

export type { ReviewStatus, ReviewStatusItem, ReviewDiff };

export async function getStatus(): Promise<ReviewStatus> {
	try {
		return JSON.parse(await readFile(REVIEW_STATUS_PATH, 'utf8'));
	} catch {
		error(404, 'Review status file not found');
	}
}

async function exists(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function turnsToText(
	turns: SpeakerTurn[],
	date: string | null,
	location: string | null
): string {
	const lines: string[] = [];
	if (date) lines.push(`Date: ${date}`);
	if (location) lines.push(`Location: ${location}`);
	if (lines.length) lines.push('');

	for (const t of turns) {
		const name = t.speaker ?? '(unattributed)';
		lines.push(`[${name}]`);
		for (const p of t.paragraphs) {
			lines.push(p.length > 200 ? `  ${p.slice(0, 200)}...` : `  ${p}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}

export async function getDiff(code: string): Promise<ReviewDiff> {
	const cPath = cleanedPath(code);
	const rPath = rawPath(code);

	if (!(await exists(cPath))) error(404, `No cleaned file for ${code}`);
	if (!(await exists(rPath))) error(404, `No raw file for ${code}`);

	const cleaned = JSON.parse(await readFile(cPath, 'utf8'));
	const rawResult = await processForDisplay(rPath);

	const cleanedTurns: SpeakerTurn[] = (cleaned.turns ?? []).map(
		(t: { speaker?: string | null; paragraphs: string[] }, i: number) => ({
			speaker: t.speaker ?? null,
			paragraphs: t.paragraphs,
			turn_index: i
		})
	);

	const rawText = turnsToText(rawResult.turns, rawResult.date, rawResult.location);
	const cleanedText = turnsToText(
		cleanedTurns,
		cleaned.date ?? null,
		cleaned.location ?? null
	);

	const patch = createTwoFilesPatch(
		`${code} (raw parse)`,
		`${code} (cleaned)`,
		rawText,
		cleanedText,
		'',
		'',
		{ context: 3 }
	);

	return {
		code,
		title: cleaned.title ?? '',
		raw_turn_count: rawResult.turns.length,
		cleaned_turn_count: cleanedTurns.length,
		diff_lines: patch.split('\n'),
		has_changes: rawText !== cleanedText
	};
}
