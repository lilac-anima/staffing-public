CREATE TABLE IF NOT EXISTS `workspace_discussions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `project` text DEFAULT 'General' NOT NULL,
  `author` text NOT NULL,
  `worker_id` text,
  `run_id` text,
  `status` text DEFAULT 'open' NOT NULL,
  `body` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `workspace_discussions_project_idx` ON `workspace_discussions` (`project`, `id`);
