import { query } from '$app/server';
import * as v from 'valibot';
import * as ingestionDal from '$lib/server/dal/ingestion.ts';
import { requireAdmin } from '$lib/server/auth-context.ts';

const KindSchema = v.picklist(['book', 'seminar']);

const ListInputSchema = v.object({
	kind: v.nullish(KindSchema),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)), 100)
});

export const list = query(ListInputSchema, async ({ kind, limit }) => {
	await requireAdmin();
	return ingestionDal.listRecent(limit, kind ?? undefined);
});

export const summary = query(async () => {
	await requireAdmin();
	return ingestionDal.summary();
});
