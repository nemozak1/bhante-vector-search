import { pool } from '../db/pool.ts';
import type { SystemEventWithActor } from '../db/types/system-events.ts';

export async function isAdmin(userId: string): Promise<boolean> {
	const { rows } = await pool.query<{ is_admin: boolean }>(
		`select is_admin from "user" where id = $1`,
		[userId]
	);
	return rows[0]?.is_admin === true;
}

export type UserListRow = {
	id: string;
	email: string;
	name: string;
	is_admin: boolean;
	created_at: string;
	last_seen: string | null;
	event_count: number;
	feedback_count: number;
};

export async function listAll(): Promise<UserListRow[]> {
	const { rows } = await pool.query<UserListRow>(
		`select
		    u.id,
		    u.email,
		    u.name,
		    u.is_admin,
		    u."createdAt" as created_at,
		    (select max(s."createdAt") from "session" s where s."userId" = u.id) as last_seen,
		    coalesce((select count(*)::int from system_events e where e.actor_id = u.id), 0) as event_count,
		    coalesce((select count(*)::int from feedback f where f.user_id = u.id), 0) as feedback_count
		   from "user" u
		  order by u."createdAt" desc`
	);
	return rows;
}

export type UserDetail = {
	id: string;
	email: string;
	name: string;
	is_admin: boolean;
	email_verified: boolean;
	created_at: string;
	updated_at: string;
	last_seen: string | null;
	session_count: number;
};

export async function getDetail(id: string): Promise<UserDetail | null> {
	const { rows } = await pool.query<UserDetail>(
		`select
		    u.id,
		    u.email,
		    u.name,
		    u.is_admin,
		    u."emailVerified" as email_verified,
		    u."createdAt" as created_at,
		    u."updatedAt" as updated_at,
		    (select max(s."createdAt") from "session" s where s."userId" = u.id) as last_seen,
		    (select count(*)::int from "session" s where s."userId" = u.id and s."expiresAt" > now()) as session_count
		   from "user" u
		  where u.id = $1`,
		[id]
	);
	return rows[0] ?? null;
}

export type UserActivity = {
	recent_events: SystemEventWithActor[];
	feedback_count: number;
	search_count: number;
	last_login: string | null;
};

export async function getActivity(id: string, eventLimit = 30): Promise<UserActivity> {
	const { rows: events } = await pool.query<SystemEventWithActor>(
		`select se.id, se.type, se.level, se.source, se.message, se.metadata,
		        se.actor_id, se.ip_address, se.user_agent, se.feedback_id, se.seminar_code,
		        se.created_at,
		        u.name as actor_name, u.email as actor_email
		   from system_events se
		   left join "user" u on u.id = se.actor_id
		  where se.actor_id = $1
		  order by se.created_at desc
		  limit $2`,
		[id, eventLimit]
	);
	const { rows: counts } = await pool.query<{
		feedback_count: string;
		search_count: string;
		last_login: string | null;
	}>(
		`select
		    coalesce((select count(*)::text from feedback where user_id = $1), '0') as feedback_count,
		    coalesce((select count(*)::text from system_events where actor_id = $1 and type = 'search_executed'), '0') as search_count,
		    (select max(created_at) from system_events where actor_id = $1 and type = 'user_login') as last_login`,
		[id]
	);
	return {
		recent_events: events,
		feedback_count: parseInt(counts[0]?.feedback_count ?? '0', 10),
		search_count: parseInt(counts[0]?.search_count ?? '0', 10),
		last_login: counts[0]?.last_login ?? null
	};
}

export async function setAdmin(
	id: string,
	isAdmin: boolean
): Promise<{ id: string; email: string } | null> {
	const { rows } = await pool.query<{ id: string; email: string }>(
		`update "user" set is_admin = $2 where id = $1 returning id, email`,
		[id, isAdmin]
	);
	return rows[0] ?? null;
}
