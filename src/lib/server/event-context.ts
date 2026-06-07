import { AsyncLocalStorage } from 'node:async_hooks';
import type { EventSource } from './db/types/system-events.ts';

interface EventContext {
	source: EventSource;
}

const storage = new AsyncLocalStorage<EventContext>();

const SOURCE_ROUTE_MAP: ReadonlyArray<{ prefix: string; source: EventSource }> = [
	// Webhook paths — add entries as external integrations land
	{ prefix: '/api/webhooks/', source: 'webhook' }
];

export function resolveEventSource(pathname: string): EventSource {
	for (const route of SOURCE_ROUTE_MAP) {
		if (pathname.startsWith(route.prefix)) return route.source;
	}
	return 'user';
}

export function withEventSource<T>(source: EventSource, fn: () => T | Promise<T>): T | Promise<T> {
	return storage.run({ source }, fn);
}

export function getEventSource(): EventSource {
	return storage.getStore()?.source ?? 'user';
}
