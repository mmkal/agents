---
status: ready
size: medium
---

# Session Monitor

Status summary: proposal revised after user feedback on 2026-06-23. The design is now a much smaller generic `session-monitor` skill: a local singleton cron runner reads a gitignored `monitor.yml`, finds overdue session reminders, resumes the configured session, appends a tiny log entry, and prunes expired monitors. Implementation has not started.

## Goal

Replace the existing `pr-monitor` skill with a simpler generic session monitor. The monitor should not know about PRs, review threads, CI, or cursors. The session being resumed already knows what it was asked to monitor.

## Agreed Design

Create a new global skill called `session-monitor`. Do not extend `pr-monitor`; remove or retire the old `global/skills/pr-monitor/` implementation so old PR-specific assumptions do not leak into the new design.

Runtime state lives in a local gitignored `monitor.yml`. The file should be easy to open and understand: each monitor has an `id`, a `session`, a `schedule`, and short `logs`. No PR target, no cursor database, no CI fingerprint, no stored prompt body.

A single local runner acts like a cron loop. On each tick, it reads `monitor.yml`, finds monitors whose cron expression is due and whose `expires_at` has not passed, resumes the configured session with a fixed scheduled-message prompt, and appends a log entry. Expired monitors are pruned once they have been expired for more than an hour.

The last log timestamp is the only scheduling cursor. If a monitor has no logs, it is due on the first matching tick. Logs should be trimmed automatically, for example to the most recent 20 entries per monitor, so the file stays small.

Modern Node can run TypeScript directly in this environment, so the runner should be written as TypeScript and executed directly by Node rather than compiled first.

## Proposed `monitor.yml` Shape

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
    logs:
      - { timestamp: 2026-06-23T11:00:00Z, result: noop }
      - { timestamp: 2026-06-23T12:05:00Z, result: bumped }
```

Notes:

- Use list syntax under `monitors:` so multiple monitors can live in one file.
- `logs` should stay tiny and bounded. Suggested result values: `bumped`, `noop`, `error`, `expired`, `pruned`.
- Do not store the reminder prompt in each entry unless a later implementation proves customization is necessary.

## Scheduled Message

Use a fixed prompt derived from the monitor file path, for example:

```text
[<absolute path to monitor.yml>] scheduled message from session-monitor.
Continue the monitoring/follow-up work this session was responsible for.
If there is nothing to do, say so briefly and stop.
```

The runner should not try to understand what is being monitored. The resumed session owns that context.

## Runner Behavior

- `tick`: read `monitor.yml`, run every due unexpired monitor once, append a bounded log result, prune entries expired by more than one hour, and write the file atomically.
- `run`: foreground singleton loop that calls `tick` often enough to satisfy minute-granularity cron schedules.
- `start` / `stop`: optional thin wrappers around `run` using a PID file and logs under an ignored local directory.
- `status`: print configured monitors, next due time if easily computable, expiry, recent log result, and whether the singleton runner is alive.

The singleton runner should refuse to start if another runner is already alive. It should use a lock file or equivalent atomic guard while rewriting `monitor.yml`.

## Checklist

- [ ] Add `monitor.yml` and the runner log/pid directory to `.gitignore`. _Local session IDs and runtime logs should not be auto-committed._
- [ ] Create `global/skills/session-monitor/SKILL.md`. _This replaces the old PR-specific skill surface._
- [ ] Add `global/skills/session-monitor/scripts/session-monitor.ts`. _TypeScript executed directly by modern Node; no build step._
- [ ] Add a tiny shell shim if useful. _Only for ergonomic invocation from skill docs._
- [ ] Remove or retire `global/skills/pr-monitor/`. _Avoid backcompat pressure from the old PR-specific implementation._
- [ ] Implement YAML load/save with atomic writes. _Use an explicit YAML parser dependency if needed._
- [ ] Implement cron due detection. _Support standard five-field cron for v1._
- [ ] Implement `tick`. _Resume due sessions, append bounded `logs`, handle errors, and prune monitors expired by more than one hour._
- [ ] Implement singleton `run`. _One local loop owns all monitors in `monitor.yml`._
- [ ] Implement `status`. _Make it easy to eyeball what is configured and whether the runner is alive._
- [ ] Spike the Codex adapter. _Confirm `codex exec resume <session_id> <prompt>` is the right direct-session bump path._
- [ ] Keep Claude/opencode as later adapters. _The file shape should allow them, but only Codex needs to work now._
- [ ] Add focused tests. _Use temp `monitor.yml` files, fake time, and fake adapter commands._

## Out Of Scope

- PR-specific polling, GitHub review-thread cursors, CI state, or comment filtering.
- Fork-probe classification in v1.
- Hosted services, webhooks, GitHub Actions, launchd install, or cron install.
- A durable prompt registry.
- Backwards compatibility with `pr-monitor`.

## Implementation Notes

- 2026-06-22: Created the original proposal via `grill-you`; Claude Code authentication failed with `401`, so the interview used a separate `codex exec` session. That older decision trail remains in `tasks/local-pr-monitor-loop.interview.md`.
- 2026-06-23: User rejected the PR-specific/cursor-heavy design. Revised the proposal to a generic `session-monitor` skill with only session, cron schedule, expiry, and small logs.
