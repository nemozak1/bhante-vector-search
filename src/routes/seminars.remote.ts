import { query } from '$app/server';
import * as v from 'valibot';
import * as seminars from '$lib/server/services/seminars.ts';
import { requireUser } from '$lib/server/auth-context.ts';

export const list = query(async () => {
	requireUser();
	return seminars.list();
});

export const get = query(v.string(), async (code) => {
	requireUser();
	return seminars.get(code);
});
