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
link "$REPO/global/AGENTS.md"        "$HOME/.pi/agent/AGENTS.md"

# opencode config files.
link "$REPO/opencode/opencode.json"       "$HOME/.config/opencode/opencode.json"
link "$REPO/opencode/oh-my-opencode.json" "$HOME/.config/opencode/oh-my-opencode.json"
link "$REPO/opencode/tui.json"            "$HOME/.config/opencode/tui.json"
link "$REPO/opencode/plugin"              "$HOME/.config/opencode/plugin"
link "$REPO/opencode/package.json"        "$HOME/.config/opencode/package.json"
link "$REPO/opencode/bun.lock"            "$HOME/.config/opencode/bun.lock"

# claude config files.
link "$REPO/claude/settings.json"    "$HOME/.claude/settings.json"

# pi config files.
link "$REPO/pi/keybindings.json"        "$HOME/.pi/agent/keybindings.json"
link "$REPO/pi/keybindings.schema.json" "$HOME/.pi/agent/keybindings.schema.json"
link "$REPO/pi/extensions"              "$HOME/.pi/agent/extensions"

# MCP servers. global/mcp.json is the source of truth (pi-shaped, so pi gets a
# plain symlink); sync-mcp.ts translates it for opencode, claude and codex.
link "$REPO/global/mcp.json"            "$HOME/.pi/agent/mcp.json"
echo "syncing mcp servers from global/mcp.json"
node "$REPO/scripts/sync-mcp.ts"

# Skills: one symlink per skill dir, into each tool's skills dir.
# Pi also scans ~/.agents/skills, so don't install a Pi-specific link when the
# same skill name already exists there. Otherwise Pi warns about a name
# collision and keeps whichever location it scanned first.
for skill in "$REPO/global/skills"/*/; do
  name="$(basename "$skill")"
  link "$REPO/global/skills/$name" "$HOME/.config/opencode/skills/$name"
  link "$REPO/global/skills/$name" "$HOME/.claude/skills/$name"
  link "$REPO/global/skills/$name" "$HOME/.codex/skills/$name"

  pi_skill="$HOME/.pi/agent/skills/$name"
  shared_skill="$HOME/.agents/skills/$name"
  if [ -e "$shared_skill" ]; then
    if [ -L "$pi_skill" ] && [ "$(readlink "$pi_skill")" = "$REPO/global/skills/$name" ]; then
      rm "$pi_skill"
      printf '  rm  %s (duplicate of %s)\n' "$pi_skill" "$shared_skill"
    fi
    printf '  skip %s (Pi already loads %s)\n' "$pi_skill" "$shared_skill"
  else
    link "$REPO/global/skills/$name" "$pi_skill"
  fi
done

echo "done."
