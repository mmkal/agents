---
status: ready
size: medium
---

# Local PR Monitor Loop

Status summary: proposal ready, implementation not started. The design is a local gitignored `monitor.yml` registry plus a small `pr-monitor` runner that polls GitHub deterministically and wakes Codex through a headless resumed turn only when new actionable PR state appears. Main missing pieces are the implementation spike for `codex exec resume` against an existing interactive session and the runner itself.

## Goal

Make "monitor this PR" a truthful local capability instead of a vague instruction. A PR is only "being monitored now" when an unexpired registry entry exists and a local foreground/background runner is alive and able to wake an agent.

## Agreed Design

Runtime state lives in repo-root `monitor.yml`, but the file must be gitignored. Durable policy and schema documentation live in `global/skills/pr-monitor/SKILL.md`; the interview trail is preserved in `tasks/local-pr-monitor-loop.interview.md`.

V1 should extend the existing `pr-monitor` skill, not create a new skill. Add a plain Node ESM runner under `global/skills/pr-monitor/scripts/`, plus a tiny shell shim. Keep `watch-pr.sh` as the simple foreground inspector.

The runner uses deterministic GitHub deltas, not an LLM fork-probe on every tick. Wake on unseen non-self review-thread comments, issue comments, review summaries, and CI transitions into bad states. Ignore already-seen items, resolved thread churn, and the agent's own `🤖` replies when identifiable.

The first wake adapter should be `codex exec resume <session_id> <prompt>`, pending a small spike confirming it works against the kind of Codex session ID agents can record today. If it does not work reliably for interactive sessions, use Codex app-server `thread/resume` + `turn/start` as the next adapter.

The runner owns `monitor.yml` during automated ticks. The headless Codex turn handles PR comments, CI, code changes, replies, and review-thread resolution according to `pr-monitor` rules; it does not mutate monitor state directly. The runner updates cursors, wake status, and logs after the child process exits.

## Proposed `monitor.yml` Shape

```yaml
monitors:
  - id: agents-1234
    status: active
    mode: active
    pr:
      owner: mmkal
      repo: agents
      number: 1234
      url: https://github.com/mmkal/agents/pull/1234
    session:
      tool: codex
      id: 019eef99-b1e2-7910-8dd3-1da7fd723e02
      adapter: codex-exec-resume
      cwd: /Users/mmkal/src/worktrees/agents/local-pr-monitor-loop
    schedule:
      interval_seconds: 300
      next_due: 2026-06-22T12:00:00Z
      expires_at: 2026-06-23T12:00:00Z
      prune_after: 2026-06-24T12:00:00Z
    cursors:
      review_thread_comment_ids: []
      issue_comment_ids: []
      review_ids: []
      checks_fingerprint: ""
    last_wake:
      at:
      exit_code:
      summary:
      log_path:
```

`monitor.yml` should stay a compact control panel, not a history database. Raw snapshots, wake transcripts, pid files, and runner logs belong under ignored `.monitor-prs/`.

## Checklist

- [ ] Add `monitor.yml` and `.monitor-prs/` to `.gitignore`. _Needed so local session IDs, cursors, and logs are not auto-committed._
- [ ] Add an explicit YAML parser dependency. _Use a direct `yaml` package dependency instead of relying on `yq`, Ruby, Python, or a transitive package._
- [ ] Add `global/skills/pr-monitor/scripts/monitor-prs.mjs`. _Plain Node ESM; no TypeScript build step for a symlinked skill script._
- [ ] Add `global/skills/pr-monitor/scripts/monitor-prs.sh`. _Tiny shell shim that invokes the Node runner._
- [ ] Implement `status`. _Print entry status plus runner liveness: active/passive/broken/expired/retired and running/stale/locked/absent._
- [ ] Implement `tick`. _Poll GitHub once, detect actionable deltas from stored cursors, wake Codex if needed, then atomically update monitor state._
- [ ] Implement `loop`. _Run `tick` repeatedly for due active entries until interrupted or all entries stop._
- [ ] Implement `start` and `stop`. _Thin local background wrapper; write `.monitor-prs/runner.pid` and `.monitor-prs/runner.log`, with no launchd/cron install._
- [ ] Implement `retire` and `prune`. _Stop entries manually and remove stopped entries after their prune grace period._
- [ ] Add locking and atomic writes. _Prevent two local runner processes from corrupting `monitor.yml`; make `status` show lock state._
- [ ] Extend `global/skills/pr-monitor/SKILL.md`. _Document the active-monitor truth boundary, YAML schema, commands, expiry behavior, and exact wording agents should use when the runner is not alive._
- [ ] Spike `codex exec resume <session_id>`. _Confirm it can resume the relevant saved Codex session IDs agents can record today; if not, document and switch the task to the app-server adapter._
- [ ] Add focused tests for cursor/delta detection and state transitions. _Use fake `gh`/`codex` command outputs and a temp monitor file._

## Out Of Scope

- Hosted services, webhooks, GitHub Actions, or Pullfrog as the core monitor.
- Installing launchd, cron, or any system-level daemon in v1.
- Running an LLM fork-probe on every polling tick.
- Full Claude/opencode support. V1 should keep the adapter shape open for later tools, but only Codex needs to work now.
- Persisting full comment bodies or transcripts in `monitor.yml`.

## Guesses And Assumptions

- [guess: the user mainly wants to eliminate false confidence, not prohibit passive diagnostics.]
- [guess: root `monitor.yml` is more eyeballable than hiding it under `ignoreme/`, but the prompt's `ignoreme/monitor.yml` path suggests an alternate acceptable location.]
- [guess: the user's fork idea was mainly to avoid empty main-session turns; deterministic cursors solve that more simply.]
- [guess: acting in a headless turn is more useful than merely nudging a dead/closed UI session.]
- [guess: the user values boring reliability over avoiding one small package.]

## Research Notes

- Anthropic's "Building effective agents" argues for simple, composable patterns first, with ground truth, checkpoints, and stopping conditions.
- Anthropic's "Writing effective tools for agents" supports local prototypes, evaluations, raw transcript review, and runtime/token metrics.
- Addy Osmani's loop-engineering writeup frames a useful local loop as automation heartbeat + worktrees + skills/connectors + checker agents + external state.
- Codex docs confirm relevant primitives: thread automations as inspiration, `codex exec resume` for non-interactive continuation, and app-server `thread/resume`/`thread/fork`/`turn/start` as a richer later adapter.

Sources:

- https://www.anthropic.com/engineering/building-effective-agents
- https://www.anthropic.com/engineering/writing-tools-for-agents
- https://addyosmani.com/blog/loop-engineering/
- https://developers.openai.com/codex/app/automations
- https://developers.openai.com/codex/app-server
- https://developers.openai.com/codex/noninteractive

## Implementation Notes

- 2026-06-22: Created stub task and ran `grill-you`; Claude Code authentication failed with `401`, so the interview used a separate `codex exec` session with the same one-question-at-a-time dossier. The resulting decision trail is in `tasks/local-pr-monitor-loop.interview.md`.
