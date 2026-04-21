#!/usr/bin/env bash
# Called by agent-tool Stop hooks. If this repo has uncommitted changes,
# stage everything and commit with a timestamped auto message.
# Exits 0 even on errors so the hook never blocks the agent.

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 0

# Skip if nothing to commit.
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  exit 0
fi

git add -A >/dev/null 2>&1
git commit \
  -m "auto: $(date '+%Y-%m-%d %H:%M:%S')" \
  -m "Auto-committed by agents repo Stop hook." \
  --quiet >/dev/null 2>&1 || true

exit 0
