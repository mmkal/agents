# Local PR Monitor Loop Interview

### Tool substitution before turn 1 - 2026-06-22

> `claude --print` returned `401 Invalid authentication credentials` before asking a question, so the interview continued with a separate `codex exec` session using the same dossier and one-question-at-a-time rule.

## Q1 - active monitor truth boundary - 2026-06-22

I found the repo has the honest foreground-only `pr-monitor` skill, a passive `watch-pr.sh`, global instructions that still say "set up a monitor," and an existing `tasks/local-pr-monitor-loop.md` stub. There's no `CONTEXT.md` or repo-level `codex/` directory here.

Question 1: should v1 define "monitored" as a strict capability contract: the local runner must have a configured wake action for the owning session, and if it cannot wake an agent it must label the entry as passive/log-only?

Recommended answer: yes. Make this the first principle. A `monitor.yml` entry is only an active monitor if it can poll GitHub and invoke a Codex wake command such as `codex exec resume <session_id> <prompt>` when new actionable state appears. If the session id, tool adapter, or wake command is missing, the runner may log snapshots, but agents must not say the PR is "monitored." This preserves the current `pr-monitor` hard rule and gives the design a clean truth boundary before we decide polling, fork-probes, expiry, or file shape.

## A1 - 2026-06-22

Yes. Treat "monitored" as a capability claim, not a vague intention.

For v1, an active entry must prove it has:

- a PR target it can poll;
- a session target it can wake;
- a concrete adapter command for that session;
- an expiry/stop condition;
- last-seen state so it can avoid waking on already-known comments/checks.

If any of those are absent, it can still exist in the file, but it is `mode: passive` or `status: broken`, and agents must phrase it that way. [guess: the user mainly wants to eliminate false confidence, not prohibit passive diagnostics.]

The runner should print a small status table that makes this obvious: active, passive, expired, broken.

---

## Q2 - registry tracked or local - 2026-06-22

Question 2: should `monitor.yml` be a tracked repo artifact, or a local gitignored runtime file in the repo root?

Recommended answer: make `monitor.yml` local and gitignored, with a committed `monitor.example.yml` or docs snippet showing the schema. The active registry will contain machine-local session IDs, mutable `last_seen` cursors, expiry/status fields, and possibly wake attempt timestamps. That should be easy to eyeball, but not committed or auto-committed by this repo's Stop hook. The implementation task should explicitly add `monitor.yml` to `.gitignore` and keep any durable design/docs in the task file or skill docs.

## A2 - 2026-06-22

Yes: local runtime file, committed schema/docs.

