# hooks

Reference copies of hook wiring, for cross-tool comparison. The *actual* hook config
lives in each tool's settings file (e.g. `claude/settings.json`), because that's the
file each tool reads on startup.

## Claude Code — Stop hook (auto-commit)

Already wired in `claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "/Users/mmkal/src/agents/scripts/autocommit.sh" }
        ]
      }
    ]
  }
}
```

The `Stop` event fires at the end of every assistant turn. `autocommit.sh` is a no-op
if the repo is clean, so it's safe to run frequently.

## opencode — equivalent (not yet wired)

opencode's hook schema has moved around; check current docs before wiring. The
intended equivalent is a post-session hook that runs the same `autocommit.sh`.
