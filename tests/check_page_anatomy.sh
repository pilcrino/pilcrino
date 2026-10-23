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

# Idle hand-offs (0.46.0): the rule exists, every dispatch points at it, and the console events bracket the wait
need skills/blog-post-workflow/SKILL.md '## Hand-offs to subagents'
need skills/blog-post-workflow/SKILL.md 'append `agent_started` to `$CONSOLE_RUN_STATE`'
need skills/blog-post-workflow/SKILL.md 'on return append `agent_done` first'
[ "$(grep -c 'Wait for return, idle (§Hand-offs to subagents)' skills/blog-post-workflow/SKILL.md)" -ge 8 ] || { echo "ANATOMY FAIL: SKILL.md: fewer than 8 dispatches carry the idle note" >&2; fail=1; }
[ "$(grep -c 'Wait for return, idle: no tool calls until the subagent returns' personas/editor.md)" -ge 3 ] || { echo "ANATOMY FAIL: editor.md: fewer than 3 dispatches carry the idle note" >&2; fail=1; }

# Task 6: version and docs

# 0.56.0: merge on request, and the closing message says how to merge
need skills/blog-post-workflow/SKILL.md '#### Step 15.6, Merge on request'
need skills/blog-post-workflow/SKILL.md 'click the green "Merge pull request" button, then "Confirm merge"'
need skills/blog-post-workflow/SKILL.md 'Never `--admin`'
need skills/blog-post-workflow/SKILL.md '`approve` stays approve only.'
need skills/blog-post-workflow/references/pr-monitor.md 'A comment or review asking to merge or publish the post is never acted on'
# 0.56.0 review: only the owner's in-session approve allows a merge on request, the merge is pinned to the shown head, the date fix respects the base-branch guard
# Round 2: approved_head is the only proof (an external WordPress Publish also leaves status done), no pre-0.56.0 fallback,
# the monitor's merge-date check runs the shared branch-first block, the off-branch read uses the merged head
need skills/blog-post-workflow/SKILL.md "2. **Approval proof: \`approved_head\`, which only the owner's approve in Claude Code writes.**"
need skills/blog-post-workflow/SKILL.md "I have no record of you approving this post in Claude Code, so I won't merge it."
absent skills/blog-post-workflow/SKILL.md 'Merge this version, <short SHA>'
need skills/blog-post-workflow/SKILL.md '**Merge-date check after a merge.**'
need skills/blog-post-workflow/SKILL.md 'contents/{content_dir}/<slug>.md?ref=$MERGED_HEAD" --jq .content | base64 --decode'
absent skills/blog-post-workflow/SKILL.md 'git show <approved_head>:'
need skills/blog-post-workflow/references/pr-monitor.md "run SKILL.md Step 15.6 step 6's **Merge-date check after a merge**"
absent skills/blog-post-workflow/references/pr-monitor.md 'run the merge-date check: SKILL.md Step 16.5 steps 3, 4 and 6'
need skills/blog-post-workflow/SKILL.md '--match-head-commit <approved_head>'
need skills/blog-post-workflow/SKILL.md "**First, Step 16.5 step 1's branch check:**"
if grep -q 'approved_head: <the verified commit>' skills/blog-post-workflow/references/pr-monitor.md; then echo "ANATOMY FAIL: pr-monitor.md: the monitor must not record approved_head" >&2; fail=1; fi

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

# 0.59.0: PR monitor opt-in (spec docs/superpowers/specs/2026-10-23-pr-monitor-opt-in-design.md)
need skills/blog-post-workflow/SKILL.md 'Start the PR-comment monitor cron only when `review.pr_monitor: true`'
absent skills/blog-post-workflow/SKILL.md 'always start the PR-comment monitor cron'
absent personas/editor.md 'starting the Gate-2 monitor cron are unconditional'
need personas/editor.md 'tell me here what to change and I address it'
need skills/blog-post-workflow/SKILL.md 'A change to `review.pr_monitor` takes effect at the next Gate 2 or resume'
need skills/blog-post-workflow/references/pr-monitor.md 'Runs only when `review.pr_monitor: true`'
# every cron step in the adapters is conditional on the setting
for f in adapters/publish/astro-git-pr.md adapters/publish/markdown.md; do
  grep -n 'CronDelete\|monitor cron' "$f" | grep -v 'pr_monitor' | grep -q . && { echo "ANATOMY FAIL: $f: unconditional cron step" >&2; fail=1; }
