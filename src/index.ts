import { ArkErrors, TraversalError, type } from 'arktype';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

import packageManifest from '../package.json' with { type: 'json' };
import { SubscriptionTemplate } from './tables.js';
import * as c from './console.js';
import { CorsedResponse as Response } from './cors.js';
import { db } from './database.js';
import { filterByQuery } from './filters';
import { paginated } from './pagination.js';
import { Correction, CreateSubscriptionRequest, SendCorrectionsRequest } from './schemas.js';
import {
	attachmentS3Path,
	countSubscriptionsByFrequency,
	runSubscription,
	startSubscriptionCronJobs,
	collectSubscriptionCorrections
} from './subscriptions';
import * as tables from './tables.js';
import { corrections, metadataAlts, metadataValues } from './tables.js';
import { omit } from './utils.js';
import { nestCorrection } from './corrections.js';

const port = process.argv[2] ? parseInt(process.argv[2]) : 3000;

let baseURL: string = '';

Bun.serve({
	port,
	development: !Bun.env.PROD,
	routes: {
		'/corrections': {
			async POST(req: Request) {
				const body = await req.json().then(SendCorrectionsRequest.assert);
				const corrections = Array.isArray(body) ? body : [body];

				console.info(
					`Received ${c.strong(corrections.length.toString().padStart(3, ' '))} corrections from ${c.em(req.headers.get('origin') || 'unknown')}`
				);

				await db.transaction(async (tx) => {
					for (const correction of corrections) {
						const { alternatives: beforeAlternatives, ...before } = correction.before;
						const { alternatives: afterAlternatives, ...after } = correction.after;

						const before_id = nanoid();
						const after_id = nanoid();

						await tx.insert(metadataValues).values([
							{ ...before, id: before_id },
							{ ...after, id: after_id }
						]);

						if (beforeAlternatives.length + afterAlternatives.length > 0)
							await tx.insert(metadataAlts).values([
								...beforeAlternatives.map((alt) => ({
									metadata_value_id: before_id,
									id: nanoid(),
									...alt
								})),
								...afterAlternatives.map((alt) => ({
									metadata_value_id: after_id,
									id: nanoid(),
									...alt
								}))
							]);

						await tx.insert(tables.corrections).values({
							...correction,
							received_at: new Date(),
							id: nanoid(),
							before: before_id,
							after: after_id
						});
					}
				});

				return Response.json({ ok: true });
			}
		},
		'/corrections/:protocol': {
			GET: paginated(200, async ({ params, url }, { limit, offset }) => {
				const orderBy = type
					.enumerated('received_at', 'id', 'done_at')
					.assert(new URL(url).searchParams.get('order_by') || 'received_at');

				return {
					extra: {
						by_metadata_url: new URL(`/corrections/${params.protocol}/metadata`, url).toString(),
						by_user_url: new URL(`/corrections/${params.protocol}/users`, url).toString()
					},
					items: await db
						.select()
						.from(corrections)
						.where(
							and(
								eq(corrections.protocol_id, params.protocol),
								...filterByQuery(url, corrections.metadata, 'metadata'),
								...filterByQuery(url, corrections.user, 'user')
							)
						)
						.orderBy(desc(corrections[orderBy]))
						.limit(limit)
						.offset(offset)
						.then((rows) =>
							rows.map(({ id, before: _, after: __, ...correction }) => ({
								id,
								details_url: new URL(`/corrections/${params.protocol}/${id}`, url).toString(),
								...correction
							}))
						),

					hasNext: await db
						.select({ _: sql`1` })
						.from(corrections)
						.where(eq(corrections.protocol_id, params.protocol))
						.limit(limit)
						.offset(offset + limit)
						.then((r) => r.length > 0)
				};
			})
		},
		'/corrections/:protocol/metadata': {
			async GET({ params, url }) {
				const data = await db
					.selectDistinct({ metadata: corrections.metadata })
					.from(corrections)
					.where(
						and(isNotNull(corrections.metadata), eq(corrections.protocol_id, params.protocol))
					);

				return Response.json(
					data.map((row) => ({
						metadata: row.metadata,
						corrections_url: new URL(
							`/corrections/${params.protocol}?metadata=${encodeURIComponent(row.metadata)}`,
							url
						).toString()
					}))
				);
			}
		},
		'/corrections/:protocol/users': {
			async GET({ params, url }) {
				const data = await db
					.selectDistinct({ user: corrections.user })
					.from(corrections)
					.where(and(isNotNull(corrections.user), eq(corrections.protocol_id, params.protocol)));

				return Response.json(
					data.map((row) => ({
						user: row.user,
						corrections_url: new URL(
							`/corrections/${params.protocol}?user=${encodeURIComponent(row.user!)}`,
							url
						).toString()
					}))
				);
			}
		},
		'/corrections/:protocol/:id': {
			async GET({ params }) {
				const before_values = alias(metadataValues, 'before_values');
				const after_values = alias(metadataValues, 'after_values');
				const before_alternatives = alias(metadataAlts, 'before_alternatives');
				const after_alternatives = alias(metadataAlts, 'after_alternatives');

				const data = await db
					.select()
					.from(corrections)
					.where(eq(corrections.id, params.id))
					.leftJoin(before_values, eq(corrections.before, before_values.id))
					.leftJoin(
						before_alternatives,
						eq(before_values.id, before_alternatives.metadata_value_id)
					)
					.leftJoin(after_values, eq(corrections.after, after_values.id))
					.leftJoin(after_alternatives, eq(after_values.id, after_alternatives.metadata_value_id))
					.then((rows) => {
						const row = rows.at(0);
						if (!row) return null;

						return nestCorrection(row, rows);
					});

				if (!data) return Response.json({ error: 'Not found' }, { status: 404 });

				return Response.json(data);
			}
		},
		'/protocols': {
			GET: paginated(50, async ({ url }, { limit, offset }) => {
				const data = await db
					.select({
						protocol: corrections.protocol_id,
						count: sql<number>`cast(count(${corrections.id}) as int)`
					})
					.from(corrections)
					.groupBy(corrections.protocol_id)
					.limit(limit)
					.offset(offset);

				return {
					hasNext: data.length > 0,
					items: data.map((row) => ({
						corrections_url: new URL(`/corrections/${row.protocol}`, url),
						...row
					}))
				};
			})
		},
		'/subscriptions': {
			async POST(req: Request) {
				const data = await req.json().then(CreateSubscriptionRequest.assert);

				const id = nanoid();
				await db.insert(tables.subscriptions).values({
					...data,
					id,
					title_template: SubscriptionTemplate.assert(data.title_template),
					body_template: SubscriptionTemplate.assert(data.body_template)
				});

				return Response.json({ id });
			}
		},
		'/subscriptions/:id': {
			async GET({ params, url }) {
				const [first] = await db
					.select()
					.from(tables.subscriptions)
					.where(eq(tables.subscriptions.id, params.id));

				if (!first) return new Response('Not Found', { status: 404 });

				return Response.json({
					preview_corrections_url: new URL(`/subscriptions/${first.id}/preview`, url),
					trigger_subscription_url: `POST ${new URL(`/subscriptions/${first.id}/trigger`, url)}`,
					...first
				});
			},
			async DELETE({ params }) {
				await db.delete(tables.subscriptions).where(eq(tables.subscriptions.id, params.id));

				return new Response('OK', { status: 204 });
			}
		},
		'/subscriptions/:id/preview': {
			async GET({ params, url }) {
				const [sub] = await db
					.select()
					.from(tables.subscriptions)
					.where(eq(tables.subscriptions.id, params.id));
				if (!sub) return new Response('Subscription not found', { status: 404 });

				const data = await collectSubscriptionCorrections(sub);

				return Response.json(data);
			}
		},
		'/subscriptions/:id/trigger': {
			async POST({ params, url }) {
				const [subscription] = await db
					.select()
					.from(tables.subscriptions)
					.where(eq(tables.subscriptions.id, params.id));

				if (!subscription) return new Response('Subscription not found', { status: 404 });

				await runSubscription(subscription, {
					ntfyClickUrl: (sub, file) => new URL(`/subscriptions/${sub}/attachments/${file}`, url),
					force: true
				});

				return new Response('Subscription ran', { status: 201 });
			}
		},
		'/subscriptions/:id/attachments/:file': {
			async GET({ params }) {
				const file = Bun.s3.file(attachmentS3Path(params.id, params.file as 'corrections.json'));

				return Response.json(await file.json(), {
					headers: {
						'Content-Disposition': `attachment; filename="${params.file}"`
					}
				});
			}
		},
		'/': {
			async GET({ url }) {
				const pagination =
					'response contains fields next_url (null at end), items (array of results)';

				return Response.json({
					'This is': 'BeamUp API for CIGALE, https://github.com/cigaleapp/beamup',
					version: packageManifest.version,
					'List all protocols': {
						method: 'GET',
						paginated: pagination,
						url: url + 'protocols'
					},
					'List corrections for a protocol': {
						method: 'GET',
						searchParams: { order_by: 'received_at (default), id, done_at' },
						paginated: pagination,
						url: url + 'corrections/{protocol}'
					},
					'See a specific correction': {
						method: 'GET',
						url: url + 'corrections/{protocol}/{id}'
					},
					'Submit a new correction': {
						method: 'POST',
						url: url + 'correction',
						body: Correction.toJsonSchema()
					},
					'Subscribe to corrections': {
						method: 'POST',
						url: url + 'subscriptions',
						body: CreateSubscriptionRequest.toJsonSchema()
					},
					'See a subscription': {
						method: 'GET',
						url: url + 'subscriptions/{id}'
					},
					'Trigger a subscription manually': {
						method: 'POST',
						url: url + 'subscriptions/{id}/trigger',
						body: null
					}
				});
			}
		},
		async '/*'({ url }) {
			baseURL = new URL(url).origin;

			if (new URL(url).pathname.endsWith('/')) {
				return Response.redirect(url.slice(0, -1), 301);
			}

			return Response.json({ error: 'Not found' }, { status: 404 });
		}
	},
	error(error) {
		const validationResponse = (issues: ArkErrors) => {
			return Response.json(
				{
					validation_issues: [...issues.values()].map(({ path, message, actual, expected }) => ({
						path,
						message,
						actual,
						expected
					}))
				},
				{ status: 400 }
			);
		};

		if (error instanceof ArkErrors) {
			return validationResponse(error);
		}

		if (error instanceof TraversalError) {
			return validationResponse(error.arkErrors);
		}

		return Response.json({ error: (error as Error).message ?? 'Unknown error' }, { status: 500 });
	}
});

