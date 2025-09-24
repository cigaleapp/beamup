declare module 'bun' {
	interface Env {
		DB_FILE_NAME: string;
		ALLOWED_ORIGINS: string;
		PROD: 'true' | undefined;
	}
}
