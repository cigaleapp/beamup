import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { cli } from './src/utils';

console.info(`Running with database ${cli.strong(Bun.env.DB_FILE_NAME)}`);

const sqlite = new Database(Bun.env.DB_FILE_NAME);
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: './drizzle' });
