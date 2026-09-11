# Global PR monitor

Status: Specified; implementation pending. One Codex task will watch PRs across repos and send only actionable changes to their owning tasks.

- [ ] Route Codex registrations from global instructions to one durable monitor task.
- [ ] Define registration, persisted state, deduplication, delivery acknowledgements, expiry, and idle scheduling in the pr-monitor skill.
- [ ] Create the monitor task and register this PR as a live smoke test.
- [ ] Validate the skill and update the draft PR with results.

## Decisions

The monitor reads GitHub and routes messages. Implementation tasks retain responsibility for fixes, replies, reactions, and resolving reviews. Runtime state stays in an ignored directory in the agents root checkout. A single 20-minute heartbeat runs in the monitor task, paused when empty. Existing monitors are not migrated automatically.
