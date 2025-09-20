import { sendCorrection } from './src/client';
import protocol from '../cigale/examples/arthropods.cigaleprotocol.light.json' with { type: 'json' };
import { MetadataType } from './src/tables';

const metadata = protocol.metadata['io.github.cigaleapp.arthropods.example.light__species'];

const randomKey = () => Math.floor(Math.random() * metadata.options.length);

const beforeKey = randomKey();
let afterKey = randomKey();
while (afterKey === beforeKey) {
	afterKey = randomKey();
}

await sendCorrection({
	protocol_id: protocol.id,
	protocol_version: protocol.version.toString(),
	metadata: 'io.github.cigaleapp.arthropods.example.light__species',
	before: {
		value: metadata.options[beforeKey]!.key,
		type: metadata.type as typeof MetadataType.infer,
		alternatives: [
			{
				value: metadata.options[afterKey]!.key,
				confidence: Math.random()
			}
		]
	},
	after: {
		value: metadata.options[afterKey]!.key,
		type: metadata.type as typeof MetadataType.infer,
		alternatives: []
	},
	comment: null,
	user: null,
	done_at: new Date().toISOString(),
	sent_at: new Date().toISOString()
});
