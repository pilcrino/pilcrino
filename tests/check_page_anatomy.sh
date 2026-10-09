#!/usr/bin/env bash
# Page anatomy rules (spec docs/superpowers/specs/2026-10-01-page-anatomy-standards-design.md).
# Each `need FILE 'FIXED STRING'` asserts the string is present. Grown per task.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
need() {
  local f="$1" s="$2"
  [ -f "$f" ] || { echo "ANATOMY FAIL: $f: missing file" >&2; fail=1; return; }
  grep -qF -- "$s" "$f" || { echo "ANATOMY FAIL: $f: missing '$s'" >&2; fail=1; }
}
absent() {
  local f="$1" s="$2"
  [ -f "$f" ] || return
  grep -qF -- "$s" "$f" && { echo "ANATOMY FAIL: $f: must not contain '$s'" >&2; fail=1; }
}

# Task 1: comparison posts standard
need standards/blog-craft.md '## Comparison posts'
need standards/blog-craft.md 'How we compared'
need standards/blog-craft.md 'Best suited to'
need standards/blog-craft.md 'weigh this accordingly'
need standards/blog-craft.md 'facts, not adjectives'

# Task 2: comparison anatomy in templates and personas
need templates/outline.md 'How we compared'
need templates/outline.md 'Best suited to:'
need templates/outline.md 'Trade-off:'
need templates/plan.md '## Comparison criteria'
need templates/plan-review.md 'Transactional, comparison or review plan names its comparison criteria'
need templates/review.md 'Methodology H2 present with criteria and disclosure'
need templates/review.md 'Every comparison table cell is a fact, not an adjective'
need personas/writer.md 'Best suited to'
need personas/editor.md 'How we compared'
need agents/plan-reviewer.md 'Comparison criteria'
need skills/review-blog-post/SKILL.md 'How we compared'
absent standards/blog-craft.md 'module: comparison'

# Task 3: key takeaways and the forty-word answer
need standards/blog-craft.md '## Key takeaways'
need standards/blog-craft.md 'first forty words'
need standards/blog-craft.md 'problem_solution` posts may skip it'
need templates/outline.md '### H2 1: Key takeaways'
need templates/outline.md 'Direct answer'
need personas/writer.md '## Key takeaways'
need personas/writer.md 'first forty words'
need templates/review.md 'Direct answer within the first forty words'
need templates/review.md 'Key takeaways block present'
need skills/review-blog-post/SKILL.md 'Key takeaways'

# Task 4: numbers in images repeated as text
need standards/blog-craft.md 'must also appear as text in the same section'
need skills/suggest-images/SKILL.md 'Values stated in text at'
need templates/images.md 'Values stated in text at:'
need personas/writer.md 'the surrounding paragraph states the values'
need templates/review.md 'Every data image has its values in nearby text'
need skills/review-blog-post/SKILL.md 'a markdown table within the same section counts'

# Task 5: information gain
need standards/blog-craft.md '## Information gain'
need standards/blog-craft.md 'Format alone is not gain'
need templates/plan.md '## Information gain'
need templates/plan.md 'transactional, comparison and review posts'
need templates/plan-review.md 'Information gain named, typed, sourced and placed'
need agents/plan-reviewer.md 'Information gain'
need templates/outline.md '## Information gain placement'
need templates/review.md 'information gain element survived into the draft'
need skills/review-blog-post/SKILL.md 'Information gain'
need personas/editor.md 'Information gain'

# Task 6: version and docs
need .claude-plugin/plugin.json '"version": "0.45.0"'

