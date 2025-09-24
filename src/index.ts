import { ArkErrors, TraversalError } from 'arktype';
import { desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import packageManifest from '../package.json' with { type: 'json' };
import * as c from './console.js';
import { CorsedResponse as Response } from './cors.js';
import { db } from './database.js';
import * as tables from './tables.js';
import {
	Correction,
	corrections,
	metadataAlts,
	metadataValues,
	SendCorrectionsRequest
} from './tables.js';
import { omit, uniqueBy } from './utils.js';

const port = process.argv[2] ? parseInt(process.argv[2]) : 3000;

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
							received_at: new Date().toISOString(),
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
			async GET({ params, url }) {
				return Response.json(
					await db
						.select()
						.from(corrections)
						.where(eq(corrections.protocol_id, params.protocol))
						.orderBy(desc(corrections.received_at))
						.then((rows) =>
							rows.map(({ id, before: _, after: __, ...correction }) => ({
								id,
								details_url: new URL(`/corrections/${params.protocol}/${id}`, url).toString(),
								...correction
							}))
						)
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

						const unflatten = (
							values: typeof row.before_values,
							alternatives: typeof row.before_alternatives
						) => ({
							...omit(values, 'id'),
							alternatives: omit(alternatives, 'id', 'metadata_value_id') ?? []
						});

						return {
							...row.corrections,
							before: unflatten(row.before_values, row.before_alternatives),
							after: unflatten(row.after_values, row.after_alternatives)
						};
					});

				if (!data) return Response.json({ error: 'Not found' }, { status: 404 });

				return Response.json(data);
			}
		},
		'/protocols': {
			async GET({ url }) {
				// Otherwise we get a single group with null count when there is no correction at all
				const count = await db.$count(corrections);
				if (!count) return Response.json([]);

				return Response.json(
					await db
						.select({
							id: corrections.protocol_id,
							corrections_count: sql<number>`cast(count(${corrections.protocol_id}) as int)`
						})
						.from(corrections)
						.orderBy(corrections.protocol_id)
						.then((protocols) => {
							return uniqueBy(protocols, (p) => p.id).map((protocol) => ({
								corrections_url: new URL(`/corrections/${protocol.id}`, url).toString(),
								...protocol
							}));
						})
				);
			}
		},
		'/': {
			async GET({ url }) {
				return Response.json({
					'This is': 'BeamUp API for CIGALE, https://github.com/cigaleapp/beamup',
					'List all protocols': {
						method: 'GET',
						url: url + 'protocols'
					},
					'List corrections for a protocol': {
						method: 'GET',
						url: url + 'corrections/{protocol}'
					},
					'See a specific correction': {
						method: 'GET',
						url: url + 'corrections/{protocol}/{id}'
					},
					'Submit a new correction': {
						url: url + 'correction',
						method: 'POST',
						body: Correction.toJsonSchema()
					}
				});
			}
		},
		async '/*'({ url }) {
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

console.info(
	`
BeamUp Server ${c.strong('v' + packageManifest.version)} · ${c.em(packageManifest.homepage)}
Using Bun ${c.em(Bun.version_with_sha)}
Accepting requests from ${c.strong(Bun.env.ALLOWED_ORIGINS || '*')}
Database ${c.em(Bun.env.DB_FILE_NAME)} has ${c.strong(await db.$count(corrections))} corrections
Listening on ${c.strong(':' + port)} in ${c.boolean(Bun.env.PROD, 'development', 'production')} mode
`
);
