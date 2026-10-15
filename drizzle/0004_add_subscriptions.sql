CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_via` text NOT NULL,
	`ntfy_host` text,
	`ntfy_topic` text,
	`mail_to` text,
	`title_template` text NOT NULL,
	`body_template` text NOT NULL,
	`frequency` text,
	`send_received_after` text,
	`protocol` text NOT NULL,
	`users_glob` text DEFAULT '',
	`users_exclude_glob` text DEFAULT '',
	`metadata_glob` text DEFAULT '',
	`subject_glob` text DEFAULT '',
	`latest_sent_at` text
);
