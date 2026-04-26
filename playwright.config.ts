import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/
		},
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/dev.json' },
			dependencies: ['setup']
		}
	],
	webServer: {
		command: 'npm run dev',
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
