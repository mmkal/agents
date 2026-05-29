# agents

>Note: this repo is "just for me" for now. Putting it on GitHub on the off-chance it could be helpful for someone else someday, but if it is, it'll most likely be in a "look at this and maybe copy something" way than a `npx skills mmkal/agents/...` way.

Single source of truth for some parts of my agent-tool configuration (Claude Code, opencode, codex, pi).
Everything that was previously scattered across `~/.config/opencode/`, `~/.claude/`,
`~/.codex/`, and `~/.pi/agent/` lives here, and `scripts/install.sh` plants the
symlinks that make each tool pick it up.

## Layout

```
.
├── AGENTS.md              repo-level instructions — applies when an agent is editing THIS repo
├── global/                everything that applies to agents GLOBALLY, regardless of tool
│   ├── AGENTS.md          the canonical global instruction file (aka CLAUDE.md, AGENTS.md)
│   └── skills/            skills shared across all tools
├── opencode/              opencode-specific config (opencode.json, plugin/, etc.)
├── claude/                claude-code-specific config (settings.json, hook wiring)
├── codex/                 codex-specific config
├── pi/                    pi-specific config (keybindings, extensions)
├── scripts/
│   ├── install.sh         create all symlinks into the user's system
│   ├── uninstall.sh       remove them (safely — only removes symlinks pointing into this repo)
│   └── autocommit.sh      run by Stop hooks to commit any dirty state
├── hooks/                 hook config fragments (reference copies; actual config lives in claude/)
└── tasks/                 task files (see AGENTS.md for conventions)
```

### Why the `global` / `opencode` / `claude` split

Two kinds of config live here:

- **`global/`** — content that every agent tool should see. The big `AGENTS.md` file and
  shared skills go here. One source of truth → many symlinks.
- **`<tool>/`** — content that's specific to one tool's config format (settings.json,
  opencode.json, plugin/, …). Only that tool's install-target gets a symlink to it.

Note: `global/skills/` is currently just skills that I myself have written. There are other skills on my machine under `~` which are installed by tools like `npx skills ...`.

The root `AGENTS.md` is a *third* thing: instructions for agents editing THIS repo.
It's not symlinked anywhere; it's loaded only when an agent is working inside
`/Users/mmkal/src/agents/`.

## Setup

```sh
./scripts/install.sh
```

Idempotent. Anything real it would overwrite is moved to `<path>.pre-agents-repo.bak`.

Inverse:

```sh
./scripts/uninstall.sh
```

Only removes symlinks that point back into this repo — your `.bak` files stay.

## Auto-commit

Claude Code has a Stop hook wired up in `claude/settings.json` that runs
`scripts/autocommit.sh` at the end of every assistant turn. If this repo is dirty,
it stages and commits with a timestamped message. History is noisy by design — squash
or reset later if you want a tidier log.

opencode's equivalent hook can be wired the same way; see `hooks/` for a reference
fragment. (Not installed automatically yet because opencode's hook schema is less
stable than Claude's.)

## Conventions for agents working on this repo

See `AGENTS.md` (the root one, not `global/AGENTS.md`) for the short version.
