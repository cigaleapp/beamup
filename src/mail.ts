import { createTransport } from 'nodemailer';
import * as c from './console.js';
import { ensureArray } from './utils.js';

const transport = createTransport({
	port: Number(Bun.env.SMTP_PORT),
	host: Bun.env.SMTP_HOST
});

export async function sendMail({
	to,
	cc,
	bcc,
	subject,
	body,
	attachments
}: {
	to: string | string[];
	cc?: string | string[];
	bcc?: string | string[];
	subject: string;
	body: string;
	attachments: File[];
}) {
	if (ensureArray(to).length === 0) return;

	// console.info(
	// 	`Sending mail ${c.em(JSON.stringify(subject))} to ${c.strong(ensureArray(to).join(','))}`,
	// 	{ body, attachments }
	// );
	await transport.sendMail({
		from: Bun.env.MAILS_FROM,
		cc,
		to,
		bcc,
		subject,
		text: body,
		attachments: await Promise.all(
			attachments.map(async (file) => ({
				filename: file.name,
				content: Buffer.from(await file.arrayBuffer()),
				contentType: file.type
			}))
		)
	});
}
