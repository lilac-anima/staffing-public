-- Historical counts from earlier tasks may not have been tracked.
ALTER TABLE tasks ADD COLUMN metrics_history_reviewed INTEGER NOT NULL DEFAULT 0 CHECK (metrics_history_reviewed IN (0, 1));
