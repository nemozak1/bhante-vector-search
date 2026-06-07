/** Ported from iris (cloudlobsters). The config-object-then-fallback pattern
 *  keeps badge styling colocated so adding a new event type is one line. */

export type EventColor =
	| 'green'
	| 'red'
	| 'amber'
	| 'orange'
	| 'blue'
	| 'purple'
	| 'gray'
	| 'teal'
	| 'sky'
	| 'cyan';

export interface EventTypeConfig {
	color: EventColor;
}

const EVENT_TYPE_CONFIG: Record<string, EventTypeConfig> = {
	// Auth + account
	user_signed_up: { color: 'sky' },
	user_login: { color: 'gray' },
	user_logout: { color: 'gray' },
	user_account_updated: { color: 'blue' },
	user_password_changed: { color: 'amber' },
	user_deleted: { color: 'red' },

	// Search
	search_executed: { color: 'blue' },

	// Admin
	admin_promoted: { color: 'purple' },
	admin_demoted: { color: 'orange' },

	// Feedback
	feedback_submitted: { color: 'blue' },
	feedback_triaged: { color: 'amber' },
	feedback_resolved: { color: 'green' },
	feedback_dismissed: { color: 'gray' },

	// Seminars
	seminar_reingested: { color: 'cyan' },
	seminar_review_changed: { color: 'teal' },

	// Errors / warnings
	rate_limit_hit: { color: 'amber' },
	embedding_api_error: { color: 'red' }
};

const FALLBACK_CONFIG: EventTypeConfig = { color: 'gray' };

export function getEventTypeConfig(type: string): EventTypeConfig {
	return EVENT_TYPE_CONFIG[type] ?? FALLBACK_CONFIG;
}
