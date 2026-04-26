import { pool } from '../db/pool.ts';
import type { Bookmark, BookmarkKind } from '$lib/types';

export type { Bookmark, BookmarkKind };

export async function listByUser(userId: string): Promise<Bookmark[]> {
	const { rows } = await pool.query<Bookmark>(
		`select id, kind, ref, note, created_at
		   from bookmarks
		  where user_id = $1
		  order by created_at desc`,
		[userId]
	);
	return rows;
}

export async function upsert(
	userId: string,
	kind: BookmarkKind,
	ref: Record<string, unknown>,
	note: string | null
): Promise<Bookmark> {
	const { rows } = await pool.query<Bookmark>(
		`insert into bookmarks (user_id, kind, ref, note)
		 values ($1, $2, $3, $4)
		 on conflict (user_id, kind, ref) do update set note = excluded.note
		 returning id, kind, ref, note, created_at`,
		[userId, kind, JSON.stringify(ref), note]
	);
	return rows[0];
}

export async function deleteByUserAndId(userId: string, id: number): Promise<boolean> {
	const { rowCount } = await pool.query(
		'delete from bookmarks where user_id = $1 and id = $2',
		[userId, id]
	);
	return (rowCount ?? 0) > 0;
}
