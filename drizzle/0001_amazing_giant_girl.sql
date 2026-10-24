CREATE TABLE `wa_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`phone` text NOT NULL,
	`phone_id` text NOT NULL,
	`waba_id` text NOT NULL,
	`api_key` text,
	`webhook_secret` text,
	`webhook_id` text,
	`status` text NOT NULL,
	`provider_status` text NOT NULL,
	`updated_at` integer NOT NULL,
	`last_webhook` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wa_connections_id_unique` ON `wa_connections` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wa_connections_phone_unique` ON `wa_connections` (`phone`);--> statement-breakpoint
CREATE TABLE `wa_events` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wa_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`provider_id` text,
	`request_id` text,
	`fingerprint` text,
	`direction` text NOT NULL,
	`type` text NOT NULL,
	`body` text NOT NULL,
	`media` text,
	`status` text NOT NULL,
	`error` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wa_provider_message` ON `wa_messages` (`channel_id`,`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wa_send_request` ON `wa_messages` (`channel_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `wa_thread_messages` ON `wa_messages` (`thread_id`,`at`);--> statement-breakpoint
CREATE TABLE `wa_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`peer` text NOT NULL,
	`name` text NOT NULL,
	`last_inbound` text,
	`last_at` text NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wa_thread_peer` ON `wa_threads` (`channel_id`,`peer`);--> statement-breakpoint
CREATE INDEX `wa_thread_latest` ON `wa_threads` (`channel_id`,`last_at`);