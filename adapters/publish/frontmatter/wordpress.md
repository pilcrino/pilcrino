# WordPress frontmatter template (repo markdown → WP REST fields)

Read by: the `blog-writer` agent (drafting frontmatter — see `${CLAUDE_PLUGIN_ROOT}/personas/writer.md` §Frontmatter, which points here via `publish.wordpress.frontmatter_template`) and `${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` (§Staging step 5 sources `<title>`/`<excerpt>`/tags/author from this frontmatter block when it builds the create-post request). Used when `publish.wordpress.frontmatter_template: adapters/publish/frontmatter/wordpress.md`. The canonical markdown in `{content_dir}` always carries this frontmatter — WordPress is not the source of truth, the repo is (`docs/superpowers/specs/2026-07-02-generic-blog-skill-design.md` §6.5) — the adapter reads these fields and maps them onto WP REST fields at staging; WordPress itself never sees the YAML block (it's stripped from the body before the `content` field is built, per `wordpress-rest.md` §Staging step 3).

## Config inputs

- `{content_dir}` — `publish.wordpress.content_dir`
- `{assets_dir}` — `publish.wordpress.assets_dir`
- `{profile_dir}/authors.md` — the source of truth for valid `authors:` entries

## The frontmatter block

```yaml
---
title: "<Title, 50-60 chars, matches the outline's Final title exactly>"
date: <YYYY-MM-DD>
excerpt: "<meta description, ≤160 chars>"
tags:
  - <tag-1>
  # 2-4 tags total, from this blog's tag taxonomy ({profile_dir}/blog.md)
authors:
  - <Author>
# OR for a co-signed post (author_voice = we in brief.md/outline.md/plan.md):
# authors:
#   - <Author 1>
#   - <Author 2>
draft: true
---
```

## Field-by-field rules

- **`title`**: quoted, 50-60 chars, matches the outline's "Final title" exactly. Maps to the WP post's `title` field verbatim — see §WP REST field mapping.
- **`date`**: `YYYY-MM-DD`, for internal consistency with the other frontmatter templates and with `{drafts_dir}` bookkeeping. The adapter ignores this value: WordPress stamps the post's actual date when the human clicks Publish in WP admin, not from anything the workflow sends. The console still refreshes it to today's date on the branch just before merging the content PR (`console/src/publish-date.ts`), so the repo copy, which is the canonical archive of what shipped, does not sit there disagreeing with the live post by three weeks.
- **`excerpt`**: the meta description, ≤160 chars. Maps to the WP post's `excerpt` field verbatim.
- **`tags`**: 2-4 entries from this blog's tag taxonomy (`{profile_dir}/blog.md`). Maps to the WP post's `tags` field by name — see §WP REST field mapping for how name-to-ID resolution works.
- **`authors`**: one or more entries, each matching an author in `{profile_dir}/authors.md` (its display name or byline, not the lowercase `author_voice` slug — same author_voice → authors mapping discipline as the Astro Starlight template's §Authors map). Only `authors[0]` has a WP REST equivalent (see below); for a co-signed post, later entries are documentation only, carried by the body's byline/sign-off, since core WordPress has no multi-author field.
- **`draft: true`**: present on every freshly drafted post, matching the other frontmatter templates' contract — but for this adapter it is a documentation-only guard, not a build-exclusion mechanism. WordPress has no build step to exclude from. What actually gates publication is the WP post's `status` field (`publish.wordpress.default_status`, always `draft` in v1): a `draft`-status post is invisible to readers regardless of what this frontmatter line says, and this adapter never sets `status` beyond `draft` on its own. Conceptually this line is "stripped" at staging the same way the Astro templates strip theirs, it just has nothing left to strip toward — the WP status field was already doing the real gating.

## No cover/heroImage field

Unlike the Astro templates, this schema defines no `cover`/`heroImage` field. The featured image is uploaded via `/wp-json/wp/v2/media` and attached to the post as `featured_media` (a numeric media ID), per `wordpress-rest.md` §Staging steps 4-5 — never referenced by a file path in frontmatter.

## WP REST field mapping

| Frontmatter field | WP REST field |
|---|---|
| `title` | `title` |
| `excerpt` | `excerpt` |
| `tags` | `tags` — resolved/created by name via `/wp-json/wp/v2/tags`, then passed as term IDs |
| `authors[0]` | the post's `author` — in v1, always defaults to the authenticated user (`publish.wordpress.username`); a per-author WP-user mapping is a possible future config extension |
| `date` | ignored — WordPress sets the post's date at publish time, not from this field |
| (featured image, not frontmatter) | `featured_media`, set from the uploaded media ID — see §No cover/heroImage field |

## FAQ (schema markup)

The `## FAQ` body section converts to regular HTML like any other section (§Staging step 3's pandoc/marked pass); FAQPage JSON-LD is a WP-plugin concern, not something this frontmatter template or the adapter emits.

## Quality gates (self-check before Gate 2)

- [ ] `title` matches the outline's "Final title" exactly
- [ ] `excerpt` ≤160 chars
- [ ] `tags` has 2-4 entries from this blog's tag taxonomy
- [ ] every `authors:` entry matches an author in `{profile_dir}/authors.md`
- [ ] no `cover`/`heroImage` field present — the featured image ships via media upload, not frontmatter
- [ ] `draft: true` present
