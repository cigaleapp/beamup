import { MAX_CORRECTIONS_PER_REQUEST } from './constants.js';
import type { PaginatedResponse } from './pagination.js';
import type {
	Correction,
	CorrectionsList,
	SendCorrectionsRequest,
	SendableCorrection
} from './tables.js';
import { chunk } from './utils.js';

export const CHUNK_SIZE = MAX_CORRECTIONS_PER_REQUEST;
export type { PaginatedResponse } from './pagination.js';
export type SendableCorrection = typeof SendableCorrection.infer;
export type SubjectType = typeof SendableCorrection.infer.subject_type;

export async function sendCorrections({
	origin,
	corrections: _corrections,
	onProgress
}: {
	origin: string;
	corrections: typeof SendCorrectionsRequest.infer;
	onProgress?: (chunk: number, sent: number, total: number) => void | Promise<void>;
}) {
	const corrections = Array.isArray(_corrections) ? _corrections : [_corrections];
	const total = corrections.length;
	const chunks = chunk(corrections, CHUNK_SIZE);
	let sent = 0;

	for (const [i, chunk] of chunks.entries()) {
		const response = await fetch(`${origin}/corrections`, {
			method: 'POST',
			body: JSON.stringify(chunk)
		});

		if (!response.ok) throw new Error(response.status + ' ' + (await response.text()));

		sent += chunk.length;
		await onProgress?.(i, sent, total);
	}
}

export async function correctionsOfProtocol({
	origin,
	protocol,
	unroll
}: {
	origin: string;
	protocol: string;
	/** Unroll paginated results. true for Infinite unrolling, number to stop after n subsequent requests (unroll: 0 is equivalent to unroll: false) */
	unroll?: boolean | number;
}) {
	const response = await fetch(`${origin}/corrections/${protocol}`);

	if (response.ok) {
		const results: typeof CorrectionsList.infer = await unrollPaginatedResponse({
			response: await response.json(),
			limit: unroll === true ? Infinity : Number(unroll)
		});

		return results.map((correction) => ({
			...correction,
			details: async () =>
				correctionDetails({
					id: correction.id,
					origin,
					protocol
				})
		}));
	}

	throw new Error(response.status + ' ' + (await response.text()));
}

export async function correctionDetails({
	origin,
	protocol,
	id
}: {
	origin: string;
	protocol: string;
	id: string;
}) {
	const response = await fetch(`${origin}/corrections/${protocol}/${id}`);

	if (response.ok) return (await response.json()) as typeof Correction.infer;

	if (response.status === 404) return undefined;

	throw new Error(response.status + ' ' + (await response.text()));
}

async function unrollPaginatedResponse<T>({
	response,
	limit
}: {
	response: PaginatedResponse<T>;
	limit: number;
}): Promise<T[]> {
	let requestsCount = 0;
	let items = response.items;

	while (response.next_url && requestsCount < limit) {
		response = await fetch(response.next_url).then((r) => r.json());
		items = [...items, ...response.items];
		requestsCount++;
	}

	return items;
}
