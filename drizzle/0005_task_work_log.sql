-- Additive: existing tasks start with no work-log entries.
CREATE TABLE task_work_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX task_work_log_task_id_id ON task_work_log(task_id, id);
