import postgres from 'postgres';
// oxlint-disable-next-line import/extensions
import { drizzle } from 'drizzle-orm/postgres-js';

export const db = drizzle(postgres(Bun.env.DATABASE_URL, { max: 1 }), {
	logger: false
});
