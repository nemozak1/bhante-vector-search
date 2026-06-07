export type EventLevel = 'debug' | 'info' | 'warning' | 'error';
export type EventSource = 'user' | 'webhook' | 'cron' | 'system' | 'api';

export type EventEntityType =
	| 'user'
	| 'feedback'
	| 'seminar'
	| 'book'
	| 'bookmark'
	| 'saved_query';

export interface EventEntityRef {
	type: EventEntityType;
	id: string;
	label: string;
}

export interface EventMetadata {
	messageTemplate: string;
	entities: EventEntityRef[];
}

export interface SystemEvent {
	id: string;
	type: string;
	level: EventLevel;
	source: EventSource;
	message: string;
	metadata: EventMetadata | null;
	actor_id: string | null;
	ip_address: string | null;
	user_agent: string | null;
	feedback_id: number | null;
	seminar_code: string | null;
	created_at: string;
}

export interface SystemEventWithActor extends SystemEvent {
	actor_name: string | null;
	actor_email: string | null;
}
