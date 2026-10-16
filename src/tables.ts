import { Type, type } from 'arktype';
import { customType, real, sqliteTable as table, text } from 'drizzle-orm/sqlite-core';

import type { SubscriptionsTemplatePayload } from './schemas.js';

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
	value: ark('string.json', 'value').notNull(),
	confidence: real('confidence').notNull()
});

export const metadataValues = table('metadata_values', {
	id: text('id').primaryKey(),
	value: ark('string.json', 'value').notNull(),
	type: ark(MetadataType, 'type').notNull()
});

export const corrections = table('corrections', {
	id: text('id').primaryKey(),
	client_name: text('client_name'),
	client_version: text('client_version'),
	protocol_id: text('protocol_id').notNull(),
	protocol_version: text('protocol_version').notNull(),
	subject: text('subject').notNull(),
	subject_content_hash: text('subject_content_hash'),
	subject_type: ark('"observation" | "image" | "other"', 'subject_type').notNull(),
	metadata: text('metadata').notNull(),
	before: text('before_id')
		.references(() => metadataValues.id)
		.notNull(),
	after: text('after_id')
		.references(() => metadataValues.id)
		.notNull(),
	comment: text('comment'),
	user: text('user'),
	done_at: datetime('done_at'),
	received_at: datetime('received_at').$default(() => new Date())
});

export const SubscriptionTemplate = type.string.pipe((template) => {
	const render = (data: SubscriptionsTemplatePayload) =>
		Object.entries(data).reduce(
			(replaced, [key, value]) => replaced.replaceAll(`{${key}}`, String(value)),
			template
		);

	return {
		toString: () => template,
		toJSON: () => template,
		render
	};
});

export const SubscriptionFrequency = type.enumerated('weekly', 'daily', 'monthly');
export const SubscriptionDeliveryMethod = type.enumerated('email', 'ntfy');
export const subscriptions = table('subscriptions', {
	id: text('id').primaryKey(),
	delivery_via: stringlist(SubscriptionDeliveryMethod, 'delivery_via').notNull(),
	ntfy_host: ark('string.url', 'ntfy_host'),
	ntfy_topic: ark('/^[\\w-]+$/', 'ntfy_topic'),
	mail_to: stringlist(type('string.email'), 'mail_to'),
	/**
	 * Used for both the mail subject line and the ntfy notification title
	 */
	title_template: ark(SubscriptionTemplate, 'title_template').notNull(),
	/**
	 * Used for both the mail body and the ntfy notification description
	 */
	body_template: ark(SubscriptionTemplate, 'body_template').notNull(),
	frequency: ark(SubscriptionFrequency, 'frequency'),
	/**
	 * Only select corrections that have a received_at field later than this date.
	 * Updated after each run to keep in memory which corrections were sent
	 */
	send_received_after: datetime('send_received_after').$default(() => new Date()),
	/** Send corrections from this protocol */
	protocol: text('protocol').notNull(),
	/** Glob pattern for users. */
	users_glob: text('users_glob').default(''),
	users_exclude_glob: text('users_exclude_glob').default(''),
	/** Glob pattern for metadata IDs */
	metadata_glob: text('metadata_glob').default(''),
	/** Glob pattern for subject */
	subject_glob: text('subject_glob').default(''),
	latest_sent_at: datetime('latest_sent_at')
});

function ark<const D>(definition: type.validate<D>, columnName: string) {
	return customType<{ data: type.instantiate<D>['infer'] }>({
		dataType: () => 'text',
		// @ts-expect-error instantiation of type(definition) is infinite (or very large)
		fromDriver: (value) => type(definition).assert(value)
	})(columnName);
}

function datetime<Column extends string>(name: Column) {
	// return customTypeFromArk(type('string.date.iso'), name);
	return customType<{ data: Date }>({
		dataType: () => 'text',
		toDriver: (date) => new Date(date).toISOString(),
		fromDriver: (datestring) => type('string.date.iso.parse').assert(datestring)
	})(name);
}

function stringlist<Column extends string, Element extends Type>(element: Element, name: Column) {
	return customType<{ data: Element['infer'][] }>({
		dataType: () => 'text',
		toDriver: (values) => values.join(','),
		fromDriver(value) {
			if (typeof value !== 'string')
				throw new Error('String list must be stored in-db as a string!');

			return element.array().assert(value.split(','));
		}
	})(name);
}
