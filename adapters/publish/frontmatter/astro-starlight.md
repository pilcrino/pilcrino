# Astro Starlight frontmatter template

Read by: the `blog-writer` agent (drafting frontmatter — see `${CLAUDE_PLUGIN_ROOT}/personas/writer.md` §Frontmatter, which points here via `publish.astro.frontmatter_template`) and `${CLAUDE_PLUGIN_ROOT}/adapters/publish/astro-git-pr.md` (Stage 4b.5 cover injection + draft-guard strip). Used when `publish.astro.frontmatter_template: adapters/publish/frontmatter/astro-starlight.md`.

## Config inputs

- `{content_dir}` — `publish.astro.content_dir`
- `{assets_dir}` — `publish.astro.assets_dir`
- `publish.astro.draft_mechanism` — the build-exclusion guard line, default `draft: true`
- `publish.astro.authors_map_check` — OPTIONAL path to the site's authors-map file

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
cover:
  image: "<relative path from {content_dir} to {assets_dir}/<slug>/featured.png — see §Cover path computation>"
  alt: "<meaningful alt text, from images.md's Featured image entry>"
head:
  - tag: meta
    attrs:
      name: description
      content: "<same string as excerpt>"
  - tag: script
    attrs:
      type: application/ld+json
    content: |
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "<question 1, verbatim from the ## FAQ body>",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "<answer 1, plain text, no links>"
            }
          }
        ]
      }
draft: true
---
```

The `mainEntity` array carries one entry per `## FAQ` question in the body, same order — see §JSON-LD 1:1 rule below.

## Field-by-field rules

- **`title`**: quoted, 50-60 chars. Starlight renders this verbatim as the page's H1 — never duplicate an H1 in the body.
- **`date`**: `YYYY-MM-DD`, the day the post ships, not the day drafting started. Write the drafting date and leave it: the CONSOLE overwrites this with today's date on the post's branch immediately before it merges the PR (`console/src/publish-date.ts`, `ensurePublishDateStamped`), because for `astro-git-pr` the merge commit IS the published date. Keep the `YYYY-MM-DD` shape: the console rewrites only a value it can parse as one, and leaves anything else alone rather than risk writing a shape the content schema never expected.
- **`excerpt`**: the meta description, ≤160 chars. Mirrored verbatim into the `head[]` meta-description entry below — one string, two places.
- **`tags`**: 2-4 entries from this blog's tag taxonomy.
- **`authors`**: see §Authors map (case sensitivity) below — this is the field most likely to be filled wrong.
- **`cover.image` / `cover.alt`**: see §Cover path computation below. `alt` comes straight from the featured entry in `images.md`.
- **`head[]`**: exactly two entries — the meta-description tag and the FAQPage JSON-LD script. Starlight reads `head[]` and injects each entry into the page `<head>` verbatim; this is the ONLY place a JSON-LD schema is emitted for this template (no separate `<script>` in the body).
- **`draft: true`**: the build-exclusion guard (`publish.astro.draft_mechanism`). Present on every freshly drafted post; `astro-git-pr.md` strips it at staging (the PR build, which excludes draft posts, plus the review branch are the gate). Never hand-remove this line before Gate 2.

## Authors map (case sensitivity)

`authors:` values are keys into this site's Starlight author map (typically an `authors` object in `astro.config.mjs` or an equivalent site config file, checked via `publish.astro.authors_map_check` if configured). **Match the site's exact casing.** Most sites capitalize author keys (e.g. `Alex`, not `alex`) — using the wrong case silently fails to resolve the byline rather than raising a build error, so this is easy to get wrong without a check.

This is a DIFFERENT value from `author_voice` (the lowercase tone tag used in `brief.md` / `outline.md` / `plan.md`, e.g. `alex`, `sam`, `we`) — never copy `author_voice` verbatim into `authors:`. Map explicitly, per `{profile_dir}/authors.md`'s slug-to-site-key table:

```
author_voice=alex  → authors: [Alex]
author_voice=sam   → authors: [Sam]
author_voice=we    → authors: [Alex, Sam]     # every voice in the co-sign list, each in the site's capitalized form
```

If `publish.astro.authors_map_check` is configured, the astro adapter's action-items §6 (conditional) reminds the human to confirm every `authors:` entry is a literal key in that file before merging.

## Cover path computation

`cover.image` is a relative filesystem path from the post file's own directory (`{content_dir}/`) to the asset (`{assets_dir}/<slug>/featured.png`) — Starlight resolves it exactly like any other relative Markdown/frontmatter asset reference, at build time. Compute it as a standard relative path: count the path segments in `{content_dir}` (from the site root) — that's how many `../` to prepend — then descend into `{assets_dir}/<slug>/featured.png`.

With this repo's default config (`content_dir: src/content/blog`, `assets_dir: src/assets/blog`), the relative shape is:

```yaml
cover:
  image: "../../assets/blog/<slug>/featured.png"
```

Recompute for a blog whose `content_dir` / `assets_dir` nest more deeply (e.g. an extra path segment adds one more `../`). The same relative-path rule applies to every in-post `[IMAGE:]` embed the `astro-git-pr.md` adapter inserts into the body, just targeting that image's own filename instead of `featured.png`.

## JSON-LD 1:1 rule

The `mainEntity` array must have exactly one entry per `## FAQ` question in the body, in the same order, with matching wording (`name` = the question verbatim, `text` = a plain-text rendering of the answer, no links or Markdown formatting inside the schema). If the body FAQ section is edited after this frontmatter block was written (a review-loop edit, a Gate 2 revision), re-sync the `mainEntity` array in the same change — a drifted schema is a review-blocking defect, not a cosmetic one.

## Quality gates (self-check before Gate 2)

- [ ] `title` matches the outline's "Final title" exactly
- [ ] `excerpt` ≤160 chars, identical string in `head[]` meta description
- [ ] `authors:` casing matches the site's authors map exactly (see §Authors map)
- [ ] `cover.image` path resolves to a file that actually exists at `{assets_dir}/<slug>/featured.png`
- [ ] FAQPage JSON-LD `mainEntity` has exactly one entry per `## FAQ` question, same order, same wording
- [ ] `draft: true` present (stripped later by the publish adapter, not by the writer)
