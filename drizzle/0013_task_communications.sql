CREATE TABLE IF NOT EXISTS `task_communications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `task_id` text NOT NULL REFERENCES `tasks`(`id`),
  `kind` text NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `author` text NOT NULL,
  `worker_id` text,
  `run_id` text,
  `payload` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `task_communications_task_id_idx` ON `task_communications` (`task_id`, `id`);
