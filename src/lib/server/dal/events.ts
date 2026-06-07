import { pool } from '../db/pool.ts';
import type {
	EventLevel,
	EventSource,
	SystemEventWithActor
} from '../db/types/system-events.ts';

export type ListFilters = {
	level?: EventLevel | null;
	source?: EventSource | null;
	type?: string | null;
	actorId?: string | null;
	q?: string | null;
	limit: number;
	offset: number;
};

export async function listForAdmin(filters: ListFilters): Promise<{
	items: SystemEventWithActor[];
	total: number;
}> {
	const where: string[] = [];
	const params: unknown[] = [];

	if (filters.level) {
		params.push(filters.level);
		where.push(`se.level = $${params.length}`);
	}
	if (filters.source) {
		params.push(filters.source);
		where.push(`se.source = $${params.length}`);
	}
	if (filters.type) {
		params.push(filters.type);
		where.push(`se.type = $${params.length}`);
	}
	if (filters.actorId) {
		params.push(filters.actorId);
		where.push(`se.actor_id = $${params.length}`);
	}
	if (filters.q) {
		params.push(`%${filters.q}%`);
		where.push(`(se.message ilike $${params.length} or se.type ilike $${params.length})`);
	}

	const whereSql = where.length ? `where ${where.join(' and ')}` : '';

	const totalQ = await pool.query<{ count: string }>(
		`select count(*)::text as count from system_events se ${whereSql}`,
		params
	);
	const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

	params.push(filters.limit);
	params.push(filters.offset);
	const { rows } = await pool.query<SystemEventWithActor>(
		`select se.id, se.type, se.level, se.source, se.message, se.metadata,
		        se.actor_id, se.ip_address, se.user_agent, se.feedback_id, se.seminar_code,
		        se.created_at,
		        u.name as actor_name, u.email as actor_email
		   from system_events se
		   left join "user" u on u.id = se.actor_id
		   ${whereSql}
		  order by se.created_at desc
		  limit $${params.length - 1} offset $${params.length}`,
		params
	);
	return { items: rows, total };
}

export async function distinctTypes(): Promise<string[]> {
	const { rows } = await pool.query<{ type: string }>(
		`select distinct type from system_events order by type`
	);
	return rows.map((r) => r.type);
}
