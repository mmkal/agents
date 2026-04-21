#!/usr/bin/env bash
# Install symlinks from this repo into the locations each agent tool expects.
# Idempotent. Any pre-existing *real* file at a target path is moved to
# <path>.pre-agents-repo.bak so nothing is silently clobbered.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

link() {
  local src="$1"   # absolute path inside repo
  local dst="$2"   # absolute path in user's system
  mkdir -p "$(dirname "$dst")"

  if [ -L "$dst" ]; then
    local current
    current="$(readlink "$dst")"
    if [ "$current" = "$src" ]; then
      printf '  ok  %s\n' "$dst"
      return
    fi
    rm "$dst"
  elif [ -e "$dst" ]; then
    local bak="${dst}.pre-agents-repo.bak"
    printf '  bak %s -> %s\n' "$dst" "$bak"
    mv "$dst" "$bak"
  fi

  ln -s "$src" "$dst"
  printf '  ln  %s -> %s\n' "$dst" "$src"
}

echo "installing symlinks from $REPO"

# Source of truth for global agent instructions.
link "$REPO/global/AGENTS.md"        "$HOME/.config/opencode/AGENTS.md"
link "$REPO/global/AGENTS.md"        "$HOME/.claude/CLAUDE.md"
link "$REPO/global/AGENTS.md"        "$HOME/.codex/AGENTS.md"

# opencode config files.
link "$REPO/opencode/opencode.json"       "$HOME/.config/opencode/opencode.json"
link "$REPO/opencode/oh-my-opencode.json" "$HOME/.config/opencode/oh-my-opencode.json"
link "$REPO/opencode/tui.json"            "$HOME/.config/opencode/tui.json"
link "$REPO/opencode/plugin"              "$HOME/.config/opencode/plugin"
link "$REPO/opencode/package.json"        "$HOME/.config/opencode/package.json"
link "$REPO/opencode/bun.lock"            "$HOME/.config/opencode/bun.lock"

# claude config files.
link "$REPO/claude/settings.json"    "$HOME/.claude/settings.json"

# Skills: one symlink per skill dir, into each tool's skills dir.
for skill in "$REPO/global/skills"/*/; do
  name="$(basename "$skill")"
  link "$REPO/global/skills/$name" "$HOME/.config/opencode/skills/$name"
  link "$REPO/global/skills/$name" "$HOME/.claude/skills/$name"
  link "$REPO/global/skills/$name" "$HOME/.codex/skills/$name"
done

echo "done."
