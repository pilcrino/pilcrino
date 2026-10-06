#!/usr/bin/env bash
# Repo invariants. Run from anywhere: ./tests/lint.sh
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
err() { echo "LINT FAIL: $*" >&2; fail=1; }

CONTENT_DIRS=""
for d in skills agents personas standards templates adapters scaffold; do
  [ -d "$d" ] && CONTENT_DIRS="$CONTENT_DIRS $d"
done

# 1. Skill frontmatter: name + description present
for f in skills/*/SKILL.md; do
  [ -e "$f" ] || continue
  head -n 1 "$f" | grep -q '^---$' || err "$f: missing frontmatter open"
  fm=$(sed -n '2,30p' "$f" | sed '/^---$/q')
  echo "$fm" | grep -q '^name:' || err "$f: frontmatter missing name:"
  echo "$fm" | grep -q '^description:' || err "$f: frontmatter missing description:"
done

# Never scan generated/third-party dirs (Task 8 npm-installs inside scaffold/)
EXCL="--exclude-dir=node_modules --exclude-dir=out"

# 2. Agent frontmatter: name + description present (same contract as skills)
for f in agents/*.md; do
  [ -e "$f" ] || continue
  head -n 1 "$f" | grep -q '^---$' || err "$f: missing frontmatter open"
  fm=$(sed -n '2,30p' "$f" | sed '/^---$/q')
  echo "$fm" | grep -q '^name:' || err "$f: frontmatter missing name:"
  echo "$fm" | grep -q '^description:' || err "$f: frontmatter missing description:"
done

# 3. No affilytics-isms in content dirs
if [ -n "$CONTENT_DIRS" ]; then
  PAT='[Aa]ffilytics|Slav|Ruslan|Hurmanau|Diachenko|luckyAAo|geo-routing|web/affilytics-website|docs/content-ops|docs/marketing|tools/remotion-images'
  hits=$(grep -rInE $EXCL "$PAT" $CONTENT_DIRS 2>/dev/null || true)
  [ -n "$hits" ] && { echo "$hits" >&2; err "affilytics-specific content found"; }
fi

# 4. Module-conditional blocks are balanced per file
if [ -n "$CONTENT_DIRS" ]; then
  for f in $(grep -rlE $EXCL '<!-- module: (product|competitors) -->' $CONTENT_DIRS 2>/dev/null || true); do
    open=$(grep -cE '<!-- module: (product|competitors) -->' "$f")
    close=$(grep -c '<!-- /module -->' "$f")
    [ "$open" -eq "$close" ] || err "$f: unbalanced module blocks ($open open, $close close)"
  done
fi

# 5. Example configs in config-schema.md parse as YAML
SCHEMA=skills/blog-post-workflow/references/config-schema.md
if [ -f "$SCHEMA" ]; then
  python3 tests/check_yaml_blocks.py "$SCHEMA" || err "config-schema.md yaml blocks invalid"
fi

# 6. Template inventory complete (no directory guard — a missing
#    templates/ dir must FAIL, not silently pass)
EXPECTED_TEMPLATES="brief checklist plan plan-review facts outline review images action-items research-serp research-reddit research-x research-competitors repurpose-x-thread repurpose-x-short repurpose-linkedin repurpose-newsletter site-conventions"
[ -d templates ] || err "templates/ directory missing"
for t in $EXPECTED_TEMPLATES; do
  [ -f "templates/$t.md" ] || err "templates/$t.md missing"
done

# 7. Plugin-internal references resolve (any extension, so a stale script path fails)
if [ -d skills ]; then
  for ref in $(grep -rhoE --exclude-dir=node_modules --exclude-dir=out '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9/_.-]+\.[a-z]+' skills agents personas standards templates adapters 2>/dev/null | sed 's|${CLAUDE_PLUGIN_ROOT}/||' | sort -u); do
    [ -f "$ref" ] || err "dangling plugin reference: $ref"
  done
fi

# 8. Agents use tools: (subagent key), never allowed-tools: (skill key, ignored on agents)
for f in agents/*.md; do
  [ -e "$f" ] || continue
  fm=$(sed -n '2,30p' "$f" | sed '/^---$/q')
  echo "$fm" | grep -q '^tools:' || err "$f: frontmatter missing tools:"
  echo "$fm" | grep -q '^allowed-tools:' && err "$f: uses allowed-tools: (ignored on agents; use tools:)"
done

# 9. Frontmatter blocks parse as YAML (quoting bugs break plugin loading)
for f in skills/*/SKILL.md agents/*.md; do
  [ -e "$f" ] || continue
  python3 - "$f" <<'PYEOF' || err "$f: frontmatter is not valid YAML"
import sys
text = open(sys.argv[1]).read()
parts = text.split('---')
if len(parts) < 3:
    sys.exit(1)
import yaml
yaml.safe_load(parts[1])
PYEOF
done

# 10. Gutenberg converter present, executable, compiles
GUT=adapters/publish/scripts/md-to-gutenberg.py
if [ -f "$GUT" ]; then
  [ -x "$GUT" ] || err "$GUT not executable"
  python3 -m py_compile "$GUT" 2>/dev/null || err "$GUT does not compile"
else
  err "$GUT missing"
fi

# 11. Console contract doc exists and SKILL.md documents the Autopilot section
CONTRACT=skills/blog-post-workflow/references/console-contract.md
[ -f "$CONTRACT" ] || err "$CONTRACT missing"
SKILL=skills/blog-post-workflow/SKILL.md
if [ -f "$SKILL" ]; then
  grep -q '^## Autopilot' "$SKILL" || err "$SKILL: missing '## Autopilot' section"
else
  err "$SKILL missing"
fi

# 12. Page anatomy rules present (methodology, key takeaways, data images, information gain)
if [ -f tests/check_page_anatomy.sh ]; then
  bash tests/check_page_anatomy.sh || err "page anatomy rules missing (tests/check_page_anatomy.sh)"
else
  err "tests/check_page_anatomy.sh missing"
fi

# 13. Plugin scripts pass their own tests (node --test, no framework)
if ls adapters/images/scripts/*.test.mjs >/dev/null 2>&1; then
  node --test adapters/images/scripts/*.test.mjs >/dev/null 2>&1 || err "adapters/images/scripts tests failed"
fi
if ls skills/blog-post-workflow/scripts/*.test.mjs >/dev/null 2>&1; then
  node --test skills/blog-post-workflow/scripts/*.test.mjs >/dev/null 2>&1 || err "skills/blog-post-workflow/scripts tests failed"
fi

# 14. Competitor profiles are read from the base branch, never the post's working tree.
if [ -f tests/check_competitor_reads.sh ]; then
  bash tests/check_competitor_reads.sh || err "competitor profile reads (tests/check_competitor_reads.sh)"
else
  err "tests/check_competitor_reads.sh missing"
fi

[ "$fail" -eq 0 ] && echo "LINT OK" || exit 1
