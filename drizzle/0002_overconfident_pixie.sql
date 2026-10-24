ALTER TABLE `wa_connections` ADD `provider` text DEFAULT 'ycloud' NOT NULL;--> statement-breakpoint
ALTER TABLE `wa_connections` ADD `verify_token` text;--> statement-breakpoint
ALTER TABLE `wa_connections` ADD `webhook_verified_at` text;--> statement-breakpoint
ALTER TABLE `wa_connections` ADD `subscribed_at` text;--> statement-breakpoint
ALTER TABLE `wa_connections` ADD `meta_last_inbound` text;--> statement-breakpoint
ALTER TABLE `wa_connections` ADD `connection_error` text;