---
name: grill-with-plannotator
description: Grill user about plan via Plannotator page instead of chat. One question per round, top of plan doc. User answers via annotations. Use when user says "grill with plannotator", "grill me in plannotator", or invokes /grill-with-plannotator.
---

Relentless interview about plan, run through Plannotator review page. Requires Plannotator installed (hooks intercept `ExitPlanMode`). Each round = one denied plan revision. Plannotator revise loop IS interview loop.

## Round structure

Plan doc, every round, this order:

1. `## ❓ Question N` — top of doc. ONE question only. Include `**Recommended:**` line with your suggested answer. Question must be answerable in single comment.
2. `**Reopened by your change:** #3, #7` — only if last round's feedback reopened settled decisions. See ripple rule.
3. `## Decisions` — numbered list, stable IDs, never renumber. Each: decision + chosen answer + one-line why. Settled decisions only.
4. `## Open` — unresolved branches, no detail. Shows user how much grilling remains.

Regenerate doc each round. Not append-only. No transcript. Stable headings, stable ordering → Plannotator plan diff stays readable as free changelog.

## Loop

1. Build doc per round structure. Present via `ExitPlanMode`. Plannotator opens in browser.
2. User annotates page:
   - Comment on Question block = answer.
   - No comment on Question block = recommended answer accepted.
   - Comment on ANY other item = revision request on that item. Any decision, any age. This is the point of the format — user points at old decision instead of describing it.
   - Deny + Send Feedback = continue interview.
   - Approve = end interview.
3. On feedback: settle question (their answer, or recommendation if silent). Apply revisions to old decisions. Run ripple rule. Pick next question. Back to 1.
4. On approve: settle all remaining open items with recommended answers. Emit final plan. Done.

## Ripple rule

Settled decision revised → recompute dependents. Rules:

- Reopen ONLY decisions now in conflict with revision. List their IDs under `Reopened by your change`.
- Settled + still consistent = stays settled. Never re-litigate.
- Reopened decisions get asked before new branches. Oldest first.
- Never reopen more than user's revision forces. Thrash kills interviews.

## Question discipline

Same as grill-me: one question per round. Always give recommended answer. Answer findable in codebase → explore codebase, never ask. Push back on weak answers — next round's question can challenge previous answer. No softballs.

## Done when

No open branches. No reopened decisions. User approves. Final plan doc = last approved page.
