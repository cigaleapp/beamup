import type { Correction, CorrectionsList } from './tables';

type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export async function sendCorrection({
	origin,
	...correction
}: MakeOptional<typeof Correction.infer, 'sent_at'> & { origin: string }) {
	const response = await fetch(origin + '/corrections', {
		method: 'POST',
		body: JSON.stringify({
			sent_at: new Date().toISOString(),
			...correction
		})
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
