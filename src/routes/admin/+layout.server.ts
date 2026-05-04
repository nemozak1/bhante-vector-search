import { requireAdmin } from '$lib/server/auth-context.ts';

export async function load() {
	requireAdmin();
	return {};
}
