import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/tables.ts',
	out: './drizzle',
	dbCredentials: {
		url: Bun.env.DATABASE_URL
	}
});
