import { test, expect, type Page } from '@playwright/test';

const SEMINAR = '151';

async function gotoSeminar(page: Page) {
	await page.goto(`/seminars/${SEMINAR}`);
	await page.waitForSelector('.transcript', { timeout: 15_000 });
}

const fontSize = async (page: Page) =>
	page.evaluate(() => document.querySelector('.transcript')?.getAttribute('style') ?? '');

const fontSizeValue = async (page: Page) =>
	page.evaluate(() =>
		document.querySelector('.transcript')?.style.getPropertyValue('--transcript-font-size')
	);

test.describe('Seminar viewer floating toolbar', () => {
	test('renders the toolbar', async ({ page }) => {
		await gotoSeminar(page);
		const toolbar = page.locator('div.fixed.bottom-6.right-6');
		await expect(toolbar).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Decrease text size' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Increase text size' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Jump to top' })).toBeVisible();
	});

	test('starts at default font size', async ({ page }) => {
		await gotoSeminar(page);
		expect(await fontSizeValue(page)).toBe('1.15rem');
	});

	test('increase button enlarges text', async ({ page }) => {
		await gotoSeminar(page);
		const inc = page.getByRole('button', { name: 'Increase text size' });
		for (let i = 0; i < 3; i++) {
			await inc.click();
			await page.waitForTimeout(40);
		}
		expect(await fontSizeValue(page)).toBe('1.45rem');
	});

	test('decrease button shrinks text and clamps at 0.85rem', async ({ page }) => {
		await gotoSeminar(page);
		const dec = page.getByRole('button', { name: 'Decrease text size' });
		for (let i = 0; i < 12; i++) {
			await dec.click({ force: true });
			await page.waitForTimeout(40);
		}
		expect(await fontSizeValue(page)).toBe('0.85rem');
		await expect(dec).toBeDisabled();
	});

	test('increase clamps at 1.8rem', async ({ page }) => {
		await gotoSeminar(page);
		const inc = page.getByRole('button', { name: 'Increase text size' });
		for (let i = 0; i < 12; i++) {
			await inc.click({ force: true });
			await page.waitForTimeout(40);
		}
		expect(await fontSizeValue(page)).toBe('1.8rem');
		await expect(inc).toBeDisabled();
	});

	test('jump-to-top scrolls window to y=0', async ({ page }) => {
		await gotoSeminar(page);
		await page.evaluate(() => window.scrollTo(0, 1500));
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
		await page.getByRole('button', { name: 'Jump to top' }).click();
		await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3_000 }).toBe(0);
	});

	test('font size carries through to .turn-body via CSS variable', async ({ page }) => {
		await gotoSeminar(page);
		const inc = page.getByRole('button', { name: 'Increase text size' });
		await inc.click();
		await page.waitForTimeout(40);
		const turnBodyFs = await page.evaluate(() => {
			const t = document.querySelector('.turn-body') as HTMLElement | null;
			return t ? getComputedStyle(t).fontSize : '';
		});
		// 1.25rem at default 16px root = 20px
		expect(turnBodyFs).toBe('20px');
	});
});
