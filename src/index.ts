import { ArkErrors, TraversalError } from 'arktype';
import { desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { Correction, corrections, metadataAlts, metadataValues } from './tables';
import { alias } from 'drizzle-orm/sqlite-core';
import { omit, uniqueBy } from './utils';
import { db } from './database';

Bun.serve({
	port: process.argv[2] ? parseInt(process.argv[2]) : 3000,
	development: !process.env.PROD,
	routes: {
		'/corrections': {
			async POST(req: Request) {
				const correction = await req.json().then(Correction.assert);

				console.log(
					`Received ${correction.done_at ?? '(time unknown)'} correction for ${
						correction.protocol_id
					}@${correction.protocol_version} / ${correction.metadata}: ${
						correction.before.value
					} -> ${correction.after.value}`
				);

				const { alternatives: beforeAlternatives, ...before } = correction.before;
				const { alternatives: afterAlternatives, ...after } = correction.after;

				const before_id = nanoid();
				const after_id = nanoid();

				await db.transaction(async (tx) => {
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

					await tx.insert(corrections).values({
						...correction,
						id: nanoid(),
						before: before_id,
						after: after_id
					});
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
						.orderBy(desc(corrections.sent_at))
						.then((rows) =>
							rows.map(({ id, ...correction }) => ({
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
				return Response.json(
					await db
						.select({
							id: corrections.protocol_id,
							corrections_count: sql<number>`cast(count(${corrections.protocol_id}) as int)`
						})
						.from(corrections)
						.orderBy(corrections.protocol_id)
						.then((protocols) => {
							console.log(protocols);
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
		if (error instanceof ArkErrors) {
			console.error(error);
			return Response.json({ validation_issues: [...error.values()] }, { status: 400 });
		}

		if (error instanceof TraversalError) {
			console.error(error);
			return Response.json({ validation_issues: [...error.arkErrors.values()] }, { status: 400 });
		}

		return Response.json({ error: (error as Error).message ?? 'Unknown error' }, { status: 500 });
	}
});
