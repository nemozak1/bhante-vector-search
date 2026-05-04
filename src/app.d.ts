import type { Session } from '$lib/auth';

declare global {
	namespace App {
		interface Locals {
			session: Session['session'] | null;
			user: Session['user'] | null;
		}
	}

	const __APP_VERSION__: string;
	const __APP_RELEASED__: string;
}

export {};
