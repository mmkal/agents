# AGENTS.md (repo-level)

You're editing the agents-configuration repo. This file applies only when the CWD is
this repo. The global instructions from `global/AGENTS.md` also apply (via the symlinks
that `scripts/install.sh` sets up — your tool sees them as `~/.claude/CLAUDE.md` or
`~/.config/opencode/AGENTS.md` etc.).

Read `README.md` first for the layout.

## Rules of thumb

- **Editing global instructions**: edit `global/AGENTS.md`. It's the source of truth.
  Every tool reads it via a symlink. No build step. Do not create a separate CLAUDE.md
  or a separate per-tool copy — we do not want drift.
- **Editing tool-specific config**: edit the file under `opencode/` / `claude/` / `codex/`.
  The user's system reads the symlinked copy.
- **Adding a skill that should apply to all tools**: put it in `global/skills/<name>/`.
  Re-run `scripts/install.sh` to fan out symlinks.
- **Adding a skill that's only for one tool**: put it in `<tool>/skills/<name>/` and add
  a line to `scripts/install.sh` so it's linked only into that tool's skills dir.
- **Adding a hook**: edit the tool's own config file (e.g. `claude/settings.json`) and,
  if it's non-trivial, drop a reference copy in `hooks/` so the pattern is discoverable.
- **Changing install logic**: `scripts/install.sh` must stay idempotent and must never
  overwrite a real file without moving it to `<path>.pre-agents-repo.bak` first.

## Commits

A Stop hook auto-commits any dirty state at the end of each assistant turn (see
`scripts/autocommit.sh`). You don't need to commit manually for exploratory edits;
history will be noisy and that's fine. If you're making a deliberate structural
change, write a proper commit yourself first so it's not buried under `auto:`
timestamps.

## What not to do

- Don't rename `global/AGENTS.md` — the symlinks in the user's home dir point at
  this exact path.
- Don't put machine-specific absolute paths into `opencode/` / `claude/` config files
  unless they're under `$HOME`. These files are portable across machines.
- Don't add secrets. This repo is intended to be committable (eventually pushable).
  `.gitignore` excludes `.env*` but don't rely solely on that.
