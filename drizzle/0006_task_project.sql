-- Preserve all existing tasks and assign them to the default project.
ALTER TABLE tasks ADD COLUMN project text NOT NULL DEFAULT 'General';
