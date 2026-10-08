# Site conventions

Written by: `${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/SKILL.md` (existing-blog research phase), by running the active publish adapter's `## Site inspection (setup-time)` procedure — `${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` or `${CLAUDE_PLUGIN_ROOT}/adapters/publish/astro-git-pr.md`, per `publish.adapter`. Detection is entirely adapter-owned; this file is only the shape both adapters fill.
The `markdown` adapter has no site inspection, so setup never writes this file for a markdown blog; write it by hand only if posts should follow a table-of-contents or category convention.
Read by: `templates/brief.md` (Category field resolves against `## Categories`), `templates/outline.md`/`templates/plan.md` (carry the category through), `personas/writer.md` + `standards/blog-craft.md` (internal-link trailing-slash form, cross-checked against `## Permalinks`), `adapters/publish/wordpress-rest.md` §Staging (category resolve/create, `## Table of contents` block passed to `md-to-gutenberg.py --extra-blocks`, focus-keyword action item from `## SEO plugin`).
Lifecycle: written once, at setup (or when an existing-blog research pass runs against a blog that already has posts). Nothing in the regular per-post workflow overwrites it. Re-run the owning adapter's `## Site inspection (setup-time)` procedure by hand if the site's conventions change later (theme swap, new SEO plugin, new TOC convention) — stale conventions here silently mis-guide every post after the change, so treat a known site change as a reason to redo this file, not just a one-time detection.

**Instance path:** the wizard resolves THIS file (`templates/site-conventions.md`, or a per-blog override at `blog-ops/templates/site-conventions.md` — the same layered `{templates}` rule from `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §Path variables) as the SHAPE, and writes the filled-in INSTANCE to `{profile_dir}/site-conventions.md` — never to `blog-ops/templates/`. That's the one difference from every other resolved template in this plugin: those resolve into `{drafts_dir}/<slug>/...` per-post; this one resolves once, into the blog-wide `{profile_dir}/`, alongside `blog.md`/`voice.md`/`authors.md`.

**Requiredness** (per config-schema.md, registered there by Task 1): REQUIRED when `publish.adapter: wordpress-rest` AND the blog already existed at setup; recommended otherwise (a brand-new blog has nothing to inspect yet — its adapter's inspection procedure returns empty-but-valid findings, see each adapter's zero-posts handling).

## Platform

- **Editor / build system:** <e.g. "WordPress block editor (Gutenberg)" | "Astro content collections, Markdown/MDX">
- **Block/component library:** <the block or component library existing posts actually use beyond the editor's own core primitives, if any — e.g. "core WordPress blocks only, nothing third-party" or "core blocks plus a third-party block library (illustrative example only: Kadence blocks) — name whichever this site actually runs" | "plain Markdown, no custom MDX components in post bodies" | "MDX with a `<Callout>` component used in most posts". A concrete name here is per-blog DATA (this file lives in the blog's own repo), never shared plugin behavior — no other file in this plugin may hardcode a specific block/theme/plugin name as behavior.>

## Table of contents

<Does this blog's existing content carry a table-of-contents block or convention? State yes/no first, then either paste the EXACT markup below verbatim or write "none".>

- WordPress: copied verbatim from an inspected post's `content.raw` (the `<!-- wp:... --> … <!-- /wp:... -->` block, including its inner attributes).
- Astro/git-based: the exact Markdown/MDX snippet or component invocation an existing post's TOC uses, copied verbatim from its source file (or the layout component, if the TOC auto-renders from headings rather than living in the post body).

This is passed as-is to `md-to-gutenberg.py --extra-blocks` (position `after-intro`) for WordPress; a git-based site's staging step inserts it the equivalent way. Never paraphrase or "clean up" the markup, downstream tooling needs it byte-for-byte.

```
<verbatim block markup copied from an existing post, or the single word "none" if no existing post has a table of contents>
```

## Categories

**Taxonomy** (the full list of categories this blog's existing content actually uses — WordPress: `GET /wp-json/wp/v2/categories`; Astro/git-based: the content-collection schema's category enum, or the distinct values observed across existing posts' frontmatter):

- <category 1>
- <category 2>
- ...
(or: "None yet — no existing posts/categories to inspect.")

**Per-cluster mapping** (which category each of this blog's content pillars maps to — cross-reference `{profile_dir}/blog.md` §Content pillars):

| Content pillar | Category |
|---|---|
| <pillar from blog.md> | <matching category name, or "no existing category fits — human to confirm/create one"> |
| ... | ... |

`templates/brief.md`'s Category field resolves against this table. Once this table exists for a blog, a post never ships uncategorized (WordPress: no post left as "Uncategorized"; git-based: no post with a missing/empty category field).

## SEO plugin

- **Name:** <the SEO plugin/mechanism actually detected on this site — e.g. a keyword-based SEO plugin (illustrative example only; name whichever this site actually runs) | "none detected — SEO metadata appears theme-managed or absent" | "N/A — no server-side SEO plugin exists for a git-based site; see the mechanism below">
- **Focus-keyword mechanism:** <how a post's target/focus keyword is set on THIS site — e.g. a plugin meta box the human fills in after the draft is created, a `<meta>` tag the plugin manages automatically from the title, or (git-based) a plain frontmatter field the writer sets directly>
- **Settable via standard REST?** <yes, field: `<field name>` | no — not exposed on the standard `wp/v2/posts` schema, recorded as a manual action item for the human instead | N/A — no REST API for a git-based site>

## Permalinks

- **Format:** <the post URL structure this site actually uses, read from an inspected live post's URL (WordPress: the fetched post's `link`; Astro/git-based: the routing config or an existing post's dev/build URL) — e.g. `/blog/<slug>/` or `/<year>/<month>/<slug>/`>
- **Trailing slash:** <yes | no>

This MUST agree with `blog.trailing_slash` in `config.yaml`. If they disagree, that's a bug to fix (in whichever one is wrong), not something to paper over — every internal link and canonical URL this plugin emits depends on them matching.

## Post furniture

Recurring structural elements existing posts carry beyond the article body itself:

- **Author box:** <yes/no + how it's produced — e.g. "yes, auto-rendered by the theme from the WP user profile, nothing this workflow needs to emit" | "no author box on this site">
- **Related posts:** <yes/no + how it's populated — theme/plugin-automatic (nothing to emit) vs. manually curated (this workflow would need to supply candidates)>
- **Disclosure blocks:** <e.g. an affiliate/sponsorship disclosure line every post carries verbatim near the top — quote the exact text if short — or "none">
- **Should this workflow's generated content include any of the above?** <yes/no per element that isn't already automatic; most sites' author box and related-posts are theme/plugin-automatic (answer "no — automatic, nothing to include"); a disclosure line is the common exception (the post body itself must carry it) if this site uses one>

## Notes

<Anything else worth recording: quirks noticed during inspection, low-confidence guesses that should be reconfirmed with the human, or "None.">

**Last inspected:** <YYYY-MM-DD>, by the `<wordpress-rest | astro-git-pr>` adapter's §Site inspection procedure.
