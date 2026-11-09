CREATE TABLE `worker_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
