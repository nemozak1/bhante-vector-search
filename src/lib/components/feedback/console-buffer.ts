/** Ring buffer of recent console errors and uncaught exceptions, captured for
 *  inclusion in feedback reports. Side-effect import: patches console.error and
 *  attaches global error listeners on first load (browser only). Idempotent. */

type ErrorEntry = { ts: string; msg: string };

const MAX = 50;
const buffer: ErrorEntry[] = [];
let installed = false;

function push(msg: string) {
	buffer.push({ ts: new Date().toISOString(), msg: msg.slice(0, 2000) });
	if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
}

function format(args: unknown[]): string {
	return args
		.map((a) => {
			if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ''}`;
			if (typeof a === 'string') return a;
			try {
				return JSON.stringify(a);
			} catch {
				return String(a);
			}
		})
		.join(' ');
}

export function install() {
	if (installed) return;
	if (typeof window === 'undefined') return;
	installed = true;

	const original = console.error.bind(console);
	console.error = (...args: unknown[]) => {
		try {
			push(format(args));
		} catch {
			/* don't let buffer mistakes break logging */
		}
		original(...args);
	};

	window.addEventListener('error', (e) => {
		const msg = e.error instanceof Error
			? `${e.error.name}: ${e.error.message}\n${e.error.stack ?? ''}`
			: e.message || 'unknown error';
		push(`[window.error] ${msg}`);
	});

	window.addEventListener('unhandledrejection', (e) => {
		const reason = e.reason;
		const msg = reason instanceof Error
			? `${reason.name}: ${reason.message}\n${reason.stack ?? ''}`
			: String(reason);
		push(`[unhandledrejection] ${msg}`);
	});
}

export function getRecentErrors(): ErrorEntry[] {
	return buffer.slice();
}

export function clearErrors() {
	buffer.length = 0;
}
