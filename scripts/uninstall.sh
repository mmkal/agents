#!/usr/bin/env bash
# Remove symlinks created by install.sh. Leaves real files (including .pre-agents-repo.bak
# backups) alone. Run this if you want to disconnect this repo from the user's system.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

unlink_if_points_here() {
  local dst="$1"
  if [ -L "$dst" ]; then
    local target
    target="$(readlink "$dst")"
    case "$target" in
      "$REPO"/*)
        rm "$dst"
        printf '  rm  %s\n' "$dst"
        ;;
      *)
        printf '  skip %s (not ours: %s)\n' "$dst" "$target"
        ;;
    esac
  fi
}

for p in \
  "$HOME/.config/opencode/AGENTS.md" \
  "$HOME/.config/opencode/opencode.json" \
  "$HOME/.config/opencode/oh-my-opencode.json" \
  "$HOME/.config/opencode/tui.json" \
  "$HOME/.config/opencode/plugin" \
  "$HOME/.config/opencode/package.json" \
  "$HOME/.config/opencode/bun.lock" \
  "$HOME/.claude/CLAUDE.md" \
  "$HOME/.claude/settings.json" \
  "$HOME/.codex/AGENTS.md" \
  "$HOME/.pi/agent/AGENTS.md" \
  "$HOME/.pi/agent/keybindings.json" \
  "$HOME/.pi/agent/keybindings.schema.json"
do
  unlink_if_points_here "$p"
done

for dir in "$HOME/.config/opencode/skills" "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.pi/agent/skills"; do
  [ -d "$dir" ] || continue
  for entry in "$dir"/*; do
    [ -e "$entry" ] || continue
    unlink_if_points_here "$entry"
  done
done

echo "done."
