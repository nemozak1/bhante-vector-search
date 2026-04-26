import { error } from '@sveltejs/kit';
import * as bookmarksDal from '../dal/bookmarks.ts';
import type { Bookmark, BookmarkKind } from '../dal/bookmarks.ts';

export type { Bookmark, BookmarkKind };

export async function listForUser(userId: string): Promise<Bookmark[]> {
	return bookmarksDal.listByUser(userId);
}

export async function create(
	userId: string,
	kind: BookmarkKind,
	ref: Record<string, unknown>,
	note: string | null
): Promise<Bookmark> {
	return bookmarksDal.upsert(userId, kind, ref, note);
}

export async function remove(userId: string, id: number): Promise<void> {
	const ok = await bookmarksDal.deleteByUserAndId(userId, id);
	if (!ok) error(404, 'Bookmark not found');
}
