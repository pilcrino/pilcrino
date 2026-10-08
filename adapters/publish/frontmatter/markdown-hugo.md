# Hugo frontmatter template (markdown adapter)

Read by: the `blog-writer` agent (see `${CLAUDE_PLUGIN_ROOT}/personas/writer.md` §Frontmatter, which points here via `publish.markdown.frontmatter_template`), the review skill, and `${CLAUDE_PLUGIN_ROOT}/adapters/publish/markdown.md` (Stage 4b.5 cover injection and draft strip). Used when `publish.markdown.platform: hugo`. Repo platform: the merge publishes.

## Config inputs

- `{content_dir}`: `publish.markdown.content_dir`
- `{assets_dir}`: `publish.markdown.assets_dir`
- `{profile_dir}/authors.md`: the source of truth for the author name

## The frontmatter block

```yaml
---
title: "<Title, 50-60 chars, matches the outline's Final title exactly>"
description: "<meta description, 160 chars at most>"
date: <YYYY-MM-DD>
tags:
  - <tag-1>
  # 2-4 tags total, from this blog's tag taxonomy ({profile_dir}/blog.md)
author: "<Author, or a co-signed byline string for author_voice=we>"
cover: "<relative path from {content_dir} to {assets_dir}/<slug>/featured.png, see Cover path computation>"
draft: true
---
```

## Field-by-field rules

- **`title`**: quoted, 50-60 chars, the page H1 rendered by the theme; never repeat an H1 in the body.
- **`description`**: the meta description, 160 chars at most.
- **`date`** (the date key): `YYYY-MM-DD`. Write the drafting date and leave it. The Pilcrino app overwrites it with the publish day's date: on the branch copy at approval, and in the zip copy at download (`publish-date.ts`). Keep the `YYYY-MM-DD` shape; the app rewrites only a value it can parse as one.
- **`tags`**: 2-4 entries from this blog's tag taxonomy.
- **`author`**: one string, not an array: the display name from `{profile_dir}/authors.md`, or a co-signed byline (e.g. `"Alex & Sam"`) for `author_voice=we`.
- **`cover`** (the cover key): one quoted single-line value, see §Cover path computation.
- **`draft: true`** (the draft key): present on every drafted post; `markdown.md` §Staging step 2 strips it, so Hugo builds the merged post.
- **Body:** Markdown only, no raw HTML (the app's preview drops it). FAQ schema is not emitted: the `## FAQ` section ships as plain body content, with no JSON-LD script and no schema marker comment.

## Cover path computation

The cover and every in-post image embed are relative paths from `{content_dir}/` to `{assets_dir}/<slug>/<file>`: one `../` per path segment of `{content_dir}` that `{assets_dir}` does not share, then down into `{assets_dir}`. When `{assets_dir}` sits inside `{content_dir}` there is no `../`. With the defaults (`content_dir: posts`, `assets_dir: posts/images`):

```yaml
cover: "images/<slug>/featured.png"
```

In the app's zip both become `./<file>` (`./featured.png`); always write the repository path.

## Quality gates (self-check before Gate 2)

- [ ] `title` matches the outline's "Final title" exactly
- [ ] `description` is 160 chars at most
- [ ] `date` is `YYYY-MM-DD`
- [ ] `tags` has 2-4 entries from the taxonomy
- [ ] `author` is a plain display string, not an array
- [ ] `cover` resolves to `{assets_dir}/<slug>/featured.png`
- [ ] no raw HTML in the body
- [ ] `draft: true` present (stripped at staging, not by the writer)
