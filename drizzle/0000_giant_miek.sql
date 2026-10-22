CREATE TABLE "corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"client_name" text,
	"client_version" text,
	"protocol_id" text NOT NULL,
	"protocol_version" text NOT NULL,
	"subject" text NOT NULL,
	"subject_content_hash" text,
	"subject_type" text NOT NULL,
	"metadata" text NOT NULL,
	"before_id" text NOT NULL,
	"after_id" text NOT NULL,
	"comment" text,
	"user" text,
	"done_at" text,
	"received_at" text
);
--> statement-breakpoint
CREATE TABLE "metadata_value_alternatives" (
	"metadata_value_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"confidence" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metadata_values" (
	"id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_via" text NOT NULL,
	"ntfy_host" text,
	"ntfy_topic" text,
	"mail_to" text,
	"title_template" text NOT NULL,
	"body_template" text NOT NULL,
	"frequency" text,
	"send_received_after" text,
	"protocol" text NOT NULL,
	"users_glob" text DEFAULT '',
	"users_exclude_glob" text DEFAULT '',
	"metadata_glob" text DEFAULT '',
	"subject_glob" text DEFAULT '',
	"latest_sent_at" text
);
--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_before_id_metadata_values_id_fk" FOREIGN KEY ("before_id") REFERENCES "public"."metadata_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_after_id_metadata_values_id_fk" FOREIGN KEY ("after_id") REFERENCES "public"."metadata_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metadata_value_alternatives" ADD CONSTRAINT "metadata_value_alternatives_metadata_value_id_metadata_values_id_fk" FOREIGN KEY ("metadata_value_id") REFERENCES "public"."metadata_values"("id") ON DELETE no action ON UPDATE no action;