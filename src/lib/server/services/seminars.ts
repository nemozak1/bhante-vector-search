import { error } from '@sveltejs/kit';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	CLEANED_DIR,
	RAW_DIR,
	loadSeminarForDisplay
} from '../seminars/load.ts';
import * as seminarContentsDal from '../dal/seminar-contents.ts';
import type { SeminarDetail, SeminarListItem } from '$lib/types';

export type { SeminarDetail, SeminarListItem };

async function safeReaddir(dir: string): Promise<string[]> {
	try {
		return await readdir(dir);
	} catch {
		return [];
	}
}

async function tryLoadListing(path: string, code: string): Promise<SeminarListItem | null> {
	try {
		const data = JSON.parse(await readFile(path, 'utf8'));
		return {
			code: data.code ?? code,
			title: data.title ?? '',
			date: data.date ?? null,
			location: data.location ?? null
		};
	} catch {
		return null;
	}
}

export async function list(): Promise<SeminarListItem[]> {
	const seminars = new Map<string, SeminarListItem>();

	for (const file of await safeReaddir(CLEANED_DIR)) {
		if (!file.endsWith('.json')) continue;
		const code = file.replace(/\.json$/, '');
		if (code.endsWith('C')) continue;
		const item = await tryLoadListing(join(CLEANED_DIR, file), code);
		if (item) seminars.set(code, item);
	}

	for (const file of await safeReaddir(RAW_DIR)) {
		if (!file.endsWith('.json')) continue;
		const code = file.replace(/\.json$/, '');
		if (code.endsWith('C')) continue;
		if (seminars.has(code)) continue;
		const item = await tryLoadListing(join(RAW_DIR, file), code);
		if (item) seminars.set(code, item);
	}

	return [...seminars.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export async function get(code: string): Promise<SeminarDetail> {
	const data = await loadSeminarForDisplay(code);
	if (!data) error(404, `Seminar ${code} not found`);
	const contents = await seminarContentsDal.listBySeminar(code);
	return { ...data, contents: contents.length ? contents : null };
}
