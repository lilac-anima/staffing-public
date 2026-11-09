CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Backlog' NOT NULL,
	`blocker` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
