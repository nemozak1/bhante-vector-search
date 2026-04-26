import { query } from '$app/server';
import * as works from '$lib/server/services/works.ts';
import { requireUser } from '$lib/server/auth-context.ts';

export const list = query(async () => {
	requireUser();
	return works.list();
});
