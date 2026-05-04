import { query, command } from '$app/server';
import * as v from 'valibot';
import * as feedback from '$lib/server/services/feedback.ts';
import { requireAdmin } from '$lib/server/auth-context.ts';

const StatusSchema = v.picklist(['new', 'triaged', 'resolved', 'dismissed']);

const CategorySchema = v.picklist([
	'bug',
	'seminar_misformatting',
	'seminar_correction',
	'search_quality',
	'feature',
	'question',
	'other'
]);

const ListInputSchema = v.object({
	status: v.nullish(StatusSchema),
	categories: v.nullish(v.array(CategorySchema)),
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 25)
});

export const list = query(ListInputSchema, async ({ status, categories, page, pageSize }) => {
	await requireAdmin();
	return feedback.listForAdmin({
		status: status ?? null,
		categories: categories ?? null,
		limit: pageSize,
		offset: (page - 1) * pageSize
	});
});

export const get = query(v.pipe(v.number(), v.integer()), async (id) => {
	await requireAdmin();
	return feedback.getForAdmin(id);
});

const SetStatusSchema = v.object({
	id: v.pipe(v.number(), v.integer()),
	status: StatusSchema,
	adminNotes: v.nullish(v.pipe(v.string(), v.maxLength(5000)))
});

export const setStatus = command(SetStatusSchema, async ({ id, status, adminNotes }) => {
	await requireAdmin();
	const updated = await feedback.setStatus(id, status, adminNotes ?? null);
	await get(id).refresh();
	return updated;
});
