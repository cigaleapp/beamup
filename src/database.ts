import { Database } from 'bun:sqlite';
// oxlint-disable-next-line import/extensions
import { drizzle } from 'drizzle-orm/bun-sqlite';

export const db = drizzle(new Database(Bun.env.DB_FILE_NAME));
