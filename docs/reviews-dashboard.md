# Reviews and worker A/B tests

`/reviews` is the owner-private Reviews section. `/api/reviews` supports the same stored records. All writes preserve existing tasks and staff profiles. The existing owner-private Sites access boundary applies. MCP exposes `list_worker_reviews` and `record_worker_review` using the same handlers; connected tools may need a discovery refresh after publication.

## Storage and rollout

Apply schema-only `drizzle/0007_worker_reviews.sql` additively. It creates a JSON-backed record table and unique indexes preventing two open reviews per worker and two active tests for a worker kind. Run `npm run db:generate` when changing schema; the generated snapshot was reconciled to 0007 because prior hand-written migrations 0001–0006 did not update the original Drizzle metadata. No existing tables are recreated. The initial review is imported separately through an explicit idempotent operation. No A/B test is seeded.

## API contract

GET `/api/reviews` returns `records`, `workers`, `tasks`, and `queue`. The queue counts recorded Done tasks not covered by completed review batches. Eligible suggestions appear at five tasks, while actual queued reviews are durable records. Counts can understate history because some accepted work exists only in development notes.

POST `/api/reviews` accepts JSON with `action`:

- `importBaseline`: idempotently imports the verified 2026-11-07 Hacker navigation-only initial review from worker memory. It excludes that task from the next review cycle. No historical character sheet is invented.
- `queue`, `workerId`: requires five accepted tasks and no open review; freezes task evidence and full profile/memory.
- `review`, `id`, `updatedAt`, `status`, `summary`: transitions Queued → In review → Completed, with a written finding. Completed records are immutable. A later review excludes the exact task IDs covered by earlier completed batches, avoiding ambiguous backfilled dates.
- `test`, `workerId`, `challengerId`, `workerKind`, `hypothesis`: requires two different existing active workers and no active test for that kind; freezes both full character sheets and memories. It does not create or launch workers.
- `evidence`, `id`, `updatedAt`, `taskA`, `taskB`, `rationale`: enrolls distinct worker-owned task records as a matched pair. Neither task can be reused in the test. Records are frozen at enrollment; do not enroll unfinished cases expecting automatic future updates. Matching notes must distinguish live/shadow work, config matches or mismatches, rubric outcomes, and limitations. These retrospective tasks are not automatically verified as having used the frozen configurations.
- `finishTest`, `id`, `updatedAt`, `conclusion`: closes an active test with evidence, uncertainty and a rollback/retention decision. It never retires workers or changes their instructions.

Updates use optimistic concurrency; stale versions receive 409. Threshold and lifecycle failures receive 400. GET failure is explicit rather than silently falling back to empty data.

## Stats and interpretation

A/B stats cover only explicitly enrolled task evidence. Accepted/Done counts are recorded task outcomes, not causal success rates. Unknown question/rework history remains unknown with known-task coverage displayed. All elapsed-time comparisons remain unknown because existing task records include backfills without a verified timing-quality flag. Frozen profile differences include every changed nonidentity field, including memory and revision metadata. Names and IDs identify the two versions separately.

The page initially shows no active test until two versions are registered and an actual test is recorded. Five accepted tasks trigger review; they do not establish that a clone is better. Use `docs/worker-evaluation-rubric.md` for the PM/Scientist assessment.

## Checks

- `node --test tests/review-metrics.test.mjs tests/review-api.test.mjs`
- `python3 tests/review-storage.test.py`

API tests run the actual transpiled handlers against isolated fixture storage. SQLite tests separately exercise real migration constraints and preservation; no fake records are written to the real board. PM browser QA covers real baseline import, queue persistence, desktop and mobile layouts. Existing unrelated TypeScript errors remain in `app/memory/page.tsx` (unknown JSON response types).

## Automatic connection (November 8 update)

Task saves now reconcile the review queue on the server after the task is durably saved. The fifth accepted task creates a persistent Queued review without a browser visit. Unique database constraints and a completed-review generation guard make concurrent completions/retries idempotent. Completing a review immediately reconciles any further five-task backlog. GET `/api/reviews` also repairs historical eligibility and retries earlier queue-sync failures. A queue failure does not imply a task save failed: task responses return the saved record plus `reviewSyncWarning`; the Kanban UI displays that warning. Review writes similarly return `syncWarning` when saved but repair is pending.

Queued review batches and character sheets remain frozen. Open reviews additionally display current evidence and warnings for reopened, reassigned, or missing tasks. Completion preserves the original batch and final evidence, and only still-accepted original task IDs become covered. Already completed reviews remain immutable; reopening a previously covered task does not count it as a new task in another cycle. Ambiguous/renamed assignees without a resolvable current worker ID are excluded conservatively and may need record reconciliation.

Active tests have two separate statistics views:

- **Current test executions:** automatically derive from tasks whose dispatch config has the exact frozen worker ID, model, reasoning effort, profile revision and memory revision, and whose start timestamp is at/after test creation. Current assignment must resolve uniquely to that same worker. Earlier tasks, missing snapshots and changed configurations are excluded. This does not infer worker execution from a board assignment or create any work.
- **Matched comparisons:** enrolled task IDs and the matching rationale stay fixed, while task outcomes, known question/rework counts and status follow the current records. Reopened tasks remain pending; missing/reassigned records are explicitly excluded and counted separately. Manual enrollment does not certify an exact configuration match.

Closing a test stores the same current projection returned by GET, including both execution arms and matched outcomes. Subsequent task edits cannot change a completed test. No worker cloning, execution scheduler, worker retirement or instruction updates are added by this change.

The page refreshes every 20 seconds only while visible, and when it regains focus/visibility. One request runs at a time; forced refresh/write invalidates and aborts older requests, and unmount clears requests/listeners/timers. Freshness and stale/sync-error state are visible. Keyed forms preserve typed inputs and their original concurrency token; fresh stats still update during editing. Matching-task options and challenger selections stay stable while those forms are dirty. External record changes cause a stale write to return 409, allowing the user to retain their draft or explicitly discard it and reload.

Tests now execute the actual review/task handlers and queue helper against an isolated SQLite database through Drizzle. They verify fifth-completion queueing without GET, retries, concurrent completions, follow-on review batches, current matched outcomes, strict automatic attribution, reassignment/deletion/reopening, snapshot immutability, final-stat freezing, and the saved-task-plus-sync-warning failure path. No test records are written to the real board.
