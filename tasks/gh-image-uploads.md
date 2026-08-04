---
status: ready
size: small
---

# Prefer `gh-image` for pull request media

## Status

The repo docs have been audited and the live upload path has been proved on PR #2. The instruction change and final verification are still pending.

## Goal

Replace the long browser-first media upload recipe in `global/AGENTS.md` with short `gh image` guidance. Agents should upload through the CLI, paste its output into the PR body or comment, and use browser automation only as a fallback.

## Decisions

- `gh image <path> --repo owner/repo` is the default upload path.
- Keep the printed reference on its own paragraph so GitHub renders images and videos inline.
- Say that `gh-image` reads the active GitHub browser session by default; do not tell agents to expose the session cookie on the command line.
- Keep one browser-fallback sentence instead of the current Playwriter and base64/DOM recipes.
- Change only the global instructions and this task file.

## Checklist

- [x] Read all repo Markdown/text docs and locate overlapping media guidance. _Only the pull request media section in `global/AGENTS.md` describes GitHub uploads._
- [x] Prove the installed extension against a real video. _`gh image` uploaded `captions-video-rendered.mp4` to PR #2 and GitHub rendered its URL as an inline `<video>`._
- [ ] Replace the browser-first recipe with concise `gh-image` instructions.
- [ ] Preserve a small fallback for environments where the extension or browser session is unavailable.
- [ ] Review the final diff for portability, token safety, and plain wording.
- [ ] Move this task to `tasks/complete/` when the PR is ready.

## Out of scope

- Installing or vendoring `gh-image`.
- Adding a new agent skill for one command.
- Changing unrelated repo or tool-specific docs.

## Implementation notes

- 2026-08-04: The clean worktree is based on `origin/main`; local `main` has 13 unrelated, unpushed commits.
- 2026-08-04: Upstream documents that `gh-image` reads the browser's `user_session` cookie, gets GitHub's internal upload token and S3 policy, uploads the file, finalizes it with GitHub, then prints ready-to-paste Markdown or a bare video URL.
