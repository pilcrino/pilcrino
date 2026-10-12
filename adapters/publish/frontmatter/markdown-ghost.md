# Ghost frontmatter template (markdown adapter)

Read by: the `blog-writer` agent (see `${CLAUDE_PLUGIN_ROOT}/personas/writer.md` §Frontmatter, which points here via `publish.markdown.frontmatter_template`), the review skill, and `${CLAUDE_PLUGIN_ROOT}/adapters/publish/markdown.md` (Stage 4b.5 cover injection). Used when `publish.markdown.platform: ghost`. Paste platform: the owner pastes the post into Ghost before approving. The keys follow Ghost's post fields, so each value maps onto the field of the same name in the Ghost editor.

## Config inputs

- `{content_dir}`: `publish.markdown.content_dir`
- `{assets_dir}`: `publish.markdown.assets_dir`
- `{profile_dir}/authors.md`: the source of truth for author names

## The frontmatter block

```yaml
---
title: "<Title, 50-60 chars, matches the outline's Final title exactly>"
excerpt: "<meta description, 160 chars at most>"
published_at: <YYYY-MM-DD>
tags:
  - <tag-1>
  # 2-4 tags total, from this blog's tag taxonomy ({profile_dir}/blog.md)
authors:
  - "<Author>"
  # a co-signed post (author_voice=we) lists each author
feature_image: "<relative path from {content_dir} to {assets_dir}/<slug>/featured.png, see Cover path computation>"
---
```

## Which keys to emit

`publish.markdown.frontmatter_keys` in `config.yaml` (optional; config-schema.md §Fitting the site's frontmatter) lists the top-level keys the site accepts. When it is set, emit only the keys in that list, in the order above, and nothing else; the reviewer fails a draft that carries a key outside the list (the draft key aside: it follows its own setting, below). When it is absent, emit every key above, as before.

- **Required keys, never omitted whatever the list says:** `title`, `excerpt`, `published_at` and the cover key. The cover key is `publish.markdown.cover_key` when set (one top-level key, a scalar path; a Hugo Ananke theme reads `featured_image`), else `feature_image` as shown; write the cover line under that key and under no other.
- **May be left out of the list:** `tags`, `authors`. A site whose schema does not know them gets no such line; do not write them "just in case".
- **The draft key is not governed by the list.** This template has no draft key, so there is nothing to decide.

## Field-by-field rules

- **`title`**: quoted, 50-60 chars, the post title in Ghost; never repeat an H1 in the body.
- **`excerpt`**: the meta description, 160 chars at most; Ghost's custom excerpt.
- **`published_at`** (the date key): `YYYY-MM-DD`. Write the drafting date and leave it. The Pilcrino app overwrites it with the publish day's date: on the branch copy at approval, and in the zip copy at download (`publish-date.ts`, whose date keys include `published_at`). Keep the `YYYY-MM-DD` shape; the app rewrites only a value it can parse as one.
- **`tags`**: 2-4 entries from this blog's tag taxonomy.
- **`authors`**: a list; each entry is a display name from `{profile_dir}/authors.md`.
- **`feature_image`** (the cover key): one quoted single-line value, see §Cover path computation.
- **No draft key.** Ghost drafts live in Ghost; nothing is stripped at staging.
- **Body:** Markdown only, no raw HTML (the app's preview drops it). FAQ schema is not emitted: the `## FAQ` section ships as plain body content, with no JSON-LD script and no schema marker comment.

## Cover path computation

The cover and every in-post image embed are relative paths from `{content_dir}/` to `{assets_dir}/<slug>/<file>`: one `../` per path segment of `{content_dir}` that `{assets_dir}` does not share, then down into `{assets_dir}`. When `{assets_dir}` sits inside `{content_dir}` there is no `../`. With the defaults (`content_dir: posts`, `assets_dir: posts/images`):

```yaml
feature_image: "images/<slug>/featured.png"
```

In the app's zip both become `./<file>` (`./featured.png`); always write the repository path. When pasting, upload the images in the Ghost editor.

## Quality gates (self-check before Gate 2)

- [ ] `title` matches the outline's "Final title" exactly
- [ ] `excerpt` is 160 chars at most
- [ ] `published_at` is `YYYY-MM-DD`
- [ ] `tags` has 2-4 entries from the taxonomy (only when `tags` is emitted, §Which keys to emit)
- [ ] every `authors` entry matches `{profile_dir}/authors.md` (only when `authors` is emitted, §Which keys to emit)
- [ ] the cover key (`feature_image`, or `publish.markdown.cover_key` when set) resolves to `{assets_dir}/<slug>/featured.png`
- [ ] no raw HTML in the body
- [ ] no draft key present
- [ ] the cover sits under `publish.markdown.cover_key` when set, and no key outside `publish.markdown.frontmatter_keys` plus the draft key (when `draft_key` is not `none`) when that list is set (§Which keys to emit)
