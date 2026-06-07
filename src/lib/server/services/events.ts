import { pool } from '../db/pool.ts';
import type {
	EventEntityRef,
	EventLevel,
	EventMetadata
} from '../db/types/system-events.ts';
import { getEventSource } from '../event-context.ts';

export const SYSTEM_ACTOR_ID = null;

/** Bhante-domain references that get their own indexed columns. Other entity
 *  references (book, bookmark, saved_query, …) live in metadata.entities. */
export interface EventContext {
	feedbackId?: number;
	seminarCode?: string;
}

/**
 * Build a templated event message with entity references. The template uses
 * `{type:index}` placeholders that get substituted with each entity's label.
 *
 *   buildEventMessage('User {user:0} promoted {user:1} to admin', [
 *     { type: 'user', id: actor.id, label: actor.email },
 *     { type: 'user', id: target.id, label: target.email }
 *   ]).log('admin_promoted', actor.id);
 *
 * The original template + entity list is stored in metadata so the admin UI
 * can re-render the message with live links to each entity.
 */
export function buildEventMessage(
	template: string,
	entities: EventEntityRef[],
	context?: EventContext
): {
	message: string;
	metadata: EventMetadata;
	log: (
		type: string,
		actorId?: string | null,
		level?: EventLevel,
		consoleOnly?: boolean
	) => Promise<void>;
} {
	let message = template;
	for (let i = 0; i < entities.length; i++) {
		message = message.replace(`{${entities[i].type}:${i}}`, entities[i].label);
	}
	const metadata: EventMetadata = { messageTemplate: template, entities };
	return {
		message,
		metadata,
		log: (type, actorId, level, consoleOnly) =>
			logEvent(type, message, actorId ?? null, metadata, level, consoleOnly, context)
	};
}

export async function logEvent(
	type: string,
	message: string,
	actorId: string | null = SYSTEM_ACTOR_ID,
	metadata?: EventMetadata,
	level: EventLevel = 'info',
	consoleOnly = false,
	context?: EventContext
): Promise<void> {
	if (level === 'error') {
		console.error(`[${type}] ${message}`);
	} else if (level === 'warning') {
		console.warn(`[${type}] ${message}`);
	} else {
		console.log(`[${type}] ${message}`);
	}

	if (consoleOnly) return;

	const source = getEventSource();

	try {
		await pool.query(
			`insert into system_events
			   (type, level, source, message, metadata, actor_id, feedback_id, seminar_code)
			 values ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				type,
				level,
				source,
				message,
				metadata ? JSON.stringify(metadata) : null,
				actorId,
				context?.feedbackId ?? null,
				context?.seminarCode ?? null
			]
		);
	} catch (err) {
		console.error(`[event-log-failed] [${type}]`, err);
	}
}
