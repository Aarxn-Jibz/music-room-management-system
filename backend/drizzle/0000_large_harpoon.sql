CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `booking_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`booking_horizon_days` integer NOT NULL,
	`min_booking_duration_minutes` integer NOT NULL,
	`max_booking_duration_minutes` integer NOT NULL,
	`booking_interval_minutes` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reason` text,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `operating_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `booking_policies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#4F46E5' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`number` integer,
	`created_at` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`policy_id` text,
	`priority_profile_id` text,
	FOREIGN KEY (`policy_id`) REFERENCES `booking_policies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`priority_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_release_day` integer NOT NULL,
	`booking_release_time` text NOT NULL,
	`default_policy_id` text NOT NULL,
	FOREIGN KEY (`default_policy_id`) REFERENCES `booking_policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	PRIMARY KEY(`profile_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_policies_name_unique` ON `booking_policies` (`name`);--> statement-breakpoint
CREATE INDEX `bookings_room_time_idx` ON `bookings` (`room_id`,`start_time`,`end_time`);--> statement-breakpoint
CREATE INDEX `bookings_profile_idx` ON `bookings` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_room_start_unique` ON `bookings` (`room_id`,`start_time`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_name_unique` ON `rooms` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_number_unique` ON `rooms` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);