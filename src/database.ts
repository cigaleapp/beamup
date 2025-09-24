import { Database } from 'bun:sqlite';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';

export const db = drizzle(new Database(Bun.env.DB_FILE_NAME));
