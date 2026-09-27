#!/usr/bin/env bash
# Appends a numbered, dated entry skeleton to AGENT_LOG.md at the repo root.
# Usage: bash .claude/skills/agent-log/scripts/new_entry.sh "Short title"
set -euo pipefail

title="${1:?usage: new_entry.sh \"Short title\"}"
skill_dir="$(cd "$(dirname "$0")/.." && pwd)"
root="$(cd "$skill_dir/../../.." && pwd)"
log="$root/AGENT_LOG.md"
template="$skill_dir/assets/entry-template.md"

if [ ! -f "$log" ]; then
  printf '# Agent Log\n\nChronological record of significant agent interactions while building PolicyQuote. Entries are written as the work happens, never backfilled.\n' > "$log"
fi

n=$(( $(grep -c '^## Entry ' "$log" || true) + 1 ))
# Literal replacement via awk + ENVIRON: no quote, backslash or & surprises across bash versions.
entry="$(N="$n" TITLE="$title" DATE="$(date '+%Y-%m-%d %H:%M')" awk '
  function rep(s, ph, val,   out, i) {
    out = ""
    while ((i = index(s, ph)) > 0) { out = out substr(s, 1, i - 1) val; s = substr(s, i + length(ph)) }
    return out s
  }
  { $0 = rep($0, "{{N}}", ENVIRON["N"]); $0 = rep($0, "{{TITLE}}", ENVIRON["TITLE"]); $0 = rep($0, "{{DATE}}", ENVIRON["DATE"]); print }
' "$template")"

printf '\n%s\n' "$entry" >> "$log"
echo "Appended Entry $n to $log. Replace every TODO in it now."
