# `config.yaml` schema

## Purpose

This document is the authoritative contract for `blog-ops/config.yaml`. Every
other component reads it rather than re-deriving its own rules: the
`blog-post-workflow` skill's config preamble parses and validates it before
any stage runs, and the `blog-setup` wizard is what produces and validates it
in the first place. If a value or an invariant conflicts between this file
and any other doc, this file wins.

## Bootstrap rule

`blog-ops/` at the workspace repo root is a fixed convention, not
configurable — it is the anchor used to find `config.yaml`; all other paths
derive from config values.

## Schema

The full annotated schema, with all three `publish.adapter` variants shown:

```yaml
blog:
  name: "Baseline Notes"
  url: https://baselinenotes.com
  language: en
  route_prefix: /blog/     # URL path prefix where posts are served; used for
                            #   internal links, canonical URLs, and the
                            #   inbound-link ownership greps; default /blog/;
                            #   use / for root-routed blogs
  trailing_slash: true     # whether this site's post URLs end with /;
                            #   detected from a live post URL at setup;
                            #   default true; consumed by internal-link
                            #   rules and adapters

modules:
  reddit_research: true
  x_research: false
  product: false            # gates product.md + positioning rules + related
                            #   template sections and intake questions
  competitors: false        # gates Stage 1.5c freshness re-check, intake
                            #   hard-halts, competitor research source
  repurpose: true

competitors:
  profile_dir: blog-ops/profile/competitors   # OPTIONAL; where competitor
                                              #   profiles + methodology.md live.
                                              #   Default shown. Lets a workspace
                                              #   share one corpus with non-blog
                                              #   tooling. Relevant only when
                                              #   modules.competitors is true.

images:
  enabled: [remotion, ai-prompt, screenshot]   # any subset; planner assigns per slot
  featured_default: remotion                # OPTIONAL; MUST be a member of
                                            #   images.enabled (wizard enforces,
                                            #   config preamble re-validates).
                                            #   Omitted → planner picks from enabled.
  remotion:
    project_dir: tools/remotion             # scaffolded by wizard if absent

publish:
  adapter: astro-git-pr                     # or wordpress-rest, or markdown
  astro:
    content_dir: src/content/blog
    site_dir: web/site                      # OPTIONAL; the Astro project root
                                            #   (owns package.json, emits dist/).
                                            #   Omit when the site IS the repo
                                            #   root; a monorepo points it at the
                                            #   subdirectory, e.g. web/site
    assets_dir: src/assets/blog
    frontmatter_template: adapters/publish/frontmatter/astro-starlight.md
    draft_mechanism: "draft: true"          # how a post is excluded from builds
    authors_map_check: astro.config.mjs     # optional; omit to skip
    preview_comment_marker: "<!-- blog-preview -->"  # optional; CI-dependent
  wordpress:
    content_dir: content/blog                       # canonical finalized markdown
    assets_dir: blog-ops/assets                     # local store for generated images pre-upload
    frontmatter_template: adapters/publish/frontmatter/wordpress.md   # frontmatter contract for the writer
    base_url: https://baselinenotes.com
    username: blogbot
    app_password_env: BASELINE_WP_APP_PASSWORD      # env var NAME, never the secret
    default_status: draft
    apply_inbound_links_live: false                 # when true, finalize applies
                                                     #   planned inbound links to
                                                     #   LIVE posts via REST once
                                                     #   the new post is published;
                                                     #   default false (safety: off)
  markdown:
    content_dir: posts                              # posts/<slug>.md
    assets_dir: posts/images                        # posts/images/<slug>/<file>
    platform: hugo                                  # astro | hugo | jekyll | ghost | nextjs | eleventy | generic
    frontmatter_template: adapters/publish/frontmatter/markdown-hugo.md   # derived from platform at setup; plugin-relative

git:
  branch_prefix: blog/
  base_branch: main
  # The PR path is the only publish path. `origin` must resolve AND be a GitHub
  #   repo accessible to authenticated gh (gh repo view succeeds); both are hard
  #   preconditions checked at Step 0. See §GitHub precondition below.

research:

browser:
  executable: /path/to/chrome   # OPTIONAL; only when Google Chrome is not at the platform default

social:                       # OPTIONAL; social posting targets
  linkedin:
    company_id: "000000000"   # LinkedIn company page id; presence enables /post-to-linkedin. Posts are made AS this page.
```

Secrets are always env-var *names*. The workflow resolves `{drafts_dir}`,
`{content_dir}`, `{assets_dir}`, etc. from this file in a config preamble; no
other file hardcodes a path.

### `console:` (optional)

Present only for blogs operated by the Pilcrino app's console.
Absence = interactive-only blog; zero behavior change. All fields optional
with the defaults shown.

`port` is legacy: one console process now serves every connected blog on
one shared port, configured once at `~/.pilcrino/console/config.json`
(default 4720), not per blog. A blog's own `console.port` here is read
only as a fallback when nothing else supplies an address, which the
multi-blog console never does: the supervisor always hands a worker its
public port explicitly, so under the shared console this field is inert.
It stays in the schema, unvalidated further than its type, so a laptop's
existing `blog-ops/config.yaml` files need no edit and the one-time
migration to the shared console (see `console/README.md`) can still read
it directly off each blog's old value while preparing the registry.

