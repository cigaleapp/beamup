import { Type, type } from 'arktype';
import { createSelectSchema } from 'drizzle-arktype';
import {
	customType as _customType,
	real,
	sqliteTable as table,
	text
} from 'drizzle-orm/sqlite-core';

export const MetadataType = type.enumerated(
	'string',
	'boolean',
	'integer',
	'float',
	'enum',
	'date',
	'location',
	'boundingbox'
);

export const metadataAlts = table('metadata_value_alternatives', {
	metadata_value_id: text('metadata_value_id')
		.references(() => metadataValues.id)
		.notNull(),
	id: text('id').primaryKey(),
	value: customTypeFromArk(type('string.json'), 'value').notNull(),
	confidence: real('confidence').notNull()
});

export const metadataValues = table('metadata_values', {
	id: text('id').primaryKey(),
	value: customTypeFromArk(type('string.json'), 'value').notNull(),
	type: customTypeFromArk(MetadataType, 'type').notNull()
});

export const corrections = table('corrections', {
	id: text('id').primaryKey(),
	protocol_id: text('protocol_id').notNull(),
	protocol_version: text('protocol_version').notNull(),
	subject: text('subject').notNull(),
	subject_type: customTypeFromArk(
		type.enumerated('observation', 'image', 'other'),
		'subject_type'
	).notNull(),
	metadata: text('metadata').notNull(),
	before: text('before_id')
		.references(() => metadataValues.id)
		.notNull(),
	after: text('after_id')
		.references(() => metadataValues.id)
		.notNull(),
	comment: text('comment'),
	user: text('user'),
	done_at: customTypeFromArk(type('string.date.iso'), 'done_at'),
	sent_at: customTypeFromArk(type('string.date.iso'), 'sent_at').$default(() =>
		new Date().toISOString()
	)
});

export const MetadataValue = createSelectSchema(metadataValues)
	.omit('id')
	.and({
		alternatives: createSelectSchema(metadataAlts).omit('id', 'metadata_value_id').array()
	});

export const Correction = createSelectSchema(corrections, {
	before: MetadataValue,
	after: MetadataValue
}).omit('id');

export const CorrectionsList = createSelectSchema(corrections)
	.omit('before', 'after')
	.and({
		details_url: 'string.url'
	})
	.array();

function customTypeFromArk<T extends Type>(schema: T, columnName: string) {
	return _customType<{ data: T['infer'] }>({
		dataType: () => 'text',
		fromDriver: (value) => schema.assert(value)
	})(columnName);
}
