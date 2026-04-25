import type { Session } from '$lib/auth';

declare global {
	namespace App {
		interface Locals {
			session: Session['session'] | null;
			user: Session['user'] | null;
		}
	}
}

export {};