```yaml
console:
  port: 4700
  max_concurrent_writes: 1
  scheduler_interval_ms: 60000
  publish_policy: gated          # gated | auto  (auto invalid with wordpress-rest and markdown)
  verification:
    build_check: true
    vision: auto                 # on | off | auto (auto = run when a preview is reachable, else skip loudly)
    vision_timeout_secs: 1800    # wall-clock budget for one headless vision pass; the pass reads
                                  #   the post's images and screenshots the rendered preview through
                                  #   the browser MCP, so a long post costs more; raise this before
                                  #   disabling vision; its transcript is written to
                                  #   <runId>.vision.log in the console's runs directory
  max_limit_resumes: 3
```

## Path variables

All prose in this plugin refers to paths through these variables, resolved
from `config.yaml` (plus the fixed `blog-ops/` bootstrap anchor):

| Variable | Meaning |
|---|---|
| `{ops_dir}` | `blog-ops` (fixed) |
| `{profile_dir}` | `blog-ops/profile` |
| `{drafts_dir}` | `blog-ops/drafts` |
| `{content_dir}` | `publish.<adapter>.content_dir` |
| `{assets_dir}` | `publish.astro.assets_dir`, `publish.wordpress.assets_dir` (default `blog-ops/assets`) or `publish.markdown.assets_dir` (default `posts/images`) |
| `{remotion_dir}` | `images.remotion.project_dir` |
| `{route_prefix}` | `blog.route_prefix` (default `/blog/`) — the URL path prefix this blog's posts are served under |
| `{competitors_dir}` | competitors.profile_dir (default blog-ops/profile/competitors) |
| `{templates}` | layered resolution, see below |

`{templates}` resolution is a layered rule: for a template named `<name>.md`,
use `blog-ops/templates/<name>.md` if it exists, else
`${CLAUDE_PLUGIN_ROOT}/templates/<name>.md`. One existence check, no
merging. (The `<name>.md` angle-bracket form above is written verbatim —
it is a placeholder, not a concrete file reference, so lint check 7 does
not read it as one.)

## Validation invariants

These are the testable properties the config preamble (workflow) and the
validation step (`blog-setup`) both check:

1. File parses as YAML; `blog.name`, `blog.url`, `modules`, `images.enabled`
   (non-empty), `publish.adapter` present.
2. `images.featured_default`, if set, ∈ `images.enabled`; if unset, the
   planner selects from `images.enabled`.
3. `remotion` ∈ `images.enabled` → `images.remotion.project_dir` set and
   exists on disk.
4. `publish.adapter` ∈ {`astro-git-pr`, `wordpress-rest`, `markdown`} and its
   config block present (astro: `content_dir`, `assets_dir`,
   `frontmatter_template`, `draft_mechanism`; wordpress: `content_dir`,
   `assets_dir`, `frontmatter_template`, `base_url`, `username`,
   `app_password_env`; markdown: `content_dir`, `assets_dir`, `platform` (one
   of `astro`, `hugo`, `jekyll`, `ghost`, `nextjs`, `eleventy`, `generic`),
   `frontmatter_template` (`adapters/publish/frontmatter/markdown-<platform>.md`);
   no `site_dir` for markdown).
5. Module-conditional profile docs exist iff module on: `product: true` →
   `{profile_dir}/product.md`; `competitors: true` →
   `methodology.md` in `{competitors_dir}` on the base branch (checked at
   intake by `competitor-profiles.mjs`, see
   `references/competitor-profiles.md`).
6. Required profile docs always: `blog.md`, `voice.md`, `authors.md`,
   `audience.md`, `image-style.md`.
7. `blog.route_prefix` present, starts and ends with `/`.
8. `browser.executable`, if present, is an absolute path.
9. `blog.trailing_slash` present and a boolean.
10. If `console.publish_policy` is `"auto"`, `publish.adapter` must be
    `"astro-git-pr"`. `wordpress-rest` and `markdown` are gated only:
    WordPress go-live is always manual, and every markdown post waits for the
    owner's approval (a paste platform needs that gate to paste first).
11. If a `console` block is present, it contains only the keys documented
    above with the documented types.
12. `competitors.profile_dir`, if set, is a repo-relative path; with
    `modules.competitors` on it must exist on the base branch (checked at
    intake by `competitor-profiles.mjs`).
13. `social.linkedin`, if present, has a non-empty string `company_id`.
14. `remotion` ∈ `images.enabled` → the repo-root `.gitattributes` exists on
    the BASE branch and contains a line marking
    `<images.remotion.project_dir>/src/Root.tsx` as `merge=union`.

    Not cosmetic, and the base branch specifically. Every post appends a
    uniquely-named composition to that one file, so concurrent posts always
    collide there. `console/src/merge-resolve.ts` `resolveConflictOnBranch`
    activates git's union driver by copying the BASE branch's
    `.gitattributes` into its merge worktree: with no such file the driver
    never runs, the resolve conflicts on a file whose conflicts are trivially
    resolvable, both auto-resolve attempts are spent, and the post parks for a
    human. A blog can look completely healthy until its second concurrent
    post, then park every post from that point on.

