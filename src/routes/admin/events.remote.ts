import { query } from '$app/server';
import * as v from 'valibot';
import * as eventsDal from '$lib/server/dal/events.ts';
import { requireAdmin } from '$lib/server/auth-context.ts';

const LevelSchema = v.picklist(['debug', 'info', 'warning', 'error']);
const SourceSchema = v.picklist(['user', 'webhook', 'cron', 'system', 'api']);

const ListInputSchema = v.object({
	level: v.nullish(LevelSchema),
	source: v.nullish(SourceSchema),
	type: v.nullish(v.pipe(v.string(), v.maxLength(80))),
	q: v.nullish(v.pipe(v.string(), v.maxLength(120))),
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)), 50)
});

export const list = query(ListInputSchema, async ({ level, source, type, q, page, pageSize }) => {
	await requireAdmin();
	return eventsDal.listForAdmin({
		level: level ?? null,
		source: source ?? null,
		type: type ?? null,
		actorId: null,
		q: q ?? null,
		limit: pageSize,
		offset: (page - 1) * pageSize
	});
});

export const distinctTypes = query(async () => {
	await requireAdmin();
	return eventsDal.distinctTypes();
});