await startSubscriptionCronJobs({
	ntfyClickUrl: (sub, file) => new URL(`/subscriptions/${sub}/attachments/${file}`, baseURL)
});

const subcounts = Object.entries(await countSubscriptionsByFrequency())
	.map(([freq, count]) => `${c.strong(count)}${c.em(`(${freq[0]})`)}`)
	.join(' / ');

console.info(
	`
BeamUp Server ${c.strong('v' + packageManifest.version)} · ${c.em(packageManifest.homepage)}
Using Bun ${c.em(Bun.version_with_sha)}
Started cron jobs for ${subcounts} subscriptions
Accepting requests from ${c.strong(Bun.env.ALLOWED_ORIGINS || '*')}
Database ${c.em(Bun.env.DB_FILE_NAME)} has ${c.strong(await db.$count(corrections))} corrections
Attachments go to ${c.em(`${Bun.env.S3_ENDPOINT}`)} on bucket ${c.strong(Bun.env.S3_BUCKET)}
Mails go to ${c.em(`smtp://${Bun.env.SMTP_HOST}:${Bun.env.SMTP_PORT}`)} from ${c.strong(Bun.env.MAILS_FROM)}
Listening on ${c.strong(':' + port)} in ${c.boolean(Bun.env.PROD, 'development', 'production')} mode
`
);
