# Global PR monitor

- Codex task: `01a08fd8-448b-76a3-bfd8-7e47b9378644`
- Host: `local`
- Title: Global PR monitor

This task runs in the root checkout at `~/src/agents` and watches PRs across repositories. Send registrations with Codex's `send_message_to_thread`; include the PR URL, your task ID/host, worktree, and UTC expiry. Follow the [registration and monitor protocol](skills/pr-monitor/references/global-monitor.md).

Runtime registry: `~/src/agents/pr-monitor.ignoreme/registry.json`. Only the monitor writes it. Its heartbeat is `global-pr-monitor`, every 20 minutes while registrations are active. This local desktop monitor needs the app running and the machine awake.

If the task is missing or inaccessible, report the problem rather than silently creating a duplicate. This address is local to this Codex installation; cloning the repo does not create the task or automation.
