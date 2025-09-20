import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'sqlite',
	schema: './src/tables.ts',
	out: './drizzle',
	dbCredentials: {
		url: process.env.DB_FILE_NAME!
	}
});
