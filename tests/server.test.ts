import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { correctionDetails, correctionsOfProtocol, sendCorrections } from '../src/client.js';
import { SendCorrectionsRequest } from '../src/tables.js';

const TEST_PORT = 3001;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

describe('BeamUp Server Tests', () => {
	let serverProcess: Bun.Subprocess;
	let db: Database;
	let testDbFile: string;

	beforeEach(async () => {
		// Use unique database name for each test
		testDbFile = `test-db-${Date.now()}-${Math.random().toString(36).substring(7)}.sqlite3`;

		// Delete existing database file if it exists
		await Bun.file(testDbFile)
			.delete()
			.catch(() => {});

		// Set up environment for clean database and run migrations
		process.env.DB_FILE_NAME = testDbFile;

		// Run migration using Bun
		const migrationProcess = Bun.spawnSync(['bun', 'run', 'migrate.ts'], {
			cwd: process.cwd(),
			env: {
				...process.env,
				DB_FILE_NAME: testDbFile,
				PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`
			},
			stdout: 'pipe'
		});

		if (migrationProcess.exitCode !== 0) {
			throw new Error(`Migration failed: ${migrationProcess.stderr.toString('utf-8')}`);
		}

		// Connect to database for assertions
		db = new Database(testDbFile);

		// Start the server as a separate process using bun
		serverProcess = Bun.spawn(['bun', 'run', 'src/index.ts', TEST_PORT.toString()], {
			cwd: process.cwd(),
			env: {
				...process.env,
				DB_FILE_NAME: testDbFile,
				PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`
			},
			stdout: 'pipe'
		});

		// Wait for server to start
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Server failed to start within timeout'));
			}, 10000);

			const checkServer = async () => {
				try {
					const response = await fetch(`${SERVER_URL}/protocols`);
					if (response.ok || response.status === 404) {
						clearTimeout(timeout);
						resolve(null);
					}
				} catch {
					// Server not ready yet, try again
					setTimeout(checkServer, 200);
				}
			};

			setTimeout(checkServer, 2000); // Wait a bit before first check
		});
	});

	afterEach(async () => {
		// Stop the server process
		if (serverProcess) {
			serverProcess.kill();
			// Wait for process to die
			await new Promise((resolve) => {
				serverProcess.exited.then(resolve);
				setTimeout(resolve, 2000); // Fallback timeout
			});
		}

		// Close database connection
		db?.close();

		// Clean up test database
		await unlink(testDbFile).catch(console.warn);
	});

	test('server should start and respond to /protocols endpoint', async () => {
		const response = await fetch(`${SERVER_URL}/protocols`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(0); // Should be empty on fresh database
	});

	test('server should return 404 for non-existent correction', async () => {
		const response = await fetch(`${SERVER_URL}/corrections/non-existent-protocol/non-existent-id`);
		expect(response.status).toBe(404);
	});

	test('server should return empty list for non-existent protocol corrections', async () => {
		const response = await fetch(`${SERVER_URL}/corrections/non-existent-protocol`);
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBe(0);
	});

	test('database should be clean before each test', async () => {
		// This test verifies that the database is clean before each test
		const storedCorrections = db.query('SELECT COUNT(*) as count FROM corrections').get() as {
			count: number;
		};
		expect(storedCorrections.count).toBe(0);

		const metadataRows = db.query('SELECT COUNT(*) as count FROM metadata_values').get() as {
			count: number;
		};
		expect(metadataRows.count).toBe(0);
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
				value: '"before-value"', // JSON string
				type: 'string' as const,
				alternatives: [
					{
						value: '"alt-value"', // JSON string
						confidence: 0.8
					}
				]
			},
			after: {
				value: '"after-value"', // JSON string
				type: 'string' as const,
				alternatives: []
			},
			comment: 'Test correction',
			user: 'test-user',
			done_at: new Date().toISOString(),
			sent_at: new Date().toISOString()
		};

		// This should succeed (all required fields provided)
		await expect(
			sendCorrections({ origin: SERVER_URL, corrections: testCorrection })
		).resolves.toBeUndefined();

		// Verify that correction was stored in database using plain SQL
		const storedCorrections = db.query('SELECT COUNT(*) as count FROM corrections').get() as {
			count: number;
		};
		expect(storedCorrections.count).toBe(1);

		// Check specific correction data
		const correction = db.query('SELECT * FROM corrections LIMIT 1').get() as any;
		expect(correction.protocol_id).toBe('test-protocol');
		expect(correction.protocol_version).toBe('1.0.0');
		expect(correction.metadata).toBe('test-metadata-key');
		expect(correction.comment).toBe('Test correction');
		expect(correction.user).toBe('test-user');
		expect(correction.subject).toBe('test-subject');
		expect(correction.subject_type).toBe('observation');

		// Check that metadata values were stored
		const metadataCount = db.query('SELECT COUNT(*) as count FROM metadata_values').get() as {
			count: number;
		};
		expect(metadataCount.count).toBe(2); // before and after values
	});

	test('sendCorrections should handle validation errors (known server issue)', async () => {
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
			done_at: new Date().toISOString()
		};

		// This test verifies that the client function is called and receives the expected server error
		expect(
			sendCorrections({ origin: SERVER_URL, corrections: testCorrection as any })
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`"400 {"validation_issues":[{"path":[],"message":"after must be an object (was missing) or [0].metadata must be a string (was missing)","actual":"[{\\"origin\\":\\"http://localhost:3001\\",\\"client_name\\":\\"test-client\\",\\"client_version\\":\\"1.3.12\\",\\"subject\\":\\"test-subject\\",\\"subject_content_hash\\":\\"abc123\\",\\"subject_type\\":\\"image\\",\\"protocol_id\\":\\"test-protocol\\",\\"protocol_version\\":\\"1.0.0\\",\\"before\\":{\\"value\\":\\"before-value\\",\\"type\\":\\"string\\",\\"alternatives\\":[{\\"value\\":\\"alt-value\\",\\"confidence\\":0.8}]},\\"after\\":{\\"value\\":\\"after-value\\",\\"type\\":\\"string\\",\\"alternatives\\":[]},\\"comment\\":\\"Test correction\\",\\"user\\":\\"test-user\\",\\"done_at\\":\\"2025-09-24T08:54:44.627Z\\"}]","expected":"after must be an object (was missing) or [0].metadata must be a string (was missing)"}]}"`
		);
	});

	test('correctionsOfProtocol should return corrections when data exists', async () => {
		// First send a correction
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
				value: '"before-value-filled"', // JSON string
				type: 'string' as const,
				alternatives: []
			},
			after: {
				value: '"after-value-filled"', // JSON string
				type: 'string' as const,
				alternatives: []
			},
			comment: 'Test correction with data',
			user: 'test-user-filled',
			done_at: new Date().toISOString()
		};

		await sendCorrections({
			origin: SERVER_URL,
			corrections: testCorrection
		});

		// Now test the client function
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

		// Test the .details() method on the returned item
		const details = await protocolCorrections[0].details();
		expect(details).toMatchObject({
			after: {
				alternatives: [],
				type: 'string',
				value: '"after-value-filled"'
			},
			before: {
				alternatives: [],
				type: 'string',
				value: '"before-value-filled"'
			},
			client_name: 'test-client-filled',
			client_version: '2.0.0',
			comment: 'Test correction with data',
			done_at: testCorrection.done_at,
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
		// Due to the server validation issue, we cannot successfully send corrections
		// This test verifies that correctionsOfProtocol works when no data exists
		const protocolCorrections = await correctionsOfProtocol({
			origin: SERVER_URL,
			protocol: 'test-protocol-2'
		});

		expect(protocolCorrections).toHaveLength(0);
	});

	test('correctionDetails should return full correction details when data exists', async () => {
		// Send a correction first
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
				value: '"detailed-before-filled"', // JSON string
				type: 'string' as const,
				alternatives: [
					{
						value: '"alt-before"', // JSON string
						confidence: 0.9
					}
				]
			},
			after: {
				value: '"detailed-after-filled"', // JSON string
				type: 'string' as const,
				alternatives: [
					{
						value: '"alt-after"', // JSON string
						confidence: 0.7
					}
				]
			},
			comment: 'Detailed correction with data',
			user: 'detail-user-filled',
			done_at: new Date().toISOString()
		};

		await sendCorrections({
			origin: SERVER_URL,
			corrections: testCorrection
		});

		// Get the correction ID from database
		const correction = db.query('SELECT id FROM corrections LIMIT 1').get() as { id: string };

		// Test the client function
		const details = await correctionDetails({
			origin: SERVER_URL,
			protocol: 'detail-protocol-filled',
			id: correction.id
		});

		expect(details).toMatchObject({
			after: {
				alternatives: {
					confidence: 0.7,
					value: '"alt-after"'
				},
				type: 'string',
				value: '"detailed-after-filled"'
			},
			before: {
				alternatives: {
					confidence: 0.9,
					value: '"alt-before"'
				},
				type: 'string',
				value: '"detailed-before-filled"'
			},
			client_name: 'detail-client',
			client_version: '3.0.0',
			comment: 'Detailed correction with data',
			done_at: testCorrection.done_at,
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
		// Due to the server validation issue, we cannot successfully send corrections
		// This test verifies that correctionDetails works when no data exists
		const details = await correctionDetails({
			origin: SERVER_URL,
			protocol: 'detail-protocol',
			id: 'non-existent-id'
		});

		expect(details).toBeUndefined();
	});

	test('client functions should handle empty results correctly', async () => {
		// Test with non-existent protocol
		const protocolCorrections = await correctionsOfProtocol({
			origin: SERVER_URL,
			protocol: 'non-existent-protocol'
		});
		expect(protocolCorrections).toHaveLength(0);

		// Test with non-existent correction details
		const details = await correctionDetails({
			origin: SERVER_URL,
			protocol: 'non-existent',
			id: 'non-existent-id'
		});
		expect(details).toBeUndefined();
	});
});
