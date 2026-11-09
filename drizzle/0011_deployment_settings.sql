CREATE TABLE `deployment_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
