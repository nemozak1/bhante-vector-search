import { pool } from '../db/pool.ts';
import type {
	FeedbackCategory,
	FeedbackContext,
	FeedbackListItem,
	FeedbackRow,
	FeedbackStatus
} from '$lib/types';

export type { FeedbackCategory, FeedbackListItem, FeedbackRow, FeedbackStatus };

export type InsertInput = {
	userId: string | null;
	emailSnapshot: string;
	category: FeedbackCategory;
	message: string;
	context: FeedbackContext;
	screenshotKey: string | null;
};

export async function insert(input: InsertInput): Promise<FeedbackRow> {
	const { rows } = await pool.query<FeedbackRow>(
		`insert into feedback
		   (user_id, email_snapshot, category, message,
		    url, user_agent, viewport, app_version, console_errors, screenshot_key)
		 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 returning *`,
		[
			input.userId,
			input.emailSnapshot,
			input.category,
			input.message,
			input.context.url,
			input.context.user_agent,
			input.context.viewport ? JSON.stringify(input.context.viewport) : null,
			input.context.app_version,
			input.context.console_errors ? JSON.stringify(input.context.console_errors) : null,
			input.screenshotKey
		]
	);
	return rows[0];
}

export type ListFilters = {
	status?: FeedbackStatus | null;
	categories?: FeedbackCategory[] | null;
	limit: number;
	offset: number;
};

export async function listForAdmin(filters: ListFilters): Promise<{
	items: FeedbackListItem[];
	total: number;
}> {
	const where: string[] = [];
	const params: unknown[] = [];
	if (filters.status) {
		params.push(filters.status);
		where.push(`status = $${params.length}`);
	}
	if (filters.categories && filters.categories.length > 0) {
		params.push(filters.categories);
		where.push(`category = any($${params.length}::feedback_category[])`);
	}
	const whereSql = where.length ? `where ${where.join(' and ')}` : '';

	const totalQ = await pool.query<{ count: string }>(
		`select count(*)::text as count from feedback ${whereSql}`,
		params
	);
	const total = parseInt(totalQ.rows[0]?.count ?? '0', 10);

	params.push(filters.limit);
	params.push(filters.offset);
	const { rows } = await pool.query<FeedbackListItem>(
		`select id, email_snapshot, category, status, created_at,
		        left(message, 160) as message_preview
		   from feedback
		   ${whereSql}
		  order by created_at desc
		  limit $${params.length - 1} offset $${params.length}`,
		params
	);
	return { items: rows, total };
}

export async function getById(id: number): Promise<FeedbackRow | null> {
	const { rows } = await pool.query<FeedbackRow>(
		`select * from feedback where id = $1`,
		[id]
	);
	return rows[0] ?? null;
}

export async function updateStatus(
	id: number,
	status: FeedbackStatus,
	adminNotes: string | null
): Promise<FeedbackRow | null> {
	const { rows } = await pool.query<FeedbackRow>(
		`update feedback
		    set status = $2,
		        admin_notes = coalesce($3, admin_notes),
		        triaged_at = case when $2 in ('triaged','resolved','dismissed') and triaged_at is null
		                          then now() else triaged_at end
		  where id = $1
		  returning *`,
		[id, status, adminNotes]
	);
	return rows[0] ?? null;
}
