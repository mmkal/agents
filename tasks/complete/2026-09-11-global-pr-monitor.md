# Global PR monitor

Status: Complete. Global instructions, monitor protocol, and task address are implemented. The live monitor has PR #4 registered and passed two unchanged-state checks. Alert delivery and failure recovery remain untested live.

- [x] Route Codex registrations from global instructions to one durable monitor task. *See global/AGENTS.md and global/pr-monitor.md.*
- [x] Define registration, persisted state, deduplication, delivery acknowledgements, expiry, and idle scheduling in the pr-monitor skill. *See references/global-monitor.md.*
- [x] Create the monitor task and register this PR as a live smoke test. *Task 01a08fd8-448b-76a3-bfd8-7e47b9378644; heartbeat global-pr-monitor; PR #4 expires 2026-09-12T09:28:27Z.*
- [x] Validate the skill and update the draft PR with results. *Skill validator and git diff --check passed; two live reads produced zero owner messages.*

## Decisions

The monitor reads GitHub and routes messages. Implementation tasks retain responsibility for fixes, replies, reactions, and resolving reviews. Runtime state stays in an ignored directory in the agents root checkout. A single 20-minute heartbeat runs in the monitor task, paused when empty. Existing monitors are not migrated automatically.

## Implementation log

2026-09-11: Monitor checked GitHub at 09:31:10 and 09:31:27 UTC, persisting identical snapshots with no feedback or checks present. No CI checks are configured for this PR. The implementation and monitor now run in the root checkout; both worktrees created for this task have been removed. The heartbeat reads the root protocol. Runtime state is ignored and owned by the monitor. Existing per-task monitors were not migrated.
