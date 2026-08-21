---
name: grill-with-plannotator
description: Grill user about plan via Plannotator page instead of chat. One question per round, top of plan doc. User answers via annotations. Use when user says "grill with plannotator", "grill me in plannotator", or invokes /grill-with-plannotator.
---

Relentless interview about plan, run through Plannotator review page. Each round = one plan revision file opened via `plannotator annotate --gate --json`. NOT via `ExitPlanMode` — that blocks you; this flow needs you writing the next revision while the user reads the current one.

## Round structure

Plan doc, every round, this order:

1. `## ❓ Question N` — top of doc. ONE question only. Include `**Recommended:**` line with your suggested answer. Question must be answerable in single comment.
2. `**Reopened by your change:** #3, #7` — only if last round's feedback reopened settled decisions. See ripple rule.
3. `## Decisions` — numbered list, stable IDs, never renumber. Each: decision + chosen answer + one-line why. Settled decisions only.
4. `## Open` — unresolved branches, no detail. Shows user how much grilling remains.

Regenerate doc each round. Not append-only. No transcript. Stable headings, stable ordering → Plannotator plan diff stays readable as free changelog.

## Optimistic chain

Files: `<dir>/rev-N.md` (dir = scratchpad subfolder). Runner: `chain.sh` next to this SKILL.md.

1. Write `rev-1.md` AND `rev-2.md` (rev-2 = optimistic: assumes user takes Q1's recommendation).
2. Start Monitor (persistent, 1h): `<skill-dir>/chain.sh <dir> 1`. One event per decision.
3. On every event, stay one-to-two revisions ahead:
   - `THUMBSUP` → user took the recommendation; rev-(N+1) is already open. Write `rev-(N+2).md` optimistically.
   - `FEEDBACK` → rev-(N+1) was auto-deleted as stale. Any later queued revs are stale too: `rm` them. Settle/revise per feedback, run ripple rule, then write the new `rev-(N+2).md` FIRST and `rev-(N+1).md` LAST (the chain grabs rev-(N+1) the instant it exists — never let it see a half-written file).
   - `APPROVED` → done. If the approved rev still had a question, settle it with the recommendation.
4. When the last open item is being asked, queue a question-less "final plan — approve to finish" rev behind it.

Lone 👍 = exactly one annotation, labeled 👍, highlight starts at `Recommended:` and is single-line, no comment text (see `is-thumbsup.mjs`). 👍 anywhere else, multi-line highlights, or "👍 but also…" take the slow path — you read it and decide (a 👍 on "Alternatives: (a)…" is an answer, not an LGTM). Annotations on other items = revision requests on those items, any age.

Approve button on a rev that still has `## Open` items = chain treats it as 👍 (plannotator's Approve would otherwise end the whole interview). Only a rev with an empty `## Open` ends on Approve — so the final page must exist as its own rev.

Post the plannotator URL? Not needed — the chain opens the browser itself. Keep chat messages to one line per round ("Rev 7 open, rev 8 queued").

## Ripple rule

Settled decision revised → recompute dependents. Rules:

- Reopen ONLY decisions now in conflict with revision. List their IDs under `Reopened by your change`.
- Settled + still consistent = stays settled. Never re-litigate.
- Reopened decisions get asked before new branches. Oldest first.
- Never reopen more than user's revision forces. Thrash kills interviews.

## Question discipline

Same as grill-me: one question per round. Always give recommended answer. Answer findable in codebase → explore codebase, never ask. Push back on weak answers — next round's question can challenge previous answer. No softballs.

## Done when

No open branches. No reopened decisions. User approves. Final plan = last approved rev (with its recommendation applied, if it still had a question).
