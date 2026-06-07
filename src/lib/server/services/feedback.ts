import { error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import * as feedbackDal from '../dal/feedback.ts';
import type {
	FeedbackCategory,
	FeedbackContext,
	FeedbackListItem,
	FeedbackRow,
	FeedbackStatus
} from '$lib/types';
import { env, r2Configured } from '../env.ts';
import { presignGet, presignPut } from '../storage/r2.ts';
import { buildEventMessage } from './events.ts';

export type { FeedbackCategory, FeedbackListItem, FeedbackRow, FeedbackStatus };

export type PresignResult = { key: string; url: string };

/** Generate a presigned PUT URL for a screenshot upload. Returns null if R2
 *  is not configured (dev convenience: form still submits without screenshot). */
export async function presignScreenshotUpload(userId: string): Promise<PresignResult | null> {
	if (!r2Configured()) return null;
	const now = new Date();
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	// Path scheme: feedback/YYYY/MM/<userId-prefix>-<uuid>.png
	// userId prefix is a triage hint when scanning the bucket directly.
	const userPrefix = userId.slice(0, 8);
	const key = `feedback/${yyyy}/${mm}/${userPrefix}-${randomUUID()}.png`;
	const url = await presignPut(key, 'image/png', 600);
	return { key, url };
}

export type CreateInput = {
	userId: string;
	email: string;
	category: FeedbackCategory;
	message: string;
	context: FeedbackContext;
	screenshotKey: string | null;
};

export async function create(input: CreateInput): Promise<{ id: number }> {
	const row = await feedbackDal.insert({
		userId: input.userId,
		emailSnapshot: input.email,
		category: input.category,
		message: input.message,
		context: input.context,
		screenshotKey: input.screenshotKey
	});

	await buildEventMessage(
		'User {user:0} submitted {feedback:1} ({category})'.replace('{category}', row.category),
		[
			{ type: 'user', id: input.userId, label: input.email },
			{ type: 'feedback', id: String(row.id), label: `#${row.id}` }
		],
		{ feedbackId: row.id }
	).log('feedback_submitted', input.userId);

	// Fire-and-forget Slack notification; don't block submit on webhook failure.
	notifySlack(row).catch((err) => {
		console.error('[feedback] slack webhook failed', err);
	});
	return { id: row.id };
}

async function notifySlack(row: FeedbackRow): Promise<void> {
	const webhook = env.FEEDBACK_SLACK_WEBHOOK_URL;
	if (!webhook) return;
	const adminUrl = `${env.BETTER_AUTH_URL}/admin/feedback/${row.id}`;
	const preview = row.message.length > 240 ? row.message.slice(0, 237) + '...' : row.message;
	const payload = {
		text: `New feedback (${row.category}) from ${row.email_snapshot}`,
		blocks: [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*New feedback* — \`${row.category}\` from \`${row.email_snapshot}\`\n${row.url ? `_at ${row.url}_\n` : ''}>${preview.replace(/\n/g, '\n>')}`
				}
			},
			{
				type: 'actions',
				elements: [
					{
						type: 'button',
						text: { type: 'plain_text', text: 'View in admin' },
						url: adminUrl
					}
				]
			}
		]
	};
	const res = await fetch(webhook, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) {
		throw new Error(`slack webhook returned ${res.status}`);
	}
}

export async function listForAdmin(filters: feedbackDal.ListFilters) {
	return feedbackDal.listForAdmin(filters);
}

export type FeedbackDetail = FeedbackRow & { screenshot_url: string | null };

export async function getForAdmin(id: number): Promise<FeedbackDetail> {
	const row = await feedbackDal.getById(id);
	if (!row) error(404, 'Feedback not found');
	let screenshotUrl: string | null = null;
	if (row.screenshot_key) {
		if (row.screenshot_key.startsWith('data:')) {
			// Inline base64 fallback (R2 wasn't configured at upload time)
			screenshotUrl = row.screenshot_key;
		} else if (r2Configured()) {
			try {
				screenshotUrl = await presignGet(row.screenshot_key, 3600);
			} catch (err) {
				console.error('[feedback] presign GET failed', err);
			}
		}
	}
	return { ...row, screenshot_url: screenshotUrl };
}

export async function setStatus(
	id: number,
	status: FeedbackStatus,
	adminNotes: string | null,
	actor: { id: string; email: string }
): Promise<FeedbackRow> {
	const updated = await feedbackDal.updateStatus(id, status, adminNotes);
	if (!updated) error(404, 'Feedback not found');

	const eventType =
		status === 'resolved'
			? 'feedback_resolved'
			: status === 'dismissed'
				? 'feedback_dismissed'
				: status === 'triaged'
					? 'feedback_triaged'
					: 'feedback_reopened';

	await buildEventMessage(
		`{user:0} set {feedback:1} to ${status}`,
		[
			{ type: 'user', id: actor.id, label: actor.email },
			{ type: 'feedback', id: String(id), label: `#${id}` }
		],
		{ feedbackId: id }
	).log(eventType, actor.id);

	return updated;
}
