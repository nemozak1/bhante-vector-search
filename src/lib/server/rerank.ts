import { env } from './env.ts';

const VOYAGE_URL = 'https://api.voyageai.com/v1/rerank';

type VoyageResponse = {
	data: { index: number; relevance_score: number }[];
};

export const isEnabled = () => env.RERANK_ENABLED && !!env.VOYAGE_API_KEY;

/**
 * Rerank `documents` against `query` using Voyage AI. Returns the documents
 * sorted by relevance, paired with the rerank score in [0, 1].
 *
 * Falls back to the input order if the API errors so a transient Voyage
 * outage degrades search quality but does not break it.
 */
export async function rerank<T>(
	query: string,
	documents: T[],
	getText: (d: T) => string
): Promise<{ doc: T; score: number }[]> {
	if (!isEnabled() || documents.length === 0) {
		return documents.map((doc) => ({ doc, score: 0 }));
	}
	try {
		const res = await fetch(VOYAGE_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query,
				documents: documents.map(getText),
				model: env.RERANK_MODEL,
				top_k: documents.length,
				truncation: true
			})
		});
		if (!res.ok) {
			console.warn(`[rerank] voyage ${res.status}: ${await res.text()}`);
			return documents.map((doc) => ({ doc, score: 0 }));
		}
		const body = (await res.json()) as VoyageResponse;
		if (!Array.isArray(body.data)) {
			console.warn(`[rerank] unexpected voyage response shape:`, body);
			return documents.map((doc) => ({ doc, score: 0 }));
		}
		return body.data.map((r) => ({ doc: documents[r.index], score: r.relevance_score }));
	} catch (e) {
		console.warn(`[rerank] failed:`, e);
		return documents.map((doc) => ({ doc, score: 0 }));
	}
}