Use repo-root `monitor.yml` as the default because it is the file someone will naturally open, but add it to `.gitignore` in the same implementation. Also commit a small `monitor.example.yml` or put the schema in `global/skills/pr-monitor/SKILL.md`; prefer the skill doc if the example would drift. [guess: root `monitor.yml` is more eyeballable than hiding it under `ignoreme/`, but the prompt's `ignoreme/monitor.yml` path suggests an alternate acceptable location.]

The runtime file should hold volatile fields like session ids, last-seen comment/check cursors, next due time, expiry, and last wake outcome. Durable policy belongs in the skill/script, not in the runtime file.

---

## Q3 - deterministic deltas or forked probe - 2026-06-22

Question 3: should v1 wake the Codex session from deterministic GitHub deltas only, rather than running a forked probe agent to classify YES/NO on every tick?

Recommended answer: yes. Use deterministic polling for v1. Wake on unseen unresolved review-thread comments, unseen top-level issue comments, new PR review summaries, or check status transitions into failure/cancelled/action-required. Do not wake for already-seen items, resolved threads, the agent's own `🤖` replies, or unchanged check output. Leave fork-probe classification for v2, only if deterministic wakeups prove too noisy.

## A3 - 2026-06-22

Yes. Deterministic deltas for v1.

The runner already has the right raw ingredients in `watch-pr.sh`; it should evolve from "print changed snapshot" to "calculate actionable events against stored cursors." Wake on new non-self review-thread comments, new non-self issue comments, new review summaries, and CI rollup transitions into a bad state. Ignore unchanged snapshots, resolved/outdated-only thread churn, and comments authored by the current bot/agent account when identifiable.

Do not run a forked agent every tick. Keep fork-probe as a later optional classifier for noisy edge cases, not the default heartbeat. [guess: the user's fork idea was mainly to avoid empty main-session turns; deterministic cursors solve that more simply.]

---

## Q4 - headless wake semantics - 2026-06-22

Question 4: for Codex v1, should "wake the session" mean running a headless Codex turn against the stored session/thread id, rather than trying to bring an interactive terminal/app session back to life?

Recommended answer: yes. The v1 adapter should be a scriptable command, probably `codex exec resume <session_id> <prompt>`, because the monitor runner is itself non-interactive. The active claim should mean "this runner can start a Codex turn that can inspect the PR and act," not "the exact visible terminal UI will pop back up." Store the adapter name, command result, timestamp, and output path in `monitor.yml`. Treat `codex resume`, app-server `thread/resume`/`turn/start`, and true UI-thread nudges as later adapters unless a quick implementation spike proves one is simpler and equally scriptable.

## A4 - 2026-06-22

Yes. V1 wake means "start a headless Codex turn that can act," not "make the old UI visibly continue."

Use `codex exec resume <session_id> <prompt>` as the first adapter if a spike confirms it can resume the relevant saved session id. We just used `codex exec resume` successfully against this grill session, so the basic primitive exists. The monitor should log the command, timestamp, exit status, output path, and whether the turn produced changes.

The prompt should not just say "check comments"; if deterministic polling found an event, the headless turn should handle the PR using `pr-monitor` rules, reply/resolve where appropriate, and update the monitor file. [guess: acting in a headless turn is more useful than merely nudging a dead/closed UI session.]

Keep app-server as v2 for richer exact thread APIs (`thread/resume`, `thread/fork`, `turn/start`) if CLI resume turns out not to work against interactive sessions or if we need proper fork-probe behavior later.

---

## Q5 - expiry and pruning - 2026-06-22

Question 5: what should the v1 lifecycle be for monitor expiry and pruning?

Recommended answer: every active entry must have `expires_at`, defaulting to 24 hours after creation, plus stop conditions for PR merged/closed and manual `status: retired`. When a stop condition hits, the runner marks the entry `expired` or `retired`, prints it in the status table, and stops polling/waking it. To keep `monitor.yml` from growing forever, the runner should automatically prune stopped entries after a short grace period, say 24 hours, while leaving detailed wake/poll output in ignored log files if needed.

## A5 - 2026-06-22

Yes. Make expiry mandatory.

Default `expires_at` should be creation time + 24 hours, matching the global PR-monitoring instruction for human review comments. Also stop immediately when the PR is merged/closed, or when an agent/user marks `status: retired`.

Stopped entries should remain visible briefly so a human can see why they stopped. Use `prune_after` defaulting to 24 hours after stopped time. The status table should show active/passive/broken/expired/retired, but the polling loop should only act on active entries.

If logs exist, put them under an ignored path and prune them by monitor id/age too. The file should stay small by default.

---

## Q6 - state size and cursors - 2026-06-22

Question 6: should `monitor.yml` store compact cursors/fingerprints only, rather than raw comment bodies or full snapshots?

Recommended answer: yes. Keep each entry flat and small: PR target, session target, adapter, status/mode, timestamps, expiry/prune fields, bot login if known, `last_seen` IDs for review-thread comments, issue comments, and reviews, plus a CI rollup fingerprint/state. Store raw poll output and wake transcripts only in ignored logs. The monitor file should answer "what is being watched, can it wake, what has it already seen, and what happened last," not become a history database.

## A6 - 2026-06-22

Yes. `monitor.yml` should be a control panel, not an archive.

Store stable IDs/fingerprints:

- PR: owner, repo, number, URL;
- session: tool, session id, cwd/worktree, adapter;
- lifecycle: mode/status, created, next_due, expires_at, stopped_at, prune_after;
- cursors: seen review-thread comment IDs, issue comment IDs, review IDs, check rollup fingerprint;
- last wake: timestamp, exit status, short summary, log path.

No raw comment bodies in the main file except perhaps a one-line last error/status. Raw snapshots and transcripts go under ignored logs.

---

## Q7 - implementation home - 2026-06-22

Question 7: should the v1 runner live inside the existing `pr-monitor` skill as a small CLI, rather than as a repo-level generic script or a new skill?

Recommended answer: yes. Add something like `global/skills/pr-monitor/scripts/monitor-prs.sh` and document it in `global/skills/pr-monitor/SKILL.md`. Keep `watch-pr.sh` as the simple foreground inspector, but let the new runner own `monitor.yml` state. The CLI should start small: `status`, `tick`, `loop`, `retire`, and `prune`. Agents can create/edit entries directly in YAML for v1, so an `add` command is optional rather than required.

## A7 - 2026-06-22

Yes. Put it in the existing `pr-monitor` skill.

The skill is already the authority for PR comments, review threads, and CI checks. A separate skill would split the policy from the runner and make agents pick between two similar tools.

Implementation shape: add a small Node CLI plus shell shim under `global/skills/pr-monitor/scripts/`, because YAML parsing and state rewriting will be too fragile in bash. Keep `watch-pr.sh` as the dead-simple foreground inspector. Document the runner commands in `SKILL.md`: `status`, `tick`, `loop`, `retire`, `prune`, and maybe `add` only if manual YAML editing is annoying after the first spike.

If Node YAML support needs a dependency, make it explicit in this repo rather than relying on a global `yq`/Ruby/Python environment. [guess: the user values boring reliability over avoiding one small package.]

---

## Q8 - runner runtime - 2026-06-22

Question 8: should the runner be plain Node ESM JavaScript with one explicit YAML dependency, rather than TypeScript or bash-plus-`jq`?

Recommended answer: yes. Add `yaml` to this repo's `package.json`/lockfile, implement `global/skills/pr-monitor/scripts/monitor-prs.mjs`, and add a tiny shell shim `monitor-prs.sh` that invokes it with Node. Keep `gh` and `codex` as explicit external command dependencies, but parse their JSON in Node rather than depending on `jq`, `yq`, Ruby, or Python. Avoid TypeScript for the installed skill script unless there is already a build/install path for compiled skill scripts.

## A8 - 2026-06-22

Yes. Plain Node ESM, one explicit `yaml` dependency, tiny shell shim.

The script is installed by symlink as a skill asset, so it should run directly without a TypeScript compile step. `gh` and `codex` are acceptable external command dependencies because they are the tools being automated; `jq` can remain in `watch-pr.sh`, but the stateful runner should parse JSON itself.

Tests can exercise the Node module directly with fake command outputs and a temp monitor file.

---

## Q9 - state ownership - 2026-06-22

Question 9: when a wake happens, who should be allowed to write `monitor.yml`: the runner only, or the headless Codex turn too?

Recommended answer: make the runner the owner of monitor state. It should poll, detect events, synchronously run `codex exec resume`, capture exit status/output/log path, compare worktree state before/after if we want `produced_changes`, then update cursors and `last_wake`. The headless Codex prompt should handle GitHub/code according to `pr-monitor` rules, but should not directly edit `monitor.yml` except via an explicit future command. That avoids stale read/write races and keeps the runtime file structurally reliable.

## A9 - 2026-06-22

Runner owns `monitor.yml` during automated ticks.

The headless Codex turn should handle PR comments, CI, code changes, replies, and review-thread resolution. It should not mutate monitor state directly. The runner updates cursors, `last_wake`, status, and logs after the child process exits.

Use atomic writes and a simple lock file so two local loops do not corrupt the YAML. Manual edits are allowed when the runner is not active; `status` should warn if the file is locked.

---

## Q10 - background runner wrapper - 2026-06-22

Question 10: should v1 include a minimal `start`/`stop` wrapper for a local background loop, or should it only provide `tick` and foreground `loop` and leave process supervision to the user?

Recommended answer: include `start`/`stop` as thin wrappers, without installing launchd/cron. `start` would run the same `loop` in the background, write a PID file and log under an ignored `.monitor-prs/` directory, and `status` would show whether that runner is alive, stale, locked, or absent. That is still local and simple, but it lets an agent truthfully say "I registered the monitor and started the local runner" without keeping the current turn open. If the runner is not alive, `status` should make that obvious even if entries are otherwise `active`.

## A10 - 2026-06-22

Yes. Include thin `start`/`stop`, but no launchd/cron install in v1.

`start` should run the same foreground `loop` in the background, write `.monitor-prs/runner.pid`, and append to `.monitor-prs/runner.log`. `stop` should terminate that PID if it is still the monitor runner. `status` should show both entry status and runner liveness.

Terminology distinction: an entry can be `status: active` when it is configured and unexpired, but the PR is only "being monitored now" if a foreground loop is running or `.monitor-prs/runner.pid` points to a live runner. If not, agents must say the monitor is registered but not running.

Use max-duration behavior: `start` can exit automatically once all entries are expired/retired/pruned, and it should not keep an empty loop alive forever.

---

## Ready For Phase 2 - 2026-06-22

Agreed design:

- `monitored` is a capability claim. A PR is only monitored now if there is a configured active entry and a live foreground/background runner.
- Runtime state lives in repo-root `monitor.yml`, but it is gitignored. Durable schema/policy goes in `global/skills/pr-monitor/SKILL.md`.
- `monitor.yml` is a compact control panel: PR target, Codex session target, adapter, cwd/worktree, lifecycle timestamps, cursors/fingerprints, last wake summary/log path.
- No raw comment bodies or transcripts in `monitor.yml`; logs live under ignored `.monitor-prs/`.
- V1 uses deterministic GitHub deltas, not fork-probe agents.
- Wake path is headless Codex: first adapter is `codex exec resume <session_id> <prompt>`, pending a spike confirming session compatibility.
- The headless Codex turn handles PR feedback/CI using `pr-monitor` rules. The runner owns `monitor.yml` updates.
- Entries require expiry. Default `expires_at` is creation + 24h; PR merged/closed or `status: retired` stops immediately; stopped entries prune after 24h.
- Add a plain Node ESM runner plus shell shim under `global/skills/pr-monitor/scripts/`; add one explicit `yaml` dependency.
- Keep `watch-pr.sh` as the simple foreground inspector.
- Runner commands: `status`, `tick`, `loop`, `start`, `stop`, `retire`, `prune`; `add` optional after the first spike.
- `start` is a thin local background wrapper, not launchd/cron. It writes `.monitor-prs/runner.pid` and `.monitor-prs/runner.log`.
- Use atomic writes and a lock file; `status` warns on locks and shows runner liveness.
- `start` should exit once all entries are expired/retired/pruned, so no empty loop lives forever.

## User Correction - 2026-06-23

The user rejected the proposed shape as too complex. New direction:

- Keep only `session`, `schedule`, and small `logs` in `monitor.yml`.
- Replace the `pr-monitor` skill completely with a new `session-monitor` skill to avoid PR-specific backcompat pressure.
- Use a global singleton cron-like runner that finds overdue monitors from cron expressions.
- Prune based on `expires_at` once entries have been expired for about an hour.
- Write the Node runner in TypeScript, because modern Node can run `.ts` directly.

This supersedes the earlier PR-specific cursor/delta design.
