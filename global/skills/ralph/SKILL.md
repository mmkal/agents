---
name: ralph-loop
description: Set up and run Ralph autonomous loops with PRD/progress, nohup, and gpt-5.2-codex.
---

# Ralph Loop

Use this skill when user says “run Ralph” or wants an autonomous loop for a task without referencing `ralph.ignoreme`.

## Setup

1. Create a new folder: `ralph-<task>.ignoreme/` in repo root.
2. Add files:
   - `CLAUDE.md` (agent instructions)
   - `prd.json` (stories + branchName)
   - `progress.txt` (log + codebase patterns)
   - `ralph.sh` (loop runner)

## ralph.sh baseline

- Use `opencode run` with **model `openai/gpt-5.2-codex`**.
- Set `OPENCODE_PERMISSION` to allow all.
- Read `CLAUDE.md`, `prd.json`, `progress.txt`.
- Stop on `<promise>COMPLETE</promise>` or when all `passes: true`.

## CLAUDE.md baseline

- Read `AGENTS.md` + app-specific AGENTS.
- Check out/create `branchName`.
- Implement highest priority story with `passes: false`.
- Run `pnpm typecheck && pnpm lint`.
- Commit + push each iteration.
- Update `prd.json` (set `passes: true`).
- Append `progress.txt` entry with learnings.

## Run

```bash
nohup ./ralph-<task>.ignoreme/ralph.sh --tool opencode 20 > ralph-<task>.ignoreme/ralph.log 2>&1 &
```

Monitor: `tail -n 200 ralph-<task>.ignoreme/ralph.log`

Stop: `pkill -f ralph-<task>.ignoreme/ralph.sh`

## Branching

- Always start from a clean base commit.
- Use a **new branch name** for each redo.
