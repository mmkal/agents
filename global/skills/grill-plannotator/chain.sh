#!/bin/bash
# Optimistic plannotator chain. Usage: chain.sh <dir> [startN]
# Opens <dir>/rev-N.md in plannotator (gate+json), saves decision to <dir>/decisions/rev-N.json,
# emits ONE stdout line per decision (run under the Monitor tool):
#   "rev-N THUMBSUP"  -> lone 👍 annotation, rev-(N+1).md opens instantly (or as soon as it exists)
#   "rev-N FEEDBACK"  -> anything else; stale rev-(N+1).md deleted, waits for a fresh one
#   "rev-N APPROVED"  -> exit. Approve on a rev that still lists `## Open` items is treated as 👍 instead
#                        (plannotator's Approve otherwise skips the whole remaining interview).
HERE="$(cd "$(dirname "$0")" && pwd)"; D="$1"; N=${2:-1}; mkdir -p "$D/decisions"
has_open() { awk '/^## Open/{f=1;next} f&&/^## /{f=0} f' "$1" | grep -qE '^\s*- '; }
while true; do
  until [ -f "$D/rev-$N.md" ]; do sleep 0.5; done
  J="$D/decisions/rev-$N.json"
  plannotator annotate "$D/rev-$N.md" --gate --json > "$J" 2>"$D/decisions/rev-$N.err"
  DEC=$(jq -r '.decision // ""' "$J" 2>/dev/null)
  if [ "$DEC" = "approved" ] || [ "$DEC" = "approve" ]; then
    # Approve with open items left = user meant "yes to this question", not "skip the rest". Continue like a 👍.
    if has_open "$D/rev-$N.md"; then
      echo "rev-$N APPROVED-WITH-OPEN-ITEMS -> treating as 👍, opening rev-$((N+1)) ($([ -f "$D/rev-$((N+1)).md" ] && echo instantly || echo waiting for file))"
      N=$((N+1)); continue
    fi
    echo "rev-$N APPROVED"; exit 0
  fi
  if node "$HERE/is-thumbsup.mjs" "$J"; then
    echo "rev-$N THUMBSUP -> opening rev-$((N+1)) ($([ -f "$D/rev-$((N+1)).md" ] && echo instantly || echo waiting for file))"
  else
    rm -f "$D/rev-$((N+1)).md"
    echo "rev-$N FEEDBACK (stale rev-$((N+1)).md discarded): $(jq -r '.feedback' "$J" | head -c 1500)"
  fi
  N=$((N+1))
done
