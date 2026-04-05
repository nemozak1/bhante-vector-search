import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
	// Surface a clear error in dev; the app will not function without these.
	// eslint-disable-next-line no-console
	console.error(
		'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
			'Create src/client/.env with these values.'
	);
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});
