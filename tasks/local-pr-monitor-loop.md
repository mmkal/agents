---
status: needs-grilling
size: medium
---

# Local PR Monitor Loop

Status summary: just started. The current task is to design a simple local replacement for unreliable "monitor PRs pls" instructions; no implementation decision has been finalized yet.

## Goal

Design a simple, local, inspectable PR-monitoring loop that can wake or prompt an existing Codex session when review comments or CI failures need attention.

## Starting constraints

- [ ] Keep the design simple and local. _Pending grilling._
- [ ] Make active monitors easy to eyeball. _Pending grilling._
- [ ] Avoid an infinitely growing monitor registry. _Pending grilling._
- [ ] Prefer Codex-first for the first pass, but leave a path for Claude/opencode later. _Pending grilling._
- [ ] Decide whether a forked probe should gate prompts into the original session. _Pending grilling._

## Implementation Notes

- 2026-06-22: Created the initial stub before grilling. User's rough direction is a local `monitor.yml`-style registry plus scheduled prompts into Codex sessions, potentially using forked sessions to avoid polluting the main thread when nothing changed.
