# Development guide

This repository contains a provider-neutral Staffing board and worker-team
operating model. Do not commit credentials, local runtime state, task exports,
private deployment URLs, or user-specific worker memories.

## Local development

Install dependencies with `npm ci`, then run `npm run dev`. Local preview data
is separate from hosted data. Use the project's normal migration commands when
working with the local D1 database, and never treat a local board as proof of
hosted state.

## Public worker model

Start with `worker-comms/STAFFING_SKILL.md` and the role templates in
`workers/`. Copy a template into a private deployment or private memory store
before adding user-specific context. Keep task logs separate from durable
worker memory.

## Read-only board check

`scripts/kanban_board_check.py` reports board state without dispatching workers
or waking a conversation. Supply the board endpoint and credential through
environment variables or an OS credential store; never put them in source.
