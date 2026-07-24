# Agent Notes

## Start Of Work

At the start of a new session, read `docs/HANDOFF.md`, `docs/TODO.md`, and `README.md` as needed, then run `git status --short` before making changes.

## Keep Docs Current

This repo uses `docs/TODO.md` as the shared open-work checklist. When completing
a task, check `docs/TODO.md` before finishing the turn. If the work completed
or invalidated an item, remove it in the same change set when the result can be
recovered readily from the code, tests, Git history, or permanent
documentation. Keep a completed entry only when removing it would lose
important context that cannot be recovered easily. Leave unrelated TODO items
alone.

Keep `docs/HANDOFF.md` current when a change affects current behavior, setup/run commands, verification steps, known tradeoffs, or next-session context. Do not treat `docs/HANDOFF.md` as a permanent rulebook; durable agent workflow rules belong here in `AGENTS.md`.

## What Belongs Where

- `AGENTS.md`: standing instructions for future coding agents.
- `docs/HANDOFF.md`: current project state, recent behavior decisions, known context, and suggested next-session checks.
- `docs/TODO.md`: open task checklist and product/documentation backlog, not a
  changelog of completed work.
- `docs/CODEMAP.md`: human-oriented code navigation guide.
- `docs/deployment/`: deployment runbooks and provider-specific notes.
- `README.md`: user-facing setup, usage, and API documentation.
