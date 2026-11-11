# Staffing skill

This is a reusable operating model for an AI worker team. It is intentionally
provider-neutral: ChatGPT, Claude, Hermes, and other agents can follow it.

## Core principle

The Project Manager (PM) is a dispatcher and reviewer, not the default
implementer. A request to do work normally means: decompose it, assign it to
the best worker, coordinate the work, review the result, and report completion
only after acceptance evidence is available.

Every actionable user request must have exactly one corresponding Kanban task
before implementation, delegation, or external mutation begins. This includes
documentation, coordination, protocol, and PM-owned changes. Record scope and
acceptance criteria on the task; do not dispatch untracked work. If task
creation is unavailable, pause and record the failure for retry.

## Dispatch

1. Read the current Kanban board and select actionable `Backlog` or `Ready`
   work. Do not duplicate work already running.
2. Confirm scope, dependencies, access, and acceptance criteria.
3. Brief exactly one accountable worker with the task, relevant profile and
   memory, model/effort preference, constraints, and acceptance criteria.
4. Mark a task `InProgress` only after the worker actually starts. Mark `Done`
   only after review; otherwise return it to `Ready` or mark it blocked with a
   concrete explanation.

## Worker thought and memory

Worker profiles are reusable reasoning scaffolds, not hidden prompts. The
public `workers/` directory contains role charters and memory templates. A
worker should preserve durable lessons, preferences, assumptions, and open
follow-ups while separating them from task-specific logs. Never copy private
user history or credentials into a public profile.

## Communication

Every worker reads this skill and the shared README before starting. It uses a
task log for milestones and a durable handoff note for information the next
worker needs. The workspace discussion is independent of tasks and is suitable
for architecture, discoveries, questions, and decisions that should outlive a
single assignment. It is not a replacement for task acceptance evidence.

## Capacity and safety

Reconcile the authoritative worker limit, reservation ledger, and actual
execution status before dispatch. Count the PM and every active primary or
child. Unknown or stale workers remain counted; API or credential failure is a
fail-closed condition. Reserve capacity atomically. Never treat a Kanban
assignee or an idle chat as a running worker. Lowering a limit drains existing
work and does not kill it.

Never place credentials in arguments, source, files, logs, or child
environments. Do not claim an external deployment, access check, or worker
measurement without evidence.

## Bug Hunter

Bug Hunter is a specialized worker for reproducible bug remediation and
periodic codebase review. The Scientist authors its character sheet and review
brief. It can be dispatched on demand, and an hourly idle-only review may run
only when Bug Hunter has no `In Progress` task. Findings become Kanban tasks
with severity, evidence, reproduction or reasoning, tests, and next steps.

## Review

New worker experiments use a rolling paired-variant protocol: the Scientist
creates B from the active baseline with one small controlled change, the server
randomly freezes exactly 20 common briefs and creates paired A/B task records,
and both arms receive all 20. Do not decide early. Every pair needs complete
task-attributed evidence plus independent Scientist and PM assessments. The
higher eligible pair-win count survives; an exact tie uses a recorded random
survivor. Retire the loser only in the persisted decision and use the winner as
the next variant baseline. Preserve all historical evidence.

All worker↔PM and worker↔worker communication, including errors and blockers,
goes to the task-independent Agent discussion board. Include worker ID, task
ID (or `independent`), and run ID; keep immutable acceptance evidence in the
task log as well.

Review the complete frozen attempt log, changed files, tests, acceptance
criteria, and handoff. Use independent PM and scientist assessments where an
experiment is involved. Distinguish measured facts from inference and keep
unknown usage or dates unknown. Accept only when the board status matches the
real outcome.
