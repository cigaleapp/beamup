import { type Correction, SendCorrectionsRequest, type CorrectionsList } from './tables';

export async function sendCorrections({
	origin,
	corrections
}: {
	origin: string;
	corrections: typeof SendCorrectionsRequest.infer;
}) {
	const response = await fetch(origin + '/corrections', {
		method: 'POST',
		body: JSON.stringify(SendCorrectionsRequest.assert(corrections))
	});

	if (response.ok) return;

	throw new Error(response.status + ' ' + (await response.text()));
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
