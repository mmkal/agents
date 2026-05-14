---
name: grill-you
description: Flesh out a high-level task by spawning a sub-claude that runs `grill-with-docs` on the topic, then answering its questions on behalf of the user autonomously. Produces a task file specific enough for autonomous implementation.
---

# grill-you

Interview a sub-claude on the user's behalf. The sub-claude will run `grill-with-docs` and ask you questions as if you were the user. Answer the way the *actual* user would — using CLAUDE.md, memory, recent conversation, and the codebase — so by the end you have a task file fleshed out enough to hand off.

You are in a worktree. This is low-stakes: the user is not obligated to use the output. Make product decisions, make taste calls, make guesses. The only requirement is that guesses are logged as guesses so the user can spot them in review.

## Setup

1. Pick a kebab-case slug for the topic (`<slug>`). Use the same slug for branch, worktree, task file, and grill workspace.
2. Create a worktree at `../worktrees/<repo>/<slug>` on branch `<slug>` (or use the current branch if the user already set one up).
3. Create workspace `/tmp/grillings/<repo>/<slug>/`:
   - `dossier.md` — the brief for sub-claude (see **Dossier**).
   - `interview.md` — running transcript. Start with a header and empty body.
   - `addenda/` — empty. The user may drop numbered addendum files here mid-interview.
   - `session.env` — stores the sub-claude session id once created.
4. Commit a stub task file at `tasks/<slug>.md` with `status: needs-grilling` so the kickoff is visible.

## Dossier

Write `/tmp/grillings/<repo>/<slug>/dossier.md` before spawning sub-claude. Must include:

- The topic (verbatim from the user, then reframed in the project's voice).
- Who the imagined reader / end-consumer is.
- The three phases (interview → task file + PR → implementation).
- The rule: **one question at a time**, sub-claude answers from the codebase itself before asking, each question includes sub-claude's recommended answer.
- Current surfaces / architecture relevant to the topic (file paths, not contents).
- **Things already decided** — anything locked in. Reduces low-value questions.
- **Out of scope** — things sub-claude should not ask about.
- Stopping rule: "when shared understanding is reached across every branch, stop asking, say 'ready for Phase 2', and wait."

Dossier quality is the single biggest determinant of interview quality. Spend real time on it.

## Phase 1: interview loop

For each turn N starting at 1:

1. **Pre-turn addendum sweep.** List `/tmp/grillings/<repo>/<slug>/addenda/` for files newer than the last sweep. For each new file, read it and fold its content into your next answer. Append to `interview.md`:
   ```
   ### Addendum <NN> applied before turn <N> — <timestamp>
   > <one-line summary of what changed>
   ```

2. **Turn 1 — spawn.**
   ```
   claude --print \
     --permission-mode bypassPermissions \
     --output-format json \
     --model sonnet \
     "$(cat /tmp/grillings/<repo>/<slug>/dossier.md)\n\nRead the dossier above. Invoke grill-with-docs. Ask question 1 only." \
     | tee /tmp/grillings/<repo>/<slug>/turn-01-raw.json
   ```
   Extract `.session_id` into `session.env`.

3. **Turns 2+ — resume.**
   ```
   claude --print \
     --resume "$(cat /tmp/grillings/<repo>/<slug>/session.env)" \
     --permission-mode bypassPermissions \
     --output-format json \
     --model sonnet \
     "<your answer>" \
     | tee /tmp/grillings/<repo>/<slug>/turn-NN-raw.json
   ```

4. **Log.** Append to `interview.md`:
   ```
   ## Q<N> — <one-line gist> — <timestamp>
   <sub-claude's question, thinking blocks stripped>

   ## A<N> — <timestamp>
   <your answer as sent, verbatim>

   ---
   ```

5. **Termination check.** If sub-claude says "ready for Phase 2" (or semantic equivalent), exit the loop.

### Answering discipline

You are standing in for the user. For each question:

- Check CLAUDE.md (project and global) and memory for a locked preference.
- Check the codebase for the factual answer (sub-claude was told to do this but often doesn't fully — do it yourself).
- Make the call. Pick the option that fits the user's voice and the project's direction. Decisive and terse.
- Mark guesses. When the answer is a judgement call rather than a fact you can point to, tag it in your answer with `[guess: <one-line reason>]` so it's visible in `interview.md` and in review. Don't hedge — guess, then flag the guess.
- Override sub-claude's recommendation freely when you disagree; that's the point.

## Phase 2: task file + PR

After the interview terminates:

1. Write `tasks/<slug>.md` in the repo's task-file convention (frontmatter with `status: ready`, short exec summary, checklist, out-of-scope, for-the-next-pass). Carry forward every `[guess: ...]` from the interview into a **Guesses and assumptions** section so the user can spot-check them.
2. Copy `interview.md` to `tasks/<slug>.interview.md` (or link to it from the task file) so the decision trail survives in the PR.
3. Commit the task file + interview transcript. Push. Open a PR whose body links to the interview log for reviewers.

## Phase 3: implementation (optional)

Only proceed into implementation if the invoking instruction asks for it ("grill-you then implement", bedtime-style chained tasks, etc.). If so: treat `tasks/<slug>.md` as the spec and work from there, committing progress to the same branch.

## Refreshing the interview log for the user

The user may ask mid-interview for a snapshot. Respond with the path to `/tmp/grillings/<repo>/<slug>/interview.md` — it's already up to date because you wrote it each turn.

If `interview.md` is somehow stale or missing (crash recovery), fall back to scraping sub-claude's jsonl at `~/.claude/projects/*/<session-id>.jsonl` and render from that.

## Recovery

If the loop crashes:
- `interview.md` is authoritative for what happened.
- `session.env` has the sub-claude session id; resume it with the same invocation.
- `addenda/` survives; re-sweep from turn 1 if unsure what's been applied (the log will show).
