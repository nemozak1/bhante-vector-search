import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function readGitSha() {
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return process.env.APP_VERSION || 'unknown';
	}
}

function readReleaseTime() {
	try {
		return execSync('git log -1 --format=%cI HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return process.env.APP_RELEASED || new Date().toISOString();
	}
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		__APP_VERSION__: JSON.stringify(readGitSha()),
		__APP_RELEASED__: JSON.stringify(readReleaseTime())
	}
});
