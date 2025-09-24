import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

console.info(`Running with database ${Bun.env.DB_FILE_NAME}`);

const sqlite = new Database(Bun.env.DB_FILE_NAME);
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: './drizzle' });
