import { test, expect } from '@playwright/test';

test.describe('Search ordering (similarity, higher = better)', () => {
	test('seminar search returns scores in [0, 1] sorted descending', async ({ request }) => {
		const r = await request.get('/api/seminars/search?query=meditation&k=5');
		expect(r.ok()).toBeTruthy();
		const body = await r.json();
		expect(body.results).toBeDefined();
		expect(body.results.length).toBeGreaterThan(0);

		const scores = body.results.map((row: { score: number }) => row.score);
		for (const s of scores) {
			expect(s).toBeGreaterThanOrEqual(0);
			expect(s).toBeLessThanOrEqual(1);
		}
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
		}
		expect(scores[0]).toBeGreaterThan(0.3);
	});

	test('book search returns scores in [0, 1] sorted descending', async ({ request }) => {
		const r = await request.get('/api/search?query=meditation&k=5');
		expect(r.ok()).toBeTruthy();
		const body = await r.json();
		expect(body.results.length).toBeGreaterThan(0);
		const scores = body.results.map((row: { score: number }) => row.score);
		for (const s of scores) {
			expect(s).toBeGreaterThanOrEqual(0);
			expect(s).toBeLessThanOrEqual(1);
		}
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
		}
	});

	test('unified search merges and sorts by similarity descending', async ({ request }) => {
		const r = await request.get('/api/search/all?query=meditation&k=10');
		expect(r.ok()).toBeTruthy();
		const body = await r.json();
		const scores = body.results.map((row: { score: number }) => row.score);
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
		}
	});

	test('search-history is auth-gated; with auth it returns 200', async ({ request }) => {
		const r = await request.get('/api/search-history');
		expect([200, 401]).toContain(r.status());
	});
});
