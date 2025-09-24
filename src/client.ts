import {
	type Correction,
	type CorrectionsList,
	MAX_CORRECTIONS_PER_REQUEST,
	SendCorrectionsRequest,
	SendableCorrection
} from './tables';
import { chunk } from './utils';

export { SendableCorrection, SendCorrectionsRequest };
export type SubjectType = typeof SendableCorrection.infer.subject_type;

export async function sendCorrections({
	origin,
	corrections
}: {
	origin: string;
	corrections: typeof SendCorrectionsRequest.infer;
}) {
	const chunks = Array.isArray(corrections)
		? chunk(corrections, MAX_CORRECTIONS_PER_REQUEST)
		: [corrections];

	for (const chunk of chunks) {
		const response = await fetch(origin + '/corrections', {
			method: 'POST',
			body: JSON.stringify(chunk)
		});

		if (!response.ok) throw new Error(response.status + ' ' + (await response.text()));
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
