import { json } from '@sveltejs/kit';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLEANED_DIR, RAW_DIR } from '$lib/server/seminars/load.ts';

type Listing = { code: string; title: string; date: string | null; location: string | null };

async function safeReaddir(dir: string): Promise<string[]> {
	try {
		return await readdir(dir);
	} catch {
		return [];
	}
}

async function tryLoad(path: string, code: string): Promise<Listing | null> {
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

export const GET = async () => {
	const seminars = new Map<string, Listing>();

	for (const file of await safeReaddir(CLEANED_DIR)) {
		if (!file.endsWith('.json')) continue;
		const code = file.replace(/\.json$/, '');
		if (code.endsWith('C')) continue; // contents-companion file, not a seminar
		const item = await tryLoad(join(CLEANED_DIR, file), code);
		if (item) seminars.set(code, item);
	}

	for (const file of await safeReaddir(RAW_DIR)) {
		if (!file.endsWith('.json')) continue;
		const code = file.replace(/\.json$/, '');
		if (code.endsWith('C')) continue; // contents-companion file
		if (seminars.has(code)) continue;
		const item = await tryLoad(join(RAW_DIR, file), code);
		if (item) seminars.set(code, item);
	}

	const sorted = [...seminars.values()].sort((a, b) => a.code.localeCompare(b.code));
	return json({ seminars: sorted, total: sorted.length });
};
