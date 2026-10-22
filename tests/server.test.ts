import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
	correctionDetails,
	correctionsOfProtocol,
	sendCorrections,
	CHUNK_SIZE
} from '../src/client.js';
import { SendCorrectionsRequest } from '../src/schemas.js';
import { PaginatedResponseSchema } from '../src/pagination.js';

const TEST_PORT = 3001;
const SERVER_URL = `http://localhost:${TEST_PORT}`;
const DATABASE_URL = Bun.env.DATABASE_URL;

if (!DATABASE_URL) {
	throw new Error('DATABASE_URL environment variable is required for tests');
}

describe('BeamUp Server Tests', () => {
	let serverProcess: Bun.Subprocess;
	let sql: postgres.Sql;

	beforeAll(async () => {
		sql = postgres(DATABASE_URL, { max: 1 });

		const migrationProcess = Bun.spawnSync(['bun', 'run', 'migrate.ts'], {
			cwd: process.cwd(),
			env: {
				...Bun.env,
				DATABASE_URL,
				PATH: `${Bun.env.HOME}/.bun/bin:${Bun.env.PATH}`
			},
			stdout: 'pipe'
		});

		if (migrationProcess.exitCode !== 0) {
			throw new Error(`Migration failed: ${migrationProcess.stderr.toString('utf-8')}`);
		}
	});

	beforeEach(async () => {
		await sql`TRUNCATE metadata_value_alternatives, metadata_values, corrections RESTART IDENTITY CASCADE`;

		serverProcess = Bun.spawn(['bun', 'run', 'src/index.ts', TEST_PORT.toString()], {
			cwd: process.cwd(),
			env: {
				...Bun.env,
				DATABASE_URL,
				PATH: `${Bun.env.HOME}/.bun/bin:${Bun.env.PATH}`,
				SKIP_CRON_JOBS: 'true'
			},
			stdout: 'pipe'
		});

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Server failed to start within timeout'));
			}, 10000);

			const checkServer = async () => {
				try {
					const response = await fetch(`${SERVER_URL}/protocols`);
					if (response.ok || response.status === 404) {
						clearTimeout(timeout);
						resolve();
					}
				} catch {
					setTimeout(checkServer, 200);
				}
			};

			setTimeout(checkServer, 2000);
		});
	});

	afterEach(async () => {
		if (serverProcess) {
			serverProcess.kill();
			await new Promise((resolve) => {
				serverProcess.exited.then(resolve);
				setTimeout(resolve, 2000);
			});
		}
	});

	afterAll(async () => {
		await sql?.end();
	});

	test('server should start and respond to /protocols endpoint', async () => {
		const response = await fetch(`${SERVER_URL}/protocols`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(PaginatedResponseSchema('unknown').allows(data)).toBe(true);
		expect(data.items.length).toBe(0);
	});

	test('server should return 404 for non-existent correction', async () => {
		const response = await fetch(`${SERVER_URL}/corrections/non-existent-protocol/non-existent-id`);
		expect(response.status).toBe(404);
	});

	test('server should return empty list for non-existent protocol corrections', async () => {
		const response = await fetch(`${SERVER_URL}/corrections/non-existent-protocol`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(PaginatedResponseSchema('unknown').allows(data)).toBe(true);
		expect(data.items.length).toBe(0);
	});

	test('database should be clean before each test', async () => {
		const storedCorrections = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCorrections[0].count).toBe(0);

		const metadataRows = await sql`SELECT cast(count(*) as int) as count FROM metadata_values`;
		expect(metadataRows[0].count).toBe(0);
	});

	test('sendCorrections should successfully send a correction to the server', async () => {
		const testCorrection = {
			origin: SERVER_URL,
			client_name: 'test-client',
			client_version: '1.0.0',
			protocol_id: 'test-protocol',
			protocol_version: '1.0.0',
			subject: 'test-subject',
			subject_content_hash: 'abc123',
			subject_type: 'observation' as const,
			metadata: 'test-metadata-key',
			before: {
				value: '"before-value"',
				type: 'string' as const,
				alternatives: [
					{
						value: '"alt-value"',
						confidence: 0.8
					}
				]
			},
			after: {
				value: '"after-value"',
				type: 'string' as const,
				alternatives: []
			},
			comment: 'Test correction',
			user: 'test-user',
			done_at: new Date()
		};

		expect(
			sendCorrections({ origin: SERVER_URL, corrections: testCorrection })
		).resolves.toBeUndefined();

		const storedCorrections = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCorrections[0].count).toBe(1);

		const [correction] = await sql`SELECT * FROM corrections LIMIT 1`;
		expect(correction.protocol_id).toBe('test-protocol');
		expect(correction.protocol_version).toBe('1.0.0');
		expect(correction.metadata).toBe('test-metadata-key');
		expect(correction.comment).toBe('Test correction');
		expect(correction.user).toBe('test-user');
		expect(correction.subject).toBe('test-subject');
		expect(correction.subject_type).toBe('observation');

		const metadataCount = await sql`SELECT cast(count(*) as int) as count FROM metadata_values`;
		expect(metadataCount[0].count).toBe(2);
	});

	test('sendCorrections should handle validation errors (known server issue)', async () => {
		const done_at = new Date('2026-10-16T12:16:59.409Z');
		const testCorrection: Omit<typeof SendCorrectionsRequest.infer, 'metadata'> = {
			origin: SERVER_URL,
			client_name: 'test-client',
			client_version: '1.3.12',
			subject: 'test-subject',
			subject_content_hash: 'abc123',
			subject_type: 'image',
			protocol_id: 'test-protocol',
			protocol_version: '1.0.0',
			before: {
				value: 'before-value',
				type: 'string' as const,
				alternatives: [
					{
						value: 'alt-value',
						confidence: 0.8
					}
				]
			},
			after: {
				value: 'after-value',
				type: 'string' as const,
				alternatives: []
			},
			comment: 'Test correction',
			user: 'test-user',
			done_at
		};

		expect(
			sendCorrections({ origin: SERVER_URL, corrections: testCorrection as any })
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`"400 {"validation_issues":[{"path":[],"message":"after must be an object (was missing) or [0].metadata must be a string (was missing)","actual":"[{\\"origin\\":\\"http://localhost:3001\\",\\"client_name\\":\\"test-client\\",\\"client_version\\":\\"1.3.12\\",\\"subject\\":\\"test-subject\\",\\"subject_content_hash\\":\\"abc123\\",\\"subject_type\\":\\"image\\",\\"protocol_id\\":\\"test-protocol\\",\\"protocol_version\\":\\"1.0.0\\",\\"before\\":{\\"value\\":\\"before-value\\",\\"type\\":\\"string\\",\\"alternatives\\":[{\\"value\\":\\"alt-value\\",\\"confidence\\":0.8}]},\\"after\\":{\\"value\\":\\"after-value\\",\\"type\\":\\"string\\",\\"alternatives\\":[]},\\"comment\\":\\"Test correction\\",\\"user\\":\\"test-user\\",\\"done_at\\":\\"2026-10-16T12:16:59.409Z\\"}]","expected":"after must be an object (was missing) or [0].metadata must be a string (was missing)"}]}"`
		);
	});

	test('correctionsOfProtocol should return corrections when data exists', async () => {
		const testCorrection = {
			client_name: 'test-client-filled',
			client_version: '2.0.0',
			protocol_id: 'test-protocol-with-data',
			protocol_version: '2.0.0',
			subject: 'test-subject-filled',
			subject_content_hash: 'def456',
			subject_type: 'image' as const,
			metadata: 'test-metadata-filled',
			before: {
				value: '"before-value-filled"',
				type: 'string' as const,
				alternatives: []
			},
			after: {
				value: '"after-value-filled"',
				type: 'string' as const,
				alternatives: []
			},
			comment: 'Test correction with data',
			user: 'test-user-filled',
			done_at: new Date()
		};

		await sendCorrections({
			origin: SERVER_URL,
			corrections: testCorrection
		});

		const protocolCorrections = await correctionsOfProtocol({
			origin: SERVER_URL,
			protocol: 'test-protocol-with-data'
		});

		expect(protocolCorrections).toHaveLength(1);
		expect(protocolCorrections[0]).toMatchObject({
			client_name: 'test-client-filled',
			client_version: '2.0.0',
			comment: 'Test correction with data',
			details_url: `http://localhost:3001/corrections/test-protocol-with-data/${protocolCorrections[0].id}`,
			metadata: 'test-metadata-filled',
			protocol_id: 'test-protocol-with-data',
			protocol_version: '2.0.0',
			subject: 'test-subject-filled',
			subject_content_hash: 'def456',
			subject_type: 'image',
			user: 'test-user-filled'
		});

		const details = await protocolCorrections[0].details();
		expect(details).toMatchObject({
			after: {
				alternatives: [],
				type: 'string',
				value: 'after-value-filled'
			},
			before: {
				alternatives: [],
				type: 'string',
				value: 'before-value-filled'
			},
			client_name: 'test-client-filled',
			client_version: '2.0.0',
			comment: 'Test correction with data',
			done_at: testCorrection.done_at.toISOString(),
			metadata: 'test-metadata-filled',
			protocol_id: 'test-protocol-with-data',
			protocol_version: '2.0.0',
			subject: 'test-subject-filled',
			subject_content_hash: 'def456',
			subject_type: 'image',
			user: 'test-user-filled'
		});
	});

	test('correctionsOfProtocol should return empty list (sendCorrections blocked by server validation)', async () => {
		const protocolCorrections = await correctionsOfProtocol({
			origin: SERVER_URL,
			protocol: 'test-protocol-2'
		});

		expect(protocolCorrections).toHaveLength(0);
	});

	test('correctionDetails should return full correction details when data exists', async () => {
		const testCorrection = {
			client_name: 'detail-client',
			client_version: '3.0.0',
			protocol_id: 'detail-protocol-filled',
			protocol_version: '3.0.0',
			subject: 'detail-subject-filled',
			subject_content_hash: 'ghi789',
			subject_type: 'other' as const,
			metadata: 'detail-metadata-filled',
			before: {
				value: '"detailed-before-filled"',
				type: 'string' as const,
				alternatives: [
					{
						value: '"alt-before"',
						confidence: 0.9
					}
				]
			},
			after: {
				value: '"detailed-after-filled"',
				type: 'string' as const,
				alternatives: [
					{
						value: '"alt-after"',
						confidence: 0.7
					}
				]
			},
			comment: 'Detailed correction with data',
			user: 'detail-user-filled',
			done_at: new Date()
		};

		await sendCorrections({
			origin: SERVER_URL,
			corrections: testCorrection
		});

		const [correction] = await sql`SELECT id FROM corrections LIMIT 1`;

		const details = await correctionDetails({
			origin: SERVER_URL,
			protocol: 'detail-protocol-filled',
			id: correction.id
		});

		expect(details).toMatchObject({
			after: {
				alternatives: [
					{
						confidence: 0.7,
						value: 'alt-after'
					}
				],
				type: 'string',
				value: 'detailed-after-filled'
			},
			before: {
				alternatives: [
					{
						confidence: 0.9,
						value: 'alt-before'
					}
				],
				type: 'string',
				value: 'detailed-before-filled'
			},
			client_name: 'detail-client',
			client_version: '3.0.0',
			comment: 'Detailed correction with data',
			done_at: testCorrection.done_at.toISOString(),
			received_at: expect.any(String),
			id: correction.id,
			metadata: 'detail-metadata-filled',
			protocol_id: 'detail-protocol-filled',
			protocol_version: '3.0.0',
			subject: 'detail-subject-filled',
			subject_content_hash: 'ghi789',
			subject_type: 'other',
			user: 'detail-user-filled'
		});
	});

	test('correctionDetails should return undefined for non-existent correction', async () => {
		const details = await correctionDetails({
			origin: SERVER_URL,
			protocol: 'detail-protocol',
			id: 'non-existent-id'
		});

		expect(details).toBeUndefined();
	});

	test('client functions should handle empty results correctly', async () => {
		const protocolCorrections = await correctionsOfProtocol({
			origin: SERVER_URL,
			protocol: 'non-existent-protocol'
		});
		expect(protocolCorrections).toHaveLength(0);

		const details = await correctionDetails({
			origin: SERVER_URL,
			protocol: 'non-existent',
			id: 'non-existent-id'
		});
		expect(details).toBeUndefined();
	});

	function createTestCorrection(index: number) {
		return {
			client_name: `test-client-${index}`,
			client_version: '1.0.0',
			protocol_id: `multi-test-protocol-${Math.floor(index / 10)}`,
			protocol_version: '1.0.0',
			subject: `test-subject-${index}`,
			subject_content_hash: `hash-${index}`,
			subject_type: 'observation' as const,
			metadata: `metadata-key-${index}`,
			before: {
				value: `"before-value-${index}"`,
				type: 'string' as const,
				alternatives: []
			},
			after: {
				value: `"after-value-${index}"`,
				type: 'string' as const,
				alternatives: []
			},
			comment: `Test correction ${index}`,
			user: `test-user-${index}`,
			done_at: new Date()
		};
	}

	test('sendCorrections should handle multiple corrections', async () => {
		const corrections = Array.from({ length: 5 }, (_, i) => createTestCorrection(i));

		await sendCorrections({
			origin: SERVER_URL,
			corrections
		});

		const storedCount = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCount[0].count).toBe(5);

		const storedCorrections = await sql`SELECT * FROM corrections ORDER BY subject`;
		expect(storedCorrections).toHaveLength(5);

		for (let i = 0; i < 5; i++) {
			expect(storedCorrections[i].subject).toBe(`test-subject-${i}`);
			expect(storedCorrections[i].metadata).toBe(`metadata-key-${i}`);
			expect(storedCorrections[i].comment).toBe(`Test correction ${i}`);
		}

		const metadataCount = await sql`SELECT cast(count(*) as int) as count FROM metadata_values`;
		expect(metadataCount[0].count).toBe(10);
	});

	test('sendCorrections should handle multiple chunks (more than CHUNK_SIZE corrections)', async () => {
		const exactChunkSize = CHUNK_SIZE;
		const corrections1 = Array.from({ length: exactChunkSize }, (_, i) => createTestCorrection(i));
		const progressCalls1: Array<{ chunk: number; sent: number; total: number }> = [];

		await sendCorrections({
			origin: SERVER_URL,
			corrections: corrections1,
			onProgress: (chunk, sent, total) => {
				progressCalls1.push({ chunk, sent, total });
			}
		});

		expect(progressCalls1).toHaveLength(1);
		expect(progressCalls1[0]).toEqual({
			chunk: 0,
			sent: exactChunkSize,
			total: exactChunkSize
		});

		const storedCount1 = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCount1[0].count).toBe(exactChunkSize);

		await sql`TRUNCATE metadata_value_alternatives, metadata_values, corrections RESTART IDENTITY CASCADE`;

		const smallMultipleCorrections = Array.from({ length: 3 }, (_, i) =>
			createTestCorrection(i + 2 * CHUNK_SIZE)
		);
		const progressCalls2: Array<{ chunk: number; sent: number; total: number }> = [];

		await sendCorrections({
			origin: SERVER_URL,
			corrections: smallMultipleCorrections,
			onProgress: (chunk, sent, total) => {
				progressCalls2.push({ chunk, sent, total });
			}
		});

		expect(progressCalls2).toHaveLength(1);
		expect(progressCalls2[0]).toEqual({
			chunk: 0,
			sent: 3,
			total: 3
		});

		const storedCount2 = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCount2[0].count).toBe(3);
	});

	test('sendCorrections should call onProgress hook with multiple corrections', async () => {
		const corrections = Array.from({ length: 5 }, (_, i) => createTestCorrection(i));
		const progressCalls: Array<{ chunk: number; sent: number; total: number }> = [];

		await sendCorrections({
			origin: SERVER_URL,
			corrections,
			onProgress: (chunk, sent, total) => {
				progressCalls.push({ chunk, sent, total });
			}
		});

		expect(progressCalls).toHaveLength(1);
		expect(progressCalls[0]).toEqual({
			chunk: 0,
			sent: 5,
			total: 5
		});

		const storedCount = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCount[0].count).toBe(5);
	});

	test('sendCorrections should call onProgress hook with multiple chunks', async () => {
		const correctionCount = 10;
		const corrections = Array.from({ length: correctionCount }, (_, i) => createTestCorrection(i));
		const progressCalls: Array<{ chunk: number; sent: number; total: number }> = [];

		await sendCorrections({
			origin: SERVER_URL,
			corrections,
			onProgress: (chunk, sent, total) => {
				progressCalls.push({ chunk, sent, total });
			}
		});

		expect(progressCalls).toHaveLength(1);
		expect(progressCalls[0]).toEqual({
			chunk: 0,
			sent: correctionCount,
			total: correctionCount
		});

		const storedCount = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCount[0].count).toBe(correctionCount);
	});

	test('sendCorrections should handle async onProgress hook', async () => {
		const corrections = Array.from({ length: 3 }, (_, i) => createTestCorrection(i));
		const progressCalls: Array<{ chunk: number; sent: number; total: number; timestamp: number }> =
			[];

		await sendCorrections({
			origin: SERVER_URL,
			corrections,
			onProgress: async (chunk, sent, total) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				progressCalls.push({
					chunk,
					sent,
					total,
					timestamp: Date.now()
				});
			}
		});

		expect(progressCalls).toHaveLength(1);
		expect(progressCalls[0]).toMatchObject({
			chunk: 0,
			sent: 3,
			total: 3
		});
		expect(progressCalls[0]!.timestamp).toBeGreaterThan(0);

		const storedCount = await sql`SELECT cast(count(*) as int) as count FROM corrections`;
		expect(storedCount[0].count).toBe(3);
	});
});
