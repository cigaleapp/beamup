declare module 'bun' {
	interface Env {
		DATABASE_URL: string;
		ALLOWED_ORIGINS: string;
		PROD: 'true' | undefined;
		SMTP_HOST: string;
		SMTP_PORT: `${number}`;
		MAILS_FROM: string;
		S3_BUCKET: string;
		S3_ENDPOINT: string;
		S3_ACCESS_KEY_ID: string;
		S3_SECRET_ACCESS_KEY: string;
		/** Should only be used for testing */
		SKIP_CRON_JOBS: 'true' | undefined;
	}
}
