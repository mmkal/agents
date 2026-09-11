# Global PR monitor

Read `monitor.taskId` and `monitor.host` from `~/src/agents/pr-monitor.ignoreme/registry.json`. These local values are the destination for Codex's `send_message_to_thread`; do not copy them into tracked instructions.

This task runs in the root checkout at `~/src/agents` and watches PRs across repositories. Send registrations with Codex's `send_message_to_thread`; include the PR URL, your task ID/host, worktree, and UTC expiry. Follow the [registration and monitor protocol](skills/pr-monitor/references/global-monitor.md).

Only the monitor writes the registry, including its current task address and `automationId`. Its heartbeat runs every 20 minutes while registrations are active. This local desktop monitor needs the app running and the machine awake.

If the registry, address, or task is missing or inaccessible, report the problem rather than silently creating a duplicate. Cloning the repo does not create the local registry, task, or automation.
