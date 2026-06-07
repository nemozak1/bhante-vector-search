import { query } from '$app/server';
import * as v from 'valibot';
import * as review from '$lib/server/services/review.ts';
import { requireUser } from '$lib/server/auth-context.ts';

export const status = query(async () => {
	requireUser();
	return review.getStatus();
});

export const diff = query(v.string(), async (code) => {
	requireUser();
	return review.getDiff(code);
});
