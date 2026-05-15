---
name: nightly-architecture-improvement
description: Run the final bedtime architecture pass and refresh open PRs against it. Use when bedtime work is otherwise complete and global/AGENTS.md says to run nightly architecture improvement.
---

# Nightly Architecture Improvement

Use this after the normal bedtime task run is complete: task PRs are open, CI has been checked, PRs have been reviewed, and in-scope follow-up work has been started when there is still overnight budget.

Goal: land one high-impact architecture improvement without making the rest of the open PR queue stale.

## Architecture Pass

1. Choose the base branch: use the bedtime base branch if one exists, otherwise use the default branch.
2. Worktreeify a new architecture-improvement task from that base branch.
3. Open the PR early, once the task file captures the goal and assumptions.
4. Run the `improve-codebase-architecture` skill.
5. If that skill surfaces candidates and would normally pause for user choice, run a small `grill-you` pass on the candidate list. Use it to choose one candidate, optimize for highest impact rather than lowest hanging fruit, and flesh the choice out into an implementation-ready task.
6. Record the `grill-you` assumptions in the task file and PR body.
7. Implement the chosen architecture change, updating `CONTEXT.md` or ADRs when the architecture skill calls for it.
8. Push the architecture PR with title `[bedtime-architecture] <...>` and update its body for a human reviewer: describe the net effect, the main design choice, and the checks run.

Do not stop overnight just because candidate selection would normally require the user. Make the best defensible choice and make the guess easy to review.

## Refresh Open PRs

After the architecture PR is pushed, create replacement compare branches for every open PR other than the architecture PR itself. The point is to preserve the queue, not to rewrite cleanly reusable work.

For each open PR:

1. Create a replacement branch from the architecture PR head.
2. Try `git merge --no-edit <old-pr-head>` first.
3. If the merge is clean, push that replacement branch and move on.
4. If conflicts are small or mechanical, resolve them while preserving the old PR's product/API decisions and useful commit history.
5. If the old branch has noisy history and the meaningful commits are clear, cherry-pick those commits onto the replacement branch.
6. Reimplement only when the architecture change invalidates the old implementation shape, or when preserving the old commits would be harder to review than rebuilding the change.
7. Run checks targeted to both the old PR's touched area and the architecture change's touched area.
8. Push the replacement branch, but do not open a duplicate PR unless the user asks.

## Rules

- Merge, never rebase. Do not rewrite the original PR branch.
- Preserve already-made product/API decisions unless the architecture change directly contradicts them.
- Keep replacement branch names explicit, for example `<architecture-branch>-pr-123`.
- In trivial cases, lifting old code is fine, but do not reimplement from scratch when a clean merge would do.
- Add a table to the architecture PR body mapping each old PR to its replacement compare link.

Use this table shape in the architecture PR body:

```md
| Existing PR | Replacement compare | Strategy |
| --- | --- | --- |
| [#123 `old branch`](https://github.com/org/repo/pull/123) | [comparison](https://github.com/org/repo/compare/architecture-branch...architecture-branch-pr-123) | clean merge |
```
