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
	const data = await loadSeminarForDisplay(code);
	if (!data) error(404, `Seminar ${code} not found`);
	const contents = await seminarContentsDal.listBySeminar(code);
	return { ...data, contents: contents.length ? contents : null };
}
