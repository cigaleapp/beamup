import type {
	Correction,
	CorrectionsList,
	SendCorrectionsRequest,
	SendableCorrection
} from './tables.js';
import { chunk } from './utils.js';
import { MAX_CORRECTIONS_PER_REQUEST } from './constants.js';

export const CHUNK_SIZE = MAX_CORRECTIONS_PER_REQUEST;
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
		const response = await fetch(origin + '/corrections', {
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
	protocol
}: {
	origin: string;
	protocol: string;
}) {
	const response = await fetch(origin + `/corrections/${protocol}`);

	if (response.ok) {
		const results = (await response.json()) as typeof CorrectionsList.infer;
		return results.map((correction) => ({
			...correction,
			details: async () =>
				correctionDetails({
					origin,
					protocol,
					id: correction.id
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
	const response = await fetch(origin + `/corrections/${protocol}/${id}`);

	if (response.ok) return (await response.json()) as typeof Correction.infer;

	if (response.status === 404) return undefined;

	throw new Error(response.status + ' ' + (await response.text()));
}
