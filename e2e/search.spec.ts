import { test, expect, type Page } from '@playwright/test';

const QUERY = 'meditation';
const K = 5;

async function runSearchOnPage(page: Page, path: string) {
	await page.goto(path);
	const input = page.locator('.search-input');
	await input.fill(QUERY);

	const slider = page.locator('input[type="range"]');
	await slider.fill(String(K));

	await page.getByRole('button', { name: /^Search$/i }).click();
	await page.waitForSelector('.result-card', { timeout: 30_000 });
}

async function readScores(page: Page): Promise<number[]> {
	const texts = await page.locator('.meta-tag.score').allTextContents();
	return texts.map((t) => parseFloat(t.trim())).filter((n) => !Number.isNaN(n));
}

function expectInUnitInterval(scores: number[]) {
	for (const s of scores) {
		expect(s).toBeGreaterThanOrEqual(0);
		expect(s).toBeLessThanOrEqual(1);
	}
}

function expectDescending(scores: number[]) {
	for (let i = 1; i < scores.length; i++) {
		expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
	}
}

test.describe('Search ordering (similarity, higher = better)', () => {
	test('book search renders scores in [0, 1] sorted descending', async ({ page }) => {
		await runSearchOnPage(page, '/search/books');
		const scores = await readScores(page);
		expect(scores.length).toBeGreaterThan(0);
		expectInUnitInterval(scores);
		expectDescending(scores);
		expect(scores[0]).toBeGreaterThan(0.3);
	});

	test('seminar search renders scores in [0, 1] sorted descending', async ({ page }) => {
		await runSearchOnPage(page, '/search/seminars');
		const scores = await readScores(page);
		expect(scores.length).toBeGreaterThan(0);
		expectInUnitInterval(scores);
		expectDescending(scores);
		expect(scores[0]).toBeGreaterThan(0.3);
	});

	test('unified search merges and sorts by similarity descending', async ({ page }) => {
		await runSearchOnPage(page, '/search');
		const scores = await readScores(page);
		expect(scores.length).toBeGreaterThan(0);
		expectInUnitInterval(scores);
		expectDescending(scores);
	});
});
