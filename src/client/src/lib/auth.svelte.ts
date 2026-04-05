/**
 * Reactive auth state backed by Supabase.
 *
 * Usage:
 *   import { auth, initAuth } from '$lib/auth.svelte';
 *   // in root layout onMount: initAuth();
 *   // then read auth.user, auth.session, auth.loading
 */
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthState = {
	session: Session | null;
	user: User | null;
	loading: boolean;
};

export const auth = $state<AuthState>({
	session: null,
	user: null,
	loading: true,
});

let initialized = false;

export async function initAuth(): Promise<void> {
	if (initialized) return;
	initialized = true;

	const { data } = await supabase.auth.getSession();
	auth.session = data.session;
	auth.user = data.session?.user ?? null;
	auth.loading = false;

	supabase.auth.onAuthStateChange((_event, session) => {
		auth.session = session;
		auth.user = session?.user ?? null;
	});
}

export async function signIn(email: string, password: string) {
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw error;
	return data;
}

export async function signUp(email: string, password: string) {
	const { data, error } = await supabase.auth.signUp({ email, password });
	if (error) throw error;
	return data;
}

export async function signOut() {
	const { error } = await supabase.auth.signOut();
	if (error) throw error;
}

/** Get the current access token (refreshing if needed). Returns null if signed out. */
export async function getAccessToken(): Promise<string | null> {
	const { data } = await supabase.auth.getSession();
	return data.session?.access_token ?? null;
}
