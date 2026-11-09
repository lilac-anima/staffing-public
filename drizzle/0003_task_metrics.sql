-- Additive migration: existing task and worker memory records are retained.
ALTER TABLE tasks ADD COLUMN started_at TEXT;
ALTER TABLE tasks ADD COLUMN first_delivered_at TEXT;
ALTER TABLE tasks ADD COLUMN accepted_at TEXT;
ALTER TABLE tasks ADD COLUMN necessary_questions INTEGER NOT NULL DEFAULT 0 CHECK (necessary_questions >= 0);
ALTER TABLE tasks ADD COLUMN avoidable_questions INTEGER NOT NULL DEFAULT 0 CHECK (avoidable_questions >= 0);
ALTER TABLE tasks ADD COLUMN rework_rounds INTEGER NOT NULL DEFAULT 0 CHECK (rework_rounds >= 0);
ALTER TABLE tasks ADD COLUMN config_snapshot TEXT;
