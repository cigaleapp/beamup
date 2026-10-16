import { type } from 'arktype';
import { createSelectSchema } from 'drizzle-arktype';
import { MAX_CORRECTIONS_PER_REQUEST } from './constants.js';
import {
	corrections,
	metadataAlts,
	metadataValues,
	SubscriptionDeliveryMethod,
	SubscriptionFrequency,
	subscriptions
} from './tables.js';

const MetadataValue = createSelectSchema(metadataValues)
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

export const SubscriptionsTemplatePayload = type({
	corrections_count: 'number.integer >= 0'
});

export type SubscriptionsTemplatePayload = (typeof SubscriptionsTemplatePayload)['infer'];

export const Subscription = createSelectSchema(subscriptions);

export const CreateSubscriptionRequest = Subscription.in
	.omit(
		'id',
		'body_template',
		'title_template',
		'frequency',
		'mail_to',
		'send_received_after',
		'latest_sent_at',
		'metadata_glob',
		'subject_glob',
		'users_exclude_glob',
		'users_glob',
		'delivery_via',
		'ntfy_host',
		'ntfy_topic'
	)
	.and({
		delivery_via: SubscriptionDeliveryMethod.array().atLeastLength(1),
		'ntfy_host?': ['string', '@', 'Must be a valid URL'],
		'ntfy_topic?': '/^[\\w_]+$/',
		mail_to: ['string.email[]', '=', () => []],
		body_template: [
			'string',
			'@',
			`{key} will be replaced by the value. Available keys: ${SubscriptionsTemplatePayload.expression}`
		],
		title_template: [
			'string',
			'@',
			`{key} will be replaced by the value. Available keys: ${SubscriptionsTemplatePayload.expression}`
		],
		frequency: SubscriptionFrequency,
		'metadata_glob?': ['string', '@', 'Glob pattern (* and ? only) of metadata IDs to include'],
		'subject_glob?': ['string', '@', 'Glob pattern (* and ? only) of subjects to include'],
		'users_glob?': ['string', '@', 'Glob pattern (* and ? only) of users to include'],
		'users_exclude_glob?': ['string', '@', 'Glob pattern (* and ? only) of users to exclude']
	});
