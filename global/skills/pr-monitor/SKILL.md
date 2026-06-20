---
name: pr-monitor
description: Monitor GitHub pull requests for red CI, unresolved review threads, and comments in an actionable way. Use when asked to monitor/watch a PR, handle review feedback, fix red CI, or keep checking GitHub after opening a PR.
---

# PR Monitor

Use this skill when a user asks you to monitor a PR, handle comments, fix red CI, or keep checking GitHub after opening/updating a PR.

## Hard Rule

A detached process that only writes `gh` output to a log file is not a monitor. It does not wake the active agent, does not reply, does not resolve threads, and can silently die.

Only say a PR is being monitored when one of these is true:

- you are keeping a foreground polling loop active in the current turn and will act on changes before final response;
- you have dispatched an external event-driven agent/workflow that can act independently;
- you clearly tell the user the monitor is only a passive log and will not wake you.

## Quick Start

Run the helper in the foreground while you continue PR work:

```bash
~/.codex/skills/pr-monitor/scripts/watch-pr.sh iterate iterate 1570 --interval 60 --loops 30
```

If you are working from the source repo before install:

```bash
/Users/mmkal/src/agents/global/skills/pr-monitor/scripts/watch-pr.sh iterate iterate 1570 --interval 60 --loops 30
```

The helper prints:

- unresolved review threads from GraphQL `pullRequest.reviewThreads`;
- top-level issue comments;
- PR review summaries;
- `gh pr checks` status.

Treat any printed item as an inbox item. Stop the loop, handle it, reply/resolve, push fixes, then restart or recheck.

## Required Review Thread Flow

1. Query unresolved review threads with GraphQL, not `gh pr view --json comments,reviews`.
2. Independently decide whether the thread is valid.
3. If valid, change code/docs/tests.
4. Reply starting with `🤖`.
5. Resolve with `resolveReviewThread`.
6. Re-query `reviewThreads` and confirm it no longer appears unresolved.

Reply and resolve:

```bash
THREAD_ID='PRRT_...'
BODY='🤖 Handled in <commit>: <brief summary>.'

gh api graphql -F threadId="$THREAD_ID" -F body="$BODY" \
  -f query='mutation($threadId:ID!, $body:String!) {
    reply: addPullRequestReviewThreadReply(input: {
      pullRequestReviewThreadId: $threadId,
      body: $body
    }) { comment { id url } }
    resolve: resolveReviewThread(input: { threadId: $threadId }) {
      thread { id isResolved }
    }
  }'
```

Top-level issue comments do not have review-thread resolution state. Reply with:

```bash
gh pr comment "$PR" --repo "$OWNER/$REPO" --body '🤖 Handled in <commit>: <brief summary>.'
```

## CI Flow

Use `gh pr checks <PR>` for the rollup. If a check is red, inspect that job:

```bash
gh run view <run-id> --job <job-id> --log-failed
```

Do not assume red CI is caused by your change. If the failure is unrelated or flaky, say so, but still either rerun it or explain why not.

## Long-Running Monitoring

Current agent threads cannot be woken by a background shell process after final response. For a real 24-hour monitor, dispatch an event-driven workflow/agent instead of starting `nohup`.

In this repo, the closest current stopgap is Pullfrog:

```bash
gh workflow run pullfrog.yml -R iterate/iterate -r main \
  -f name="PR #1570 review follow-up" \
  -f prompt="Handle unresolved review threads on https://github.com/iterate/iterate/pull/1570. Query pullRequest.reviewThreads via GraphQL. Reply to each handled thread starting with 🤖, resolve only after independently handling it, and do not rewrite history."
```