# Review fixes: rules that must not be module-gated, disclosure only with a product, reviewer inputs
ungated() {
  # Every line matching $2 in $1 must sit outside <!-- module: ... --> blocks; no match is a failure.
  local f="$1" s="$2"
  awk -v s="$s" '
    /<!-- module: / { inblock = 1 }
    /<!-- \/module -->/ { inblock = 0 }
    index($0, s) { seen = 1; if (inblock) bad = 1 }
    END { if (!seen) exit 2; if (bad) exit 1 }' "$f"
  case $? in
    1) echo "ANATOMY FAIL: $f: '$s' sits inside a module block" >&2; fail=1 ;;
    2) echo "ANATOMY FAIL: $f: missing '$s'" >&2; fail=1 ;;
  esac
}
resolved() {
  # Print $1 with every <!-- module: X --> block removed for X in $2 (space-separated), as the workflow does when X is off.
  local f="$1" off="$2"
  awk -v off=" $off " '
    /<!-- module: [a-z]+ -->/ { name = $0; sub(/.*<!-- module: /, "", name); sub(/ -->.*/, "", name); if (index(off, " " name " ")) { skip = 1; next } }
    /<!-- \/module -->/ { if (skip) { skip = 0; next } }
    !skip { print }' "$f"
}
need_resolved() {
  # $3 must survive in $1 after the modules in $2 are stripped.
  local f="$1" off="$2" s="$3" text
  text=$(resolved "$f" "$off")
  grep -qF -- "$s" <<<"$text" || { echo "ANATOMY FAIL: $f: '$s' disappears with modules off ($off)" >&2; fail=1; }
}
ungated personas/writer.md 'How we compared'
ungated standards/blog-craft.md '## Comparison posts'
for off in 'competitors' 'product' 'competitors product'; do
  need_resolved standards/blog-craft.md "$off" 'How we compared'
  need_resolved standards/blog-craft.md "$off" 'Best suited to'
  need_resolved standards/blog-craft.md "$off" 'facts, not adjectives'
  need_resolved personas/writer.md "$off" 'Best suited to'
  need_resolved personas/writer.md "$off" 'never an adjective'
  need_resolved skills/review-blog-post/SKILL.md "$off" 'How we compared'
  need_resolved templates/outline.md "$off" 'Trade-off:'
done
# Codex review 1: first-H2 rule yields to Key takeaways; owner row only with a product; information gain test
need standards/blog-craft.md 'first substantive H2 after the Key takeaways block'
need standards/blog-craft.md 'When `modules.product` is on, the product'
need templates/outline.md 'appears as an option in the table'
need skills/review-blog-post/SKILL.md 'appears as an option in the table'
need standards/blog-craft.md 'checkable or usable information beyond the competing pages'
need agents/plan-reviewer.md 'checkable or usable information beyond the competing pages'
need personas/writer.md 'include when present in the outline; optional for problem_solution'
# Codex review 2: firsthand test fits the type; review template carries the product-off condition
need standards/blog-craft.md 'firsthand experience of what it describes'
need agents/plan-reviewer.md 'firsthand experience of what it describes'
need templates/review.md 'appears as an option in the table'
need templates/outline.md 'when `modules.product` is on'
need personas/editor.md 'disclosure line when `modules.product` is on'
need skills/review-blog-post/SKILL.md 'absence is not an issue when `modules.product` is off'
need agents/plan-reviewer.md '{profile_dir}/product.md'
need agents/plan-reviewer.md 'research/reddit.md'
need skills/blog-post-workflow/SKILL.md 'research/reddit.md` and `research/x.md` when present'
# 0.37.0: comparison and review intents, page type sets the default intent
need standards/blog-craft.md 'appears as an option in the table'
need personas/writer.md 'appears as an option in the table'
need skills/review-blog-post/SKILL.md 'only when the draft names this blog'"'"'s product'
need standards/blog-craft.md '| comparison |'
need standards/blog-craft.md '| review |'
need standards/blog-craft.md 'first criterion H2'
need standards/blog-craft.md 'How I tested'
need templates/brief.md 'comparison | review'
need templates/plan.md 'comparison | review'
need templates/outline.md 'comparison | review'
need skills/review-blog-post/SKILL.md 'intent `review`'
need agents/plan-reviewer.md '`comparison` or `review`'
need skills/blog-post-workflow/SKILL.md 'pageType'

[ "$fail" -eq 0 ] && echo "ANATOMY OK" || exit 1