Two further profile docs are registered here but not added as numbered
invariants above, because their requirement depends on wizard-time state
that has no corresponding config field: `{profile_dir}/site-conventions.md`
is REQUIRED when `publish.adapter: wordpress-rest` AND the blog already
existed at setup (recommended otherwise); it is written by `blog-setup`'s
adapter site-inspection step and consumed by templates/writer/adapters for
table-of-contents, category, SEO-plugin, and permalink conventions.
`{profile_dir}/custom-instructions.md` is always optional: standing
per-blog instructions every stage honors, ranked below the user's live
instructions but above persona/standards defaults.

`publish.astro.site_dir` is optional and therefore not a numbered invariant,
but it IS validated at console start: when present it must be a non-empty
string resolving to an existing directory under the blog root. Absent means
the Astro project is the repo root.

## GitHub precondition (Step 0)

There is no Gate 2 "mode" any more, and no local publish path. The PR path is
the only publish path, so its two requirements are hard preconditions checked
at the Step 0 config preamble:

`git remote get-url origin` resolves, AND
`gh repo view "$(git remote get-url origin)" --json name` succeeds.

If either fails, HARD-STOP at Step 0 with the failing command's output. Do not
stage, do not write to `{content_dir}`, do not open a worktree. The console runs
the identical pair as a BLOCKING preflight check (`console/src/preflight.ts`,
key `gh_auth`), so an unusable GitHub is surfaced before a run is ever spawned.

**Why the on-disk publish path was removed:** it finished a post entirely on disk —
no PR, no CI, and an archive that never reached git. A post completed that way
had its terminal record in a place nothing else looked, which is how
`affiliate-link-management-tools` came to be parked `archive_missing` on
2026-08-10. The trade is explicit: a transient GitHub outage now blocks a post
that previously completed locally.

## Example configs

### Example: minimal personal blog (Astro)

All modules off; a single AI-prompt image strategy; no `featured_default`
(the planner selects from `images.enabled`, which here has only one
member).

```yaml
blog:
  name: "Trail Notes"
  url: https://trailnotes.example
  language: en
  route_prefix: /blog/
  trailing_slash: true

modules:
  reddit_research: false
  x_research: false
  product: false
  competitors: false
  repurpose: false

images:
  enabled: [ai-prompt]

publish:
  adapter: astro-git-pr
  astro:
    content_dir: src/content/blog
    assets_dir: src/assets/blog
    frontmatter_template: adapters/publish/frontmatter/astro-starlight.md
    draft_mechanism: "draft: true"

git:
  branch_prefix: blog/
  base_branch: main

research:
```

### Example: full product blog (WordPress)

All modules on; three image strategies mixed, with an explicit
`featured_default` that is a member of `images.enabled`.

```yaml
blog:
  name: "Fieldstack"
  url: https://fieldstack.example
  language: en
  route_prefix: /blog/
  trailing_slash: true

modules:
  reddit_research: true
  x_research: true
  product: true
  competitors: true
  repurpose: true

images:
  enabled: [remotion, ai-prompt, screenshot]
  featured_default: remotion
  remotion:
    project_dir: tools/remotion

publish:
  adapter: wordpress-rest
  wordpress:
    content_dir: content/blog
    assets_dir: blog-ops/assets
    frontmatter_template: adapters/publish/frontmatter/wordpress.md
    base_url: https://fieldstack.example
    username: blogbot
    app_password_env: FIELDSTACK_WP_APP_PASSWORD
    default_status: draft
    apply_inbound_links_live: true

git:
  branch_prefix: blog/
  base_branch: main

research:
```

### Example: Hugo blog (markdown)

A Hugo site built from this repository; the merge publishes.

```yaml
blog:
  name: "Quiet Compile"
  url: https://quietcompile.example
  language: en
  route_prefix: /posts/
  trailing_slash: true

modules:
  reddit_research: false
  x_research: false
  product: false
  competitors: false
  repurpose: false

images:
  enabled: [ai-prompt]

publish:
  adapter: markdown
  markdown:
    content_dir: content/posts
    assets_dir: content/posts/images
    platform: hugo
    frontmatter_template: adapters/publish/frontmatter/markdown-hugo.md

git:
  branch_prefix: blog/
  base_branch: main

console:
  publish_policy: gated

research:
```

## Go-live is always human (invariant, not configurable)

No config key, invocation argument, or standing instruction can authorize going live. The workflow and every publish adapter stop at a draft/PR state; the human performs the publish action (merging the PR, or clicking Publish in WP admin). "Update status to published" in an invocation refers to the content-calendar Status column, never the live post. See `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/SKILL.md` §How to invoke (Go-live guard), `${CLAUDE_PLUGIN_ROOT}/personas/editor.md` §Gate 2, and each adapter's `## On Gate 2 approval`.
