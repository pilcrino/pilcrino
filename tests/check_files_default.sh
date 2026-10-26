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
has_phrase "$SETUP" '### Interview: where your posts go (every blog)'
has_phrase "$SETUP" '### If files'
has_phrase "$SETUP" 'Files in a pull request (recommended)'
has_phrase "$SETUP" 'Publish to my site (beta)'
has_phrase "$SETUP" 'WordPress (as drafts you publish), or a site built from this repository with Astro, Hugo, Next.js or Eleventy'
has_phrase "$SETUP" 'content_dir: blog-ops/posts'
has_phrase "$SETUP" 'assets_dir: blog-ops/posts/images'
has_phrase "$SETUP" 'Not sure, keep it plain'
has_phrase "$SETUP" "Your site won't show these posts; merging only files them in"
has_phrase "$SETUP" 'Every post now waits for your approval.'
lacks_phrase "$SETUP" 'Webflow, Squarespace, Ghost or another hosted CMS → `markdown` with `generic`'

# Task 4: keep blog-ops/ out of Jekyll and Eleventy builds
has_phrase "$SETUP" "### Keep Pilcrino's files off the site (every blog)"
has_phrase "$SETUP" 'eleventy.config.mjs'
has_phrase "$SETUP" 'eleventy.config.cjs'
has_phrase "$SETUP" '@11ty/eleventy'
has_phrase "$SETUP" '.eleventyignore'
has_phrase "$SETUP" 'build_type: legacy'
has_phrase "$SETUP" '.nojekyll'
has_phrase "$SETUP" 'Your site publishes every file in the repository it is not told to skip'
has_phrase "$SETUP" 'Then merged posts will also appear on your site at an address under /blog-ops/.'
has_phrase "$SETUP" "runs outside Phase 5's resume gate"

# Task 5: re-runs, counting and the skill description
has_phrase "$SETUP" 'Your setup is complete. What would you like to change?'
has_phrase "$SETUP" '| files | 50 |'
has_phrase "$SETUP" 'Posts are files in `blog-ops/posts/`'
has_phrase "$SETUP" 'Posts go to your WordPress as drafts (beta)'
has_phrase "$SETUP" 'keeps its folders, on "keep as-is" and on "update" alike'
desc=$(sed -n 3p "$SETUP")
{ printf '%s' "$desc" | grep -qi 'by default' && printf '%s' "$desc" | grep -qF '(beta)'; } || say "$SETUP description must say files by default and name the beta"

# Task 6: the markdown adapter's generic wording

# Task 7: the workflow, generic wording and published on merge

# Task 8: README, version and changelog

exit $fail
