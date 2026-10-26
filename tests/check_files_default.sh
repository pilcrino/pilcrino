#!/usr/bin/env bash
# Files by default, site publishing as beta (spec
# docs/superpowers/specs/2026-10-26-files-default-publishing-beta-design.md).
# The change is prose the model follows, so these checks pin the wording each
# part of the spec depends on.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
say() { echo "FILES DEFAULT FAIL: $*" >&2; fail=1; }

# Prose wraps: compare phrases with newlines and runs of spaces collapsed.
has_phrase() { tr -s '\n ' '  ' < "$1" | grep -qF -- "$2" || say "$1 lacks: $2"; }
lacks_phrase() { ! tr -s '\n ' '  ' < "$1" | grep -qF -- "$2" || say "$1 still has: $2"; }

SETUP=skills/blog-setup/SKILL.md
ADAPTER=adapters/publish/markdown.md
GENERIC=adapters/publish/frontmatter/markdown-generic.md
WORKFLOW=skills/blog-post-workflow/SKILL.md
SCHEMA=skills/blog-post-workflow/references/config-schema.md

# Task 2: setup says up front that GitHub is required
has_phrase "$SETUP" 'you need a GitHub account (a free one works)'
has_phrase "$SETUP" 'https://github.com/signup'
has_phrase "$SETUP" 'As I said at the start, Pilcrino needs a GitHub repository for this blog'

# Task 3: Phase 5 opens with files or beta

# Task 4: keep blog-ops/ out of Jekyll and Eleventy builds

# Task 5: re-runs, counting and the skill description

# Task 6: the markdown adapter's generic wording

# Task 7: the workflow, generic wording and published on merge

# Task 8: README, version and changelog

exit $fail
