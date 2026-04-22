---
status: needs-grilling
size: small
---

# Make `grill-you` tool-agnostic

The `grill-you` skill currently hardcodes `claude --print --resume ...` for spawning and resuming the sub-agent. It's symlinked into `~/.claude/skills/`, `~/.config/opencode/skills/`, and `~/.codex/skills/`, so opencode and codex invocations will fail with command-not-found until the spawn/resume command is abstracted per tool.

Not urgent — the skill is useful as-is for Claude Code, and the other tools can "figure it out" for now — but worth addressing once we hit the first opencode/codex use.

## What "tool-agnostic" probably looks like

- [ ] detect which tool is driving the current agent session, and dispatch to the equivalent CLI (`opencode run ...`, `codex ...`, `claude --print ...`)
- [ ] normalise the "resume a session by id" semantics across the three tools — they probably don't map 1:1, and the skill should say so
- [ ] normalise "extract session id from the first response" — JSON output shapes differ per tool
- [ ] keep the filesystem layout (`/tmp/grillings/<repo>/<slug>/...`, `interview.md`, `addenda/`, `session.env`) tool-agnostic — that part already is
- [ ] test by running `grill-you` from each tool and confirming the interview loop works end-to-end

## Out of scope

- Making `grill-me` itself portable. That skill's body has no tool-specific commands; it's the orchestrator (`grill-you`) that needs the abstraction.
- Cross-tool spawning (e.g. `grill-you` in Claude Code driving a codex sub-agent). Same tool on both ends is fine for v1 of the portability work.

## Notes for whoever picks this up

- Right now sub-claude invocation looks like:
  ```
  claude --print --resume <id> --permission-mode bypassPermissions --output-format json --model sonnet "<answer>"
  ```
  with `.session_id` extracted from the first call's JSON output.
- opencode and codex both have a `run` / `--resume`-style interface but their flags, output shapes, and session-id semantics will not match exactly. Worth a 10-minute spike to write down what each one actually produces before attempting the abstraction.
- The cleanest shape is probably a tiny shell helper (`scripts/spawn-agent.sh <tool> <session-or-new> <message>`) that returns `{session_id, response}` on stdout and lives in this repo. The skill body then just calls that helper.
