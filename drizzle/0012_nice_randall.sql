CREATE TABLE `worker_activity_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`revision` text NOT NULL,
	`observed_at` text NOT NULL,
	`valid_until` text NOT NULL,
	`active_ids` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `worker_activity_observed_idx` ON `worker_activity_observations` (`observed_at`);
--> statement-breakpoint
CREATE VIEW worker_activity_current AS
 SELECT d.revision, strftime('%Y-%m-%dT%H:%M:%fZ','now') AS observed_at,
 CASE WHEN julianday(json_extract(d.data,'$.inventoryAt')) IS NULL
   OR julianday(json_extract(d.data,'$.inventoryAt')) > julianday('now')
   OR EXISTS (SELECT 1 FROM json_each(d.data,'$.slots') slot
     WHERE json_extract(slot.value,'$.kind')='measured' AND json_extract(slot.value,'$.state')='active'
     AND NOT EXISTS (SELECT 1 FROM worker_runs w WHERE w.id=json_extract(slot.value,'$.runId')
       AND json_extract(w.data,'$.instanceId')=json_extract(slot.value,'$.instanceId')
       AND ((json_extract(w.data,'$.state')='running' AND julianday(json_extract(w.data,'$.heartbeatAt')) IS NOT NULL AND julianday(json_extract(w.data,'$.heartbeatAt'))<=julianday('now'))
         OR (json_extract(w.data,'$.state') IN ('completed','failed','interrupted') AND julianday(json_extract(w.data,'$.endedAt')) IS NOT NULL AND julianday(json_extract(w.data,'$.endedAt'))<=julianday('now')))))
 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now')
 ELSE strftime('%Y-%m-%dT%H:%M:%fZ',min(julianday(json_extract(d.data,'$.inventoryAt'))+120.0/86400.0,
 coalesce((SELECT min(coalesce(julianday(json_extract(value,'$.leaseUntil')),julianday('now'))) FROM json_each(d.data,'$.slots')),9999999.0),
 coalesce((SELECT min(julianday(json_extract(w.data,'$.heartbeatAt'))+15.0/86400.0) FROM json_each(d.data,'$.slots') slot JOIN worker_runs w ON w.id=json_extract(slot.value,'$.runId') AND json_extract(w.data,'$.instanceId')=json_extract(slot.value,'$.instanceId') WHERE json_extract(slot.value,'$.kind')='measured' AND json_extract(slot.value,'$.state')='active' AND json_extract(w.data,'$.state')='running'),9999999.0))) END AS valid_until,
 coalesce((SELECT json_group_array(json_extract(slot.value,'$.instanceId')) FROM json_each(d.data,'$.slots') slot
 WHERE json_extract(slot.value,'$.state')='active' AND (json_extract(slot.value,'$.kind')='native'
 OR (json_extract(slot.value,'$.kind')='measured' AND EXISTS (SELECT 1 FROM worker_runs w WHERE w.id=json_extract(slot.value,'$.runId') AND json_extract(w.data,'$.instanceId')=json_extract(slot.value,'$.instanceId') AND json_extract(w.data,'$.state')='running')))),'[]') AS active_ids
 FROM deployment_settings d WHERE d.id='global';
--> statement-breakpoint
CREATE TRIGGER worker_activity_deployment_settings_insert AFTER INSERT ON deployment_settings BEGIN
 INSERT INTO worker_activity_observations(revision,observed_at,valid_until,active_ids)
 SELECT c.revision,c.observed_at,c.valid_until,c.active_ids FROM worker_activity_current c
 WHERE NOT EXISTS (SELECT 1 FROM worker_activity_observations)
 OR c.active_ids <> (SELECT active_ids FROM worker_activity_observations ORDER BY id DESC LIMIT 1)
 OR ((julianday(c.valid_until)>julianday(c.observed_at)) <> (SELECT julianday(valid_until)>julianday(observed_at) FROM worker_activity_observations ORDER BY id DESC LIMIT 1))
 OR (julianday(c.valid_until)>julianday(c.observed_at) AND (julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1)) <= julianday(c.observed_at)+5.0/86400.0 OR julianday(c.valid_until) < julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1))));
END;
--> statement-breakpoint
CREATE TRIGGER worker_activity_deployment_settings_update AFTER UPDATE ON deployment_settings BEGIN
 INSERT INTO worker_activity_observations(revision,observed_at,valid_until,active_ids)
 SELECT c.revision,c.observed_at,c.valid_until,c.active_ids FROM worker_activity_current c
 WHERE NOT EXISTS (SELECT 1 FROM worker_activity_observations)
 OR c.active_ids <> (SELECT active_ids FROM worker_activity_observations ORDER BY id DESC LIMIT 1)
 OR ((julianday(c.valid_until)>julianday(c.observed_at)) <> (SELECT julianday(valid_until)>julianday(observed_at) FROM worker_activity_observations ORDER BY id DESC LIMIT 1))
 OR (julianday(c.valid_until)>julianday(c.observed_at) AND (julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1)) <= julianday(c.observed_at)+5.0/86400.0 OR julianday(c.valid_until) < julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1))));
END;
--> statement-breakpoint
CREATE TRIGGER worker_activity_worker_runs_insert AFTER INSERT ON worker_runs BEGIN
 INSERT INTO worker_activity_observations(revision,observed_at,valid_until,active_ids)
 SELECT c.revision,c.observed_at,c.valid_until,c.active_ids FROM worker_activity_current c
 WHERE NOT EXISTS (SELECT 1 FROM worker_activity_observations)
 OR c.active_ids <> (SELECT active_ids FROM worker_activity_observations ORDER BY id DESC LIMIT 1)
 OR ((julianday(c.valid_until)>julianday(c.observed_at)) <> (SELECT julianday(valid_until)>julianday(observed_at) FROM worker_activity_observations ORDER BY id DESC LIMIT 1))
 OR (julianday(c.valid_until)>julianday(c.observed_at) AND (julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1)) <= julianday(c.observed_at)+5.0/86400.0 OR julianday(c.valid_until) < julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1))));
END;
--> statement-breakpoint
CREATE TRIGGER worker_activity_worker_runs_update AFTER UPDATE ON worker_runs BEGIN
 INSERT INTO worker_activity_observations(revision,observed_at,valid_until,active_ids)
 SELECT c.revision,c.observed_at,c.valid_until,c.active_ids FROM worker_activity_current c
 WHERE NOT EXISTS (SELECT 1 FROM worker_activity_observations)
 OR c.active_ids <> (SELECT active_ids FROM worker_activity_observations ORDER BY id DESC LIMIT 1)
 OR ((julianday(c.valid_until)>julianday(c.observed_at)) <> (SELECT julianday(valid_until)>julianday(observed_at) FROM worker_activity_observations ORDER BY id DESC LIMIT 1))
 OR (julianday(c.valid_until)>julianday(c.observed_at) AND (julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1)) <= julianday(c.observed_at)+5.0/86400.0 OR julianday(c.valid_until) < julianday((SELECT valid_until FROM worker_activity_observations ORDER BY id DESC LIMIT 1))));
END;
--> statement-breakpoint
CREATE TRIGGER worker_activity_no_update BEFORE UPDATE ON worker_activity_observations BEGIN SELECT RAISE(ABORT,'activity history is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER worker_activity_no_delete BEFORE DELETE ON worker_activity_observations BEGIN SELECT RAISE(ABORT,'activity history is append-only'); END;
