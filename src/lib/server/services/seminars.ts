import { error } from '@sveltejs/kit';
import { loadSeminarForDisplay } from '../seminars/load.ts';
import * as seminarsDal from '../dal/seminars.ts';
import * as seminarContentsDal from '../dal/seminar-contents.ts';
import type { SeminarDetail, SeminarListItem } from '$lib/types';

export type { SeminarDetail, SeminarListItem };

export async function list(): Promise<SeminarListItem[]> {
	const rows = await seminarsDal.list();
	return rows.map((s) => ({
		code: s.code,
		title: s.title,
		date: s.date,
		location: s.location
	}));
}

export async function get(code: string): Promise<SeminarDetail> {
	// Prefer the transcript stored on seminars.transcript (populated by
	// seed:catalog from data/seminars/cleaned/{code}.json). Falls back to the
	// filesystem loader so local dev still works before re-seeding, and so
	// raw-only seminars (no cleaned file) still render.
	const data =
		(await seminarsDal.getTranscriptByCode(code)) ??
		(await loadSeminarForDisplay(code));
	if (!data) error(404, `Seminar ${code} not found`);
	const contents = await seminarContentsDal.listBySeminar(code);
	return { ...data, contents: contents.length ? contents : null };
}
