import { query } from '$app/server';
import * as healthDal from '$lib/server/dal/health.ts';
import { requireAdmin } from '$lib/server/auth-context.ts';
import { r2Configured, env } from '$lib/server/env.ts';

export type HealthSnapshot = {
	chunks: healthDal.ChunkStat[];
	tables: healthDal.TableCount[];
	recent_errors: healthDal.RecentError[];
	last_ingestion: string | null;
	r2_configured: boolean;
	r2_feedback_bucket: string;
	feedback_slack_configured: boolean;
};

export const snapshot = query(async (): Promise<HealthSnapshot> => {
	await requireAdmin();
	const [chunks, tables, recent_errors, last_ingestion] = await Promise.all([
		healthDal.chunkStats(),
		healthDal.tableCounts(),
		healthDal.recentErrors(),
		healthDal.lastIngestion()
	]);
	return {
		chunks,
		tables,
		recent_errors,
		last_ingestion,
		r2_configured: r2Configured(),
		r2_feedback_bucket: env.R2_FEEDBACK_BUCKET || '(unset)',
		feedback_slack_configured: !!env.FEEDBACK_SLACK_WEBHOOK_URL
	};
});
