import { sendCorrections } from './src/client';

await sendCorrections({
	origin: 'http://localhost:3000',
	corrections: Array.from({ length: parseInt(process.argv[2] || '1') }, (_, i) => ({
		client_name: 'fill.ts',
		client_version: '0.1.0',
		comment: `Correction ${i + 1}`,
		done_at: new Date().toISOString(),
		metadata: 'auto-filled',
		protocol_id: 'test-protocol',
		protocol_version: '1.0.0',
		subject: 'test',
		subject_type: 'other',
		subject_content_hash: 'sha256:examplehash',
		user: null,
		before: {
			alternatives: [],
			type: 'boolean',
			value: 'false'
		},
		after: {
			alternatives: [],
			type: 'boolean',
			value: 'true'
		}
	}))
});
