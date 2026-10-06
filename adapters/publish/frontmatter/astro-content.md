# Astro content-collections frontmatter template (plain, non-Starlight)

Read by: the `blog-writer` agent (drafting frontmatter — see `${CLAUDE_PLUGIN_ROOT}/personas/writer.md` §Frontmatter, which points here via `publish.astro.frontmatter_template`) and `${CLAUDE_PLUGIN_ROOT}/adapters/publish/astro-git-pr.md` (Stage 4b.5 cover injection + draft-guard strip). Used when `publish.astro.frontmatter_template: adapters/publish/frontmatter/astro-content.md` — the variant for an Astro blog built on plain content collections (e.g. the standard Astro blog-starter schema) rather than Starlight. This schema has no `head[]` injection point, so its FAQ handling differs structurally from `astro-starlight.md` — read §FAQ schema below before drafting a post against this template.

## Config inputs

Same as `astro-starlight.md`: `{content_dir}` (`publish.astro.content_dir`), `{assets_dir}` (`publish.astro.assets_dir`), `publish.astro.draft_mechanism`.

## The frontmatter block

```yaml
---
title: "<Title, 50-60 chars, matches the outline's Final title exactly>"
description: "<meta description, ≤160 chars>"
pubDate: <YYYY-MM-DD>
tags:
  - <tag-1>
  # 2-4 tags total, from this blog's tag taxonomy ({profile_dir}/blog.md)
author: "<Author, or a co-signed byline string for author_voice=we>"
heroImage: "<relative path from {content_dir} to {assets_dir}/<slug>/featured.png — see §Hero path computation>"
draft: true
---
```

## Field-by-field rules

- **`title`**: quoted, 50-60 chars, rendered as the page H1 by the blog layout — never duplicate an H1 in the body.
- **`description`**: the meta description, ≤160 chars. This schema's equivalent of the Starlight variant's `excerpt`; same content, different key name.
- **`pubDate`**: `YYYY-MM-DD`. Write the drafting date and leave it: the CONSOLE overwrites this with today's date on the post's branch immediately before it merges the PR (`console/src/publish-date.ts`, `ensurePublishDateStamped`), because for `astro-git-pr` the merge commit IS the published date and a post approved three weeks after it was drafted would otherwise ship dated three weeks stale. Keep the `YYYY-MM-DD` shape: the console rewrites only a value it can parse as one, and leaves anything else alone rather than risk writing a shape the content schema never expected.
- **`tags`**: 2-4 entries from this blog's tag taxonomy.
- **`author`**: a SINGLE string field, not an array, and not a site authors-map key the way the Starlight variant's `authors:` is — this schema has no author-map concept. For a single-author voice, the display name directly (e.g. `"Alex"`). For a co-signed post (`author_voice=we`), a shared byline string (e.g. `"Alex & Sam"`), since the field can't hold two array entries. If `{profile_dir}/authors.md` defines a preferred co-sign byline format, use it verbatim.
- **`heroImage`**: see §Hero path computation below. This schema has no separate `alt` field; if a specific blog's content-collections schema was extended with one (e.g. `heroImageAlt`), add it using the same alt text `images.md`'s Featured image entry carries — otherwise the alt text lives only in the layout's `<img>` tag (commonly hardcoded to the post title by the theme) and in the image's own `images.md` record.
- **`draft: true`**: the same build-exclusion guard and strip/keep behavior as `astro-starlight.md` — `astro-git-pr.md` handles it identically regardless of which frontmatter template is configured.

## Hero path computation

Identical rule to `astro-starlight.md` §Cover path computation: `heroImage` is a relative path from `{content_dir}/` to `{assets_dir}/<slug>/featured.png`, computed as a standard relative filesystem path (one `../` per path segment in `{content_dir}`, then descend into `{assets_dir}`). With the default config (`content_dir: src/content/blog`, `assets_dir: src/assets/blog`):

```yaml
heroImage: "../../assets/blog/<slug>/featured.png"
```

Recompute for a specific blog's actual `content_dir` / `assets_dir` depth.

## FAQ schema (inline script note, not a frontmatter field)

This schema has no `head[]` (or equivalent) frontmatter mechanism to inject a `<script type="application/ld+json">` tag the way the Starlight variant does. The FAQPage JSON-LD is instead the responsibility of the blog's LAYOUT component, generated from the post's `## FAQ` body section at render/build time, not hand-authored in this frontmatter block. Leave a single-line HTML comment immediately after the FAQ heading in the body as a note for the layout, e.g.:

```markdown
## FAQ

<!-- schema:faq — the post layout renders FAQPage JSON-LD from this section's Q&A pairs at build time; keep one H3 (or bold) question per pair, plain-text answer directly beneath it. Do not hand-write a <script> tag in this body. -->

### <Question 1>

<Answer 1>
```

If a specific blog's layout has NOT yet implemented this extraction (a wizard/setup-time gap, not a per-post one), the FAQ section still ships as plain body content — it's simply not eligible for rich-result FAQ markup until the layout catches up. Flag this as an action item rather than blocking the post.

## Quality gates (self-check before Gate 2)

- [ ] `title` matches the outline's "Final title" exactly
- [ ] `description` ≤160 chars
- [ ] `author` is a plain display string (or co-signed byline), not an `author_voice` slug and not an array
- [ ] `heroImage` path resolves to a file that actually exists at `{assets_dir}/<slug>/featured.png`
- [ ] `## FAQ` body section carries the `<!-- schema:faq -->` note and one Q&A pair per outline FAQ question, same order
- [ ] `draft: true` present (stripped later by the publish adapter, not by the writer)
