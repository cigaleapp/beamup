import { createSelectSchema } from 'drizzle-arktype';
import { MAX_CORRECTIONS_PER_REQUEST } from './constants';
import { metadataValues, metadataAlts, corrections } from './tables';

export const MetadataValue = createSelectSchema(metadataValues)
	.omit('id')
	.and({
		alternatives: createSelectSchema(metadataAlts).omit('id', 'metadata_value_id').array()
	});

export const Correction = createSelectSchema(corrections, {
	before: MetadataValue,
	after: MetadataValue
}).omit('id');

export const SendableCorrection = Correction.omit('received_at');
export const SendCorrectionsRequest = SendableCorrection.or(
	SendableCorrection.array().atMostLength(MAX_CORRECTIONS_PER_REQUEST)
);

export const CorrectionsList = createSelectSchema(corrections)
	.omit('before', 'after')
	.and({
		details_url: 'string.url'
	})
	.array();
