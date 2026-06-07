import { query, command } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import * as usersDal from '$lib/server/dal/users.ts';
import { requireAdmin } from '$lib/server/auth-context.ts';
import { buildEventMessage } from '$lib/server/services/events.ts';

export const list = query(async () => {
	await requireAdmin();
	return usersDal.listAll();
});

export const get = query(v.pipe(v.string(), v.maxLength(64)), async (id) => {
	await requireAdmin();
	const detail = await usersDal.getDetail(id);
	if (!detail) error(404, 'User not found');
	const activity = await usersDal.getActivity(id);
	return { detail, activity };
});

const SetAdminSchema = v.object({
	id: v.pipe(v.string(), v.maxLength(64)),
	isAdmin: v.boolean()
});

export const setAdmin = command(SetAdminSchema, async ({ id, isAdmin }) => {
	const actor = await requireAdmin();
	if (actor.id === id && !isAdmin) {
		// Refuse self-demotion so the last admin can't accidentally lock themselves out.
		// Promotion-of-self is a no-op but harmless.
		error(400, "You can't remove your own admin role here. Ask another admin.");
	}
	const updated = await usersDal.setAdmin(id, isAdmin);
	if (!updated) error(404, 'User not found');

	await buildEventMessage(
		`{user:0} ${isAdmin ? 'promoted' : 'demoted'} {user:1}`,
		[
			{ type: 'user', id: actor.id, label: actor.email },
			{ type: 'user', id: updated.id, label: updated.email }
		]
	).log(isAdmin ? 'admin_promoted' : 'admin_demoted', actor.id);

	await get(id).refresh();
	await list().refresh();
	return updated;
});
