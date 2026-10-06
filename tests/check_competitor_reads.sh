#!/usr/bin/env bash
# Post runs read competitor profiles from the base branch, never the working
# tree (spec docs/superpowers/specs/2026-10-06-competitor-profiles-from-base-design.md).
# A line naming {competitors_dir}/ with a read instruction is allowed only when
# it also routes the read through the script, the snapshot or git show.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
say() { echo "COMPETITOR READS FAIL: $*" >&2; fail=1; }

# Prints offending lines of the given files; exit 0 when any were found.
bad_lines() {
  grep -nE '\{competitors_dir\}/' "$@" \
    | grep -E '(Glob|Read|read|reads|re-read|open)\b' \
    | grep -vE 'competitor-profiles\.mjs|research/profiles/|git show'
  grep -nF 'profile path in the brief' "$@"
}

# Self-test: every fixture line must be caught.
want=$(grep -c . tests/fixtures/competitor-reads-bad.md)
got=$(bad_lines tests/fixtures/competitor-reads-bad.md | wc -l | tr -d ' ')
[ "$got" -eq "$want" ] || say "self-test caught $got of $want fixture lines"

READERS="skills/blog-post-workflow/SKILL.md personas/editor.md agents/blog-researcher.md"
out=$(bad_lines $READERS)
[ -z "$out" ] || say "direct profile reads remain:
$out"

for f in $READERS skills/blog-post-workflow/references/config-schema.md; do
  grep -qF 'competitor-profiles.mjs' "$f" || say "$f does not name competitor-profiles.mjs"
done
grep -qF 'research/profiles/' agents/blog-researcher.md || say "agents/blog-researcher.md does not read research/profiles/"
[ "$(grep -cF 'research/profiles/' agents/blog-researcher.md)" -ge 3 ] || say "agents/blog-researcher.md: inputs table and competitor items must both name research/profiles/"
grep -qF 'profile_paths=' skills/blog-post-workflow/SKILL.md || say "SKILL.md researcher spawn does not pass profile_paths"
# Prose wraps: compare phrases with newlines and runs of spaces collapsed.
has_phrase() { tr -s '\n ' '  ' < "$1" | grep -qF -- "$2"; }
REF=skills/blog-post-workflow/references/competitor-profiles.md
has_phrase "$REF" 'no valid Last verified date' || say "null-date hard stop missing"
has_phrase "$REF" 'Never fall back to the working-tree copy' || say "non-zero-exit hard stop missing"
has_phrase "$REF" 'whenever `modules.competitors` is on' || say "intake config check is not unconditional"
# Old contracts that wrap across lines; the line check above cannot see them.
for pair in \
  "skills/blog-post-workflow/SKILL.md|run the EXACT SAME validation" \
  "templates/brief.md|must already exist as a profile in" \
  "standards/blog-craft.md|source of truth for these facts is \`{competitors_dir}/<slug>.md\`" \
  "templates/checklist.md|exists at \`{competitors_dir}/<slug>.md\`" \
  "agents/blog-researcher.md|read from synthesized profiles in {competitors_dir}"; do
  f=${pair%%|*}; phrase=${pair#*|}
  has_phrase "$f" "$phrase" && say "$f still says: $phrase"
done
grep -qF 'references/competitor-profiles.md' skills/blog-post-workflow/SKILL.md || say "SKILL.md does not point at references/competitor-profiles.md"

[ "$fail" -eq 0 ] && echo "COMPETITOR READS OK" || exit 1
