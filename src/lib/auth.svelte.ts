import { authClient } from './auth-client';

const sessionStore = authClient.useSession();

type AuthState = {
	session: unknown | null;
	user: { id: string; email: string; name?: string } | null;
	loading: boolean;
};

export const auth: AuthState = $state({
	session: null,
	user: null,
	loading: true
});

sessionStore.subscribe((s) => {
	auth.session = s.data?.session ?? null;
	auth.user = (s.data?.user ?? null) as AuthState['user'];
	auth.loading = !!s.isPending;
});

export async function initAuth(): Promise<void> {
	// Better Auth's useSession is self-initializing on first read.
}

/** Pull a fresh session from the server and apply it to local `auth` state.
 *  Called after sign-in/sign-up so the caller's `goto(...)` doesn't race the
 *  layout's auth-gate effect and bounce back to /login. */
async function refreshSessionState() {
	const { data } = await authClient.getSession();
	auth.session = data?.session ?? null;
	auth.user = (data?.user ?? null) as AuthState['user'];
	auth.loading = false;
}

export async function signIn(email: string, password: string) {
	const { data, error } = await authClient.signIn.email({ email, password });
	if (error) throw new Error(error.message ?? 'Sign in failed');
	await refreshSessionState();
	return data;
}

export async function signUp(email: string, password: string) {
	const name = email.split('@')[0] ?? 'user';
	const { data, error } = await authClient.signUp.email({ email, password, name });
	if (error) throw new Error(error.message ?? 'Sign up failed');
	await refreshSessionState();
	return data;
}

export async function signOut() {
	const { error } = await authClient.signOut();
	if (error) throw new Error(error.message ?? 'Sign out failed');
}

/**
 * Better Auth uses httpOnly cookies; same-origin fetches automatically include
 * them, so consumers no longer need to attach an Authorization header. Returned
 * value is always null — kept for source compatibility while api.ts is updated.
 */
export async function getAccessToken(): Promise<string | null> {
	return null;
}
