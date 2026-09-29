---
status: in-progress
size: medium
---

# PR monitor for Claude Code

## Status

Mostly done. The watcher script, tests, and skill/AGENTS.md changes are in. It has been checked read-only against real PRs.
Missing: a real end-to-end delivery (a monitor session relaying one of your comments to an owner session). That needs a monitor session, which is your call (see PR).

## Goal

Claude Code sessions (desktop app, Code tab) get the same experience Codex tasks get from the global PR monitor: open a PR, register it, end the turn, and later get woken with actionable review feedback and CI failures — without the implementation session polling anything.

## What exists today

**Codex.** One long-lived Codex task is the monitor. A Codex "heartbeat" automation (`~/.codex/automations/global-pr-monitor/automation.toml`, every 5 min) wakes that task. It reads `state.ignoreme/registry.json`, queries GitHub, and routes new items to owner tasks with `send_message_to_thread`. Owners register with the same tool. All GitHub diffing and dedup is done by the LLM and kept in the registry JSON.

**Claude.** None of those Codex tools exist. Claude sessions reading the skill fell back to ad-hoc per-session `Monitor` poll loops, or to the desktop app's built-in **Auto-fix pull requests** watcher (`mcp__ccd_pr__set_monitor`).

Auto-fix (read from the desktop app bundle, `AutoFixEngine`):

- The app itself polls every 60s (5 min while unfocused) for every session with a bound PR and Auto-fix on. No LLM heartbeat.
- It wakes the owning session with a `<ci-monitor-event>` for: newly failing checks (per head SHA), merge conflicts (and tries a host-side base merge), and new review comments / review summaries / PR comments.
- Delivery is queued behind a busy session's current turn. Delivered state is persisted by the app.
- Sessions with live background tasks or cron jobs are exempt from the app's idle-process eviction.
- **Comment filter:** `author !== <your gh login> && (userType === 'Bot' || association in OWNER/MEMBER/COLLABORATOR)`. So your own comments (`mmkal`) never wake the session. Bots and org colleagues do.

## Decisions

- **Can't share the Codex monitor.** Neither app has a supported way to message the other's sessions. Each tool needs its own monitor. Codex setup stays as it is.
- **Use Auto-fix for everything it covers.** CI, merge conflicts, bot reviews (cursor, coderabbit, pullfrog), colleague comments. It's native, persisted, idle-aware, and costs nothing when quiet. The harness also tells Claude not to poll CI itself.
- **Add a Claude monitor only for the gap: your own comments.** Comments by the authenticated gh login that aren't Claude's own `🤖` replies. This is the main review channel on `mmkal/*` repos.
- **Deterministic watcher, thin LLM.** A TS script (`scripts/claude-monitor.ts`) does all GitHub reads, filtering and dedup. It's run by one long-lived Claude session as a background command that **exits when it has something to deliver**. The session relays it with `SendMessage`, acks it, and restarts the watcher. No LLM turns while quiet.
- **Registration is a file write, not a message.** Owners run `claude-monitor.ts register`, which writes one file per PR. The watcher re-reads registrations every poll. Owners only message the monitor session when `register` reports the watcher isn't running.
- **Separate state from the Codex registry.** Everything lives under `state.ignoreme/claude/`, so the two monitors never write the same file. Registration files are written only by owners; delivery files only by the watcher.

## Assumptions (made without asking)

- Only your own comments are relayed by the Claude watcher. Comments from humans outside the org (not OWNER/MEMBER/COLLABORATOR) are skipped by both systems. Auto-fix skips them deliberately, as they're a prompt-injection surface on public repos.
- Eligibility rules match the Codex monitor where they apply. Only `SUBMITTED` review comments count, and only non-`PENDING` review summaries with a body. Resolved threads, approvals, and `🤖` replies are skipped. Edits re-deliver.
- Top-level comments and review summaries can't be resolved. So on a PR's first check, ones older than the registration are treated as handled. Unresolved inline threads are always delivered.
- 24h registration expiry, like Codex. Re-registering extends it. Merged/closed PRs retire quietly.
- The monitor session is this session ("Global monitor for Claude") unless you pick another.
- Claude Code CLI (terminal) sessions have no Auto-fix. They're out of scope; noted as follow-up.

## Checklist

- [x] `claude-monitor.ts` with `register`, `watch`, `ack`, `status` _`global/skills/pr-monitor/scripts/claude-monitor.ts`. `ack` became `delivered`/`undeliverable`, plus `check` for a single foreground poll._
- [x] Integration tests against a local fake GitHub (no mocks) _`tests/claude-pr-monitor.test.ts`, 11 tests, fake GraphQL server at the bottom. Mutation-checked: breaking the 🤖/pending filters fails the right tests._
- [x] SKILL.md: split into shared rules + Codex section + Claude section; keep the Codex protocol intact _Codex text unchanged, headings demoted one level under `## Codex`._
- [x] global/AGENTS.md: point Claude at Auto-fix + registration
- [x] Live check against a real PR (read-only) _iterate/middlewright#42, mmkal/artifact.ci#24, mmkal/trpc-cli#222 in a scratch state dir: 🤖 replies skipped, pre-registration comments baselined, backdated registration relays the real comments correctly._
- [ ] Arm the monitor session and confirm a real delivery

## Implementation notes

- The Codex heartbeat is a persisted app automation. Claude has no equivalent that targets an existing session. `CronCreate`/`Monitor` are in-memory, and desktop scheduled tasks run in fresh unattended sessions that can't `SendMessage`. So the watcher runs as a background Bash command in the monitor session. A background command outlived the 10-minute Bash timeout (verified with `sleep 700`), and it exempts the session from the app's idle eviction (`CliGovernor.getLruIdleCandidate` skips sessions with active background tasks or cron jobs).
- The watcher exits only when it has a batch or notice, so the monitor session takes no turns while quiet. `Monitor` would have needed a re-arm turn every 30 minutes.
- Unacked batches are re-printed at most 3 times, then dropped with a notice. That stops a restart-without-ack loop from waking the monitor forever.
- Registration timestamps baseline only top-level comments and review summaries. Inline threads use resolution as the "handled" signal, and resolving a thread clears its seen state so reopening re-relays it.
- Timings during the live check were slow (4–12s per command) because the machine's load average was ~170 at the time; a bare `node -e 0` took 0.5s.
- Local `main` had 20 unpushed auto-commits (including `global/frustration.md`). This branch is based on `origin/main` and only carries over the pr-monitor skill files from local main, to avoid publishing the rest.
