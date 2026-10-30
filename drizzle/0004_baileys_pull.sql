CREATE TABLE `wa_bridge` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`phone` text,
	`qr` text,
	`qr_until` integer,
	`seen_at` integer,
	`command` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wa_bridge_key` ON `wa_bridge` (`key_hash`);--> statement-breakpoint
CREATE TABLE `wa_outbox` (
	`channel_id` text NOT NULL,
	`request_id` text NOT NULL,
	`message_id` text NOT NULL,
	`peer` text NOT NULL,
	`body` text NOT NULL,
	`mime` text,
	`created_at` integer NOT NULL,
	`claimed_at` integer,
	PRIMARY KEY(`channel_id`, `request_id`)
);