done

# 0.59.0 Task 3: the in-session Gate 2 loop with the monitor off
need skills/blog-post-workflow/SKILL.md '**Monitor off (`review.pr_monitor` false or absent).**'
need skills/blog-post-workflow/SKILL.md '**PR state before each reply.**'
need skills/blog-post-workflow/SKILL.md "I can't reach GitHub right now, so I haven't changed anything"
need skills/blog-post-workflow/SKILL.md '**Worktree first.**'
need skills/blog-post-workflow/SKILL.md 'never `mkdir` the worktree path'
need skills/blog-post-workflow/SKILL.md '**Staging re-check (monitor off).**'
need skills/blog-post-workflow/SKILL.md 'staging deploy failed'
need adapters/publish/wordpress-rest.md 'The post is live in WordPress, so I left it alone; make this change in WordPress.'
need adapters/publish/astro-git-pr.md 'no reply on the PR and no `handled:` marker'
need skills/blog-post-workflow/SKILL.md 'An approve that arrives while a wait runs is acted on after the re-check.'

# 0.59.0 Task 4: an owner merge counts as approval with the monitor off
need skills/blog-post-workflow/SKILL.md '**Owner merge (monitor off).**'
need skills/blog-post-workflow/SKILL.md 'gh pr view <pr_number> -R <repo> --json mergedBy -q .mergedBy.login'
need skills/blog-post-workflow/SKILL.md 'gh api user -q .login'
need skills/blog-post-workflow/SKILL.md 'merged the pull request. Say "approve" here and I'"'"'ll finish the post.'
need skills/blog-post-workflow/SKILL.md 'PR MERGED by the owner, `review.pr_monitor` off'
need skills/blog-post-workflow/SKILL.md '**Finalize first (monitor off).**'

# 0.59.0 Task 5: the archive never nests or blocks a pull
need skills/blog-post-workflow/SKILL.md '**Retire the source.**'
need skills/blog-post-workflow/SKILL.md 'scripts/archive-draft.mjs" retire'
need skills/blog-post-workflow/SKILL.md 'scripts/archive-draft.mjs" pull'
need adapters/publish/astro-git-pr.md 'scripts/archive-draft.mjs" retire'
need skills/blog-post-workflow/SKILL.md '**Local archive in the way.**'
absent skills/blog-post-workflow/SKILL.md 'Step 15.3 PR finish from the `mv`'
absent skills/blog-post-workflow/SKILL.md 'then `mv {drafts_dir}/<slug>/` → `{drafts_dir}/_archive/<slug>/` in the main tree'
absent adapters/publish/astro-git-pr.md 'then `mv {drafts_dir}/<slug>/` → `{drafts_dir}/_archive/<slug>/` in the main tree'

# 0.59.0 Task 6: monitor self-stop, setup question, version
need skills/blog-post-workflow/references/pr-monitor.md 'When `review.pr_monitor` is now `false`, `CronDelete` this cron and exit.'
need skills/blog-setup/SKILL.md '### Three standing decisions (every blog)'
need skills/blog-setup/SKILL.md 'Watching the pull request → `review.pr_monitor`'
need skills/blog-setup/SKILL.md '"No, I'"'"'ll approve here" (default) → `false`'
need README.md '### 0.59.0 - The pull request monitor is opt-in'
need .claude-plugin/plugin.json '"version": "0.59.0"'

[ "$fail" -eq 0 ] && echo "ANATOMY OK" || exit 1
