import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as migrator from 'drizzle-orm/bun-sqlite/migrator';
import * as c from './src/console.js';

export async function migrate(dbFile: string, { quiet = false } = {}) {
	Bun.env.DB_FILE_NAME = dbFile;
	if (!quiet) console.info(`Migrating ${c.strong(dbFile)}`);

	const sqlite = new Database(dbFile);
	const db = drizzle(sqlite);
	migrator.migrate(db, { migrationsFolder: './drizzle' });
}

if (import.meta.main) {
	await migrate(Bun.env.DB_FILE_NAME);
}
