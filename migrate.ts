import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { drizzle } from 'drizzle-orm/postgres-js';
import * as c from './src/console.js';

console.info(
	`Running with database ${c.strong(Bun.env.DATABASE_URL?.replace(/\/\/[^@/]+@/, '//***@'))}`
);

const sql = postgres(Bun.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);
await migrate(db, { migrationsFolder: './drizzle' });
await sql.end();
