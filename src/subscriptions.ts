import { differenceInDays, differenceInMonths } from 'date-fns';
import { and, count, desc, eq, gte, like, notLike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import * as c from './console.js';
import { nestCorrection } from './corrections.js';
import { db } from './database.js';
import { sendMail } from './mail.js';
import { Subscription } from './schemas.js';
import {
	corrections,
	metadataAlts,
	metadataValues,
	SubscriptionFrequency,
	subscriptions
} from './tables.js';
import { globToLike } from './utils.js';

export function attachmentS3Path(subscriptionId: string, filename: 'corrections.json') {
	return `subscriptions-attachments/${subscriptionId}/${filename}`;
}

type Frequency = (typeof SubscriptionFrequency)['infer'];
type Subscription = (typeof Subscription)['infer'];

type Config = {
	ntfyClickUrl: (subscriptionId: string, filename: 'corrections.json') => URL;
	/** Run even if most recent run was too recent */
	force?: boolean;
};

export async function runSubscription(
	subscription: Subscription,
	{ ntfyClickUrl, force = false }: Config
) {
	if (subscription.latest_sent_at && !force) {
		switch (subscription.frequency) {
			case 'daily': {
				if (differenceInDays(new Date(), subscription.latest_sent_at) < 1) {
					console.info(
						`Skipping subscription ${subscription.id}: would have run after less than a day`
					);
					return;
				}
				break;
			}
			case 'weekly': {
				if (differenceInDays(new Date(), subscription.latest_sent_at) < 7) {
					console.info(
						`Skipping subscription ${subscription.id}: would have run after less than a week`
					);
					return;
				}
				break;
			}
			case 'monthly': {
				if (differenceInMonths(new Date(), subscription.latest_sent_at) < 1) {
					console.info(
						`Skipping subscription ${subscription.id}: would have run after less than a month`
					);
					return;
				}
				break;
			}
		}
	}

	const deduped = await collectSubscriptionCorrections(subscription);

	if (deduped.length === 0) {
		console.info(
			`Subscription ${c.em(subscription.id)} didn't run, since there's no corrections to send`
		);

		return;
	}

	const payload = { corrections_count: deduped.length };

	if (subscription.delivery_via.includes('email') && subscription.mail_to) {
		await sendMail({
			to: subscription.mail_to,
			subject: subscription.title_template.render(payload),
			body: subscription.body_template.render(payload),
			attachments: [
				new File([JSON.stringify(deduped)], 'corrections.json', {
					type: 'application/json'
				})
			]
		}).catch((e) => {
			console.error(`Couldn't send mail for ${subscription.id}`, e);
			throw e;
		});
	}

	if (
		subscription.delivery_via.includes('ntfy') &&
		subscription.ntfy_host &&
		subscription.ntfy_topic
	) {
		await Bun.s3
			.write(attachmentS3Path(subscription.id, 'corrections.json'), JSON.stringify(deduped), {
				type: 'application/json'
			})
			.catch((e) => {
				console.error(`Couldn't write to S3 for ${subscription.id}`, e);
				throw e;
			});

		await fetch(`${subscription.ntfy_host}/${subscription.ntfy_topic}`, {
			method: 'POST',
			body: subscription.body_template.render(payload),
			headers: {
				Title: subscription.title_template.render(payload),
				Click: ntfyClickUrl(subscription.id, 'corrections.json').toString()
				// Priority: "Medium",
			}
		})
			.then(async (response) => {
				if (!response.ok) throw new Error(await response.text());
			})
			.catch((e) => {
				console.error(`Couldn't push to ntfy for ${subscription.id}`, e);
				throw e;
			});
	}

	// await db
	// 	.update(subscriptions)
	// 	.set({ send_received_after: new Date() })
	// 	.where(eq(subscriptions.id, subscription.id));

	console.info(`Ran subscription ${c.em(subscription.id)}`);
}

export async function collectSubscriptionCorrections(subscription: Subscription) {
	const before_values = alias(metadataValues, 'before_values');
	const after_values = alias(metadataValues, 'after_values');
	const before_alternatives = alias(metadataAlts, 'before_alternatives');
	const after_alternatives = alias(metadataAlts, 'after_alternatives');

	const data = await db
		.select()
		.from(corrections)
		.where(
			and(
				eq(corrections.protocol_id, subscription.protocol),
				subscription.send_received_after
					? gte(corrections.received_at, subscription.send_received_after)
					: undefined,
				subscription.users_glob
					? like(corrections.user, globToLike(subscription.users_glob))
					: undefined,
				subscription.users_exclude_glob
					? notLike(corrections.user, globToLike(subscription.users_exclude_glob))
					: undefined,
				subscription.subject_glob
					? like(corrections.subject, globToLike(subscription.subject_glob))
					: undefined,
				subscription.metadata_glob
					? like(corrections.metadata, globToLike(subscription.metadata_glob))
					: undefined
			)
		)
		.leftJoin(before_values, eq(corrections.before, before_values.id))
		.leftJoin(before_alternatives, eq(before_values.id, before_alternatives.metadata_value_id))
		.leftJoin(after_values, eq(corrections.after, after_values.id))
		.leftJoin(after_alternatives, eq(after_values.id, after_alternatives.metadata_value_id))
		.orderBy(desc(corrections.received_at));

	// Keep only latest of each subject
	const deduped = Map.groupBy(data, (row) => row.corrections.subject)
		.values()
		// First is the latest thanks to ORDER BY
		.map((rows) => nestCorrection(rows[0]!, rows))
		.toArray();
	return deduped;
}

async function runSubscriptions(frequency: Frequency, config: Config) {
	const subs = await db.select().from(subscriptions).where(eq(subscriptions.frequency, frequency));

	for (const sub of subs) {
		await runSubscription(sub, config);
	}
}

const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const satisfies Frequency[];

export async function countSubscriptionsByFrequency() {
	const subcounts = await db
		.select({ frequency: subscriptions.frequency, count: count() })
		.from(subscriptions)
		.groupBy(subscriptions.frequency);

	return Object.fromEntries(
		FREQUENCIES.map((freq) => [
			freq,
			subcounts.find(({ frequency }) => frequency === freq)?.count ?? 0
		])
	) as Record<Frequency, number>;
}

export async function startSubscriptionCronJobs(config: Config) {
	if (Bun.env.SKIP_CRON_JOBS === 'true') return;

	for (const frequency of FREQUENCIES) {
		Bun.cron(`@${frequency}`, async () => {
			await runSubscriptions(frequency, config);
		});
	}
}
