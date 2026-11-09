CREATE TABLE IF NOT EXISTS worker_reviews (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL,
 worker_id TEXT NOT NULL,
 status TEXT NOT NULL,
 data TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_worker_review ON worker_reviews(worker_id) WHERE kind = 'review' AND status IN ('Queued', 'In review');
CREATE UNIQUE INDEX IF NOT EXISTS one_active_worker_test ON worker_reviews(worker_id) WHERE kind = 'test' AND status = 'Active';
CREATE UNIQUE INDEX IF NOT EXISTS one_active_worker_kind ON worker_reviews(lower(trim(json_extract(data, '$.workerKind')))) WHERE kind = 'test' AND status = 'Active';
