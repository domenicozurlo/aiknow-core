CREATE TABLE `irrifarm_identity` (
	`user_id` text PRIMARY KEY NOT NULL,
	`irrifarm_user_id` integer NOT NULL,
	`username` text NOT NULL,
	`client_id` integer NOT NULL,
	`client_level` integer NOT NULL,
	`user_role` text,
	`reg_id` text,
	`mbo_sns` text DEFAULT '[]' NOT NULL,
	`last_validated_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `irrifarm_identity_irrifarm_user_id_unique` ON `irrifarm_identity` (`irrifarm_user_id`);--> statement-breakpoint
CREATE INDEX `irrifarm_identity_username_idx` ON `irrifarm_identity` (`username`);