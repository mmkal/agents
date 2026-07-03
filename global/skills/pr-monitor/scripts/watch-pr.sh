#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  watch-pr.sh OWNER REPO PR [--interval SECONDS] [--loops COUNT]

Prints an actionable GitHub PR inbox:
  - unresolved review threads via GraphQL pullRequest.reviewThreads
  - top-level issue comments
  - review summaries
  - gh pr checks rollup

Keep this in the foreground. A detached log-only loop is not an actionable monitor.
USAGE
}

if [[ $# -lt 3 ]]; then
  usage >&2
  exit 2
fi

OWNER="$1"
REPO="$2"
PR="$3"
shift 3

INTERVAL=60
LOOPS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval)
      INTERVAL="${2:?missing --interval value}"
      shift 2
      ;;
    --loops)
      LOOPS="${2:?missing --loops value}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

iteration=0
last_snapshot=""

while true; do
  iteration=$((iteration + 1))
  now="$(date -Iseconds)"

  threads="$(
    gh api graphql \
      -F owner="$OWNER" \
      -F repo="$REPO" \
      -F number="$PR" \
      -f query='query($owner:String!, $repo:String!, $number:Int!) {
        repository(owner:$owner, name:$repo) {
          pullRequest(number:$number) {
            reviewThreads(first:100) {
              nodes {
                id isResolved isOutdated path line originalLine
                comments(first:100) {
                  nodes {
                    databaseId url body createdAt
                    author { login }
                  }
                }
              }
            }
          }
        }
      }' |
      jq -r '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.isResolved == false)
        | [
            .id,
            .path,
            (.line // .originalLine // ""),
            .comments.nodes[-1].author.login,
            .comments.nodes[-1].url,
            (.comments.nodes[-1].body | gsub("\n"; " "))
          ]
        | @tsv'
  )"

  issue_comments="$(
    gh api "repos/$OWNER/$REPO/issues/$PR/comments" --paginate |
      jq -r '.[] | [.node_id, .user.login, .created_at, .html_url, (.body | gsub("\n"; " "))] | @tsv'
  )"

  reviews="$(
    gh api "repos/$OWNER/$REPO/pulls/$PR/reviews" --paginate |
      jq -r '.[] | [.node_id, .user.login, .state, .submitted_at, .html_url, ((.body // "") | gsub("\n"; " "))] | @tsv'
  )"

  checks="$(gh pr checks "$PR" --repo "$OWNER/$REPO" 2>&1 || true)"

  snapshot="$(printf 'UNRESOLVED REVIEW THREADS\n%s\n\nISSUE COMMENTS\n%s\n\nREVIEWS\n%s\n\nCHECKS\n%s\n' "$threads" "$issue_comments" "$reviews" "$checks")"

  if [[ "$snapshot" != "$last_snapshot" ]]; then
    printf '\n[%s] PR #%s inbox changed\n\n%s\n' "$now" "$PR" "$snapshot"
    last_snapshot="$snapshot"
  else
    printf '[%s] no PR inbox changes\n' "$now"
  fi

  if [[ "$LOOPS" != "0" && "$iteration" -ge "$LOOPS" ]]; then
    exit 0
  fi

  sleep "$INTERVAL"
done
