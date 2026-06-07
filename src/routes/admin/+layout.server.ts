import { requireAdmin } from '$lib/server/auth-context.ts';

export async function load() {
	const user = await requireAdmin();
	return { user: { id: user.id, email: user.email, name: user.name } };
}
