CREATE TABLE `work_log_quality` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `task_work_log` ADD `worker_id` text;--> statement-breakpoint
ALTER TABLE `task_work_log` ADD `run_id` text;--> statement-breakpoint
ALTER TABLE `task_work_log` ADD `attribution` text DEFAULT 'legacy-unknown' NOT NULL;