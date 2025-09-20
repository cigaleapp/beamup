CREATE TABLE `corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`protocol_id` text NOT NULL,
	`protocol_version` text NOT NULL,
	`metadata` text NOT NULL,
	`before_id` text NOT NULL,
	`after_id` text NOT NULL,
	`comment` text,
	`user` text,
	`done_at` text,
	`sent_at` text,
	FOREIGN KEY (`before_id`) REFERENCES `metadata_values`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_id`) REFERENCES `metadata_values`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `metadata_value_alternatives` (
	`metadata_value_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`confidence` real NOT NULL,
	FOREIGN KEY (`metadata_value_id`) REFERENCES `metadata_values`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `metadata_values` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text NOT NULL
);
