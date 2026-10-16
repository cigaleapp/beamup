import { createSelectSchema } from 'drizzle-arktype';
import { corrections, metadataAlts, metadataValues } from './tables.js';
import { omit } from './utils.js';
import { type } from 'arktype';

const EnrichedCorrection = type({
	corrections: createSelectSchema(corrections).or('null'),
	before_values: createSelectSchema(metadataValues).or('null'),
	after_values: createSelectSchema(metadataValues).or('null'),
	before_alternatives: createSelectSchema(metadataAlts).or('null'),
	after_alternatives: createSelectSchema(metadataAlts).or('null')
});

export function nestCorrection(
	row: (typeof EnrichedCorrection)['infer'],
	rows: Array<(typeof EnrichedCorrection)['infer']>
) {
	const loadValues = (subject: {
		value?: string | undefined;
		alternatives: Array<null | { value?: string | undefined }>;
	}) => {
		try {
			return {
				...subject,
				value: subject.value ? JSON.parse(subject.value) : undefined,
				alternatives: subject.alternatives
					.filter((alt) => alt !== null)
					.map((alt) => ({ ...alt, value: alt.value ? JSON.parse(alt.value) : undefined }))
					.filter((alt) => alt.value !== undefined)
			};
		} catch {
			return subject;
		}
	};

	const unflatten = (
		values: typeof row.before_values,
		alternatives: Array<typeof row.before_alternatives>
	) => ({
		...omit(values, 'id'),
		alternatives: alternatives
			.filter((alt) => alt !== null)
			.map((alt) => omit(alt, 'id', 'metadata_value_id'))
	});

	return {
		...row.corrections,
		before: loadValues(
			unflatten(
				row.before_values,
				rows.map((row) => row.before_alternatives)
			)
		),
		after: loadValues(
			unflatten(
				row.after_values,
				rows.map((row) => row.after_alternatives)
			)
		)
	};
}
