import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const STORAGE_PATH = 'e2e/.auth/dev.json';

setup('authenticate as dev user', async ({ page }) => {
	mkdirSync(dirname(STORAGE_PATH), { recursive: true });

	await page.goto('/login');
	await page.getByRole('button', { name: /Sign in as dev@bhante.local/i }).click();
	await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10_000 });
	await expect(page).not.toHaveURL(/\/login/);

	await page.context().storageState({ path: STORAGE_PATH });
});
