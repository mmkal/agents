---
name: session-monitor
description: Runs local scheduled reminders that resume saved agent sessions from a gitignored monitor.yml file. Use when asked to monitor, watch, remind, keep checking, or follow up later from an existing Codex/Claude/opencode session.
---

# Session Monitor

Use this skill when a user asks for a local monitor that should wake an existing agent session later. The monitor is intentionally generic: it does not know about PRs, CI, Slack, or review comments. The resumed session owns that context.

## Quick Start

Create or edit repo-root `monitor.yml`:

```yaml
monitors:
  - id: agents-1234
    session:
      tool: codex
      id: 019eef99-b1e2-7910-8dd3-1da7fd723e02
      adapter: codex-exec-resume
      cwd: /Users/mmkal/src/worktrees/agents/local-pr-monitor-loop
    schedule:
      cron: "5 * * * *"
      expires_at: 2026-06-23T12:00:00Z
    logs: []
```

Start the local runner:

```bash
~/.codex/skills/session-monitor/scripts/session-monitor.sh start
```

Check it:

```bash
~/.codex/skills/session-monitor/scripts/session-monitor.sh status
```

## Rules

- Only say a monitor is running when `status` shows the singleton runner is alive.
- Keep `monitor.yml` gitignored. It contains local session IDs and runtime logs.
- Keep entries small: `id`, `session`, `schedule`, and bounded `logs`.
- Do not add PR-specific fields, cursors, or prompt bodies to `monitor.yml`.
- Expired monitors are retained for about one hour, then pruned.

## Commands

- `status`: print runner state and configured monitors.
- `tick`: run due monitors once and update `monitor.yml`.
- `run`: foreground singleton loop.
- `start`: background singleton loop with PID/log files under `.session-monitor/`.
- `stop`: stop the background runner.

The current v1 adapter is `codex-exec-resume`, which runs:

```bash
codex exec resume <session-id> "<scheduled prompt>"
```
