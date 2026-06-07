import { command } from '$app/server';
import * as v from 'valibot';
import * as feedback from '$lib/server/services/feedback.ts';
import { requireUser } from '$lib/server/auth-context.ts';

const CategorySchema = v.picklist([
	'bug',
	'seminar_misformatting',
	'seminar_correction',
	'search_quality',
	'feature',
	'question',
	'other'
]);

const ContextSchema = v.object({
	url: v.nullable(v.pipe(v.string(), v.maxLength(2000))),
	user_agent: v.nullable(v.pipe(v.string(), v.maxLength(500))),
	viewport: v.nullable(
		v.object({
			w: v.pipe(v.number(), v.integer()),
			h: v.pipe(v.number(), v.integer())
		})
	),
	app_version: v.nullable(v.pipe(v.string(), v.maxLength(80))),
	console_errors: v.nullable(
		v.array(
			v.object({
				ts: v.pipe(v.string(), v.maxLength(64)),
				msg: v.pipe(v.string(), v.maxLength(2000))
			})
		)
	)
});

const SubmitSchema = v.object({
	category: CategorySchema,
	message: v.pipe(v.string(), v.minLength(10), v.maxLength(5000)),
	context: ContextSchema,
	// Either an R2 object key (short) or an inline `data:image/png;base64,…` URL
	// when R2 isn't configured. Cap large enough to hold a 0.5x-scale full-page
	// PNG (~2-3MB base64).
	screenshotKey: v.nullable(v.pipe(v.string(), v.maxLength(5_000_000)))
});

export const presignUpload = command(async () => {
	const user = requireUser();
	return feedback.presignScreenshotUpload(user.id);
});

export const submit = command(SubmitSchema, async (input) => {
	const user = requireUser();
	return feedback.create({
		userId: user.id,
		email: user.email,
		category: input.category,
		message: input.message,
		context: input.context,
		screenshotKey: input.screenshotKey
	});
});
