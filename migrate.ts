import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as c from './src/console.js';

console.info(`Running with database ${c.strong(Bun.env.DB_FILE_NAME)}`);

const sqlite = new Database(Bun.env.DB_FILE_NAME);
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: './drizzle' });
