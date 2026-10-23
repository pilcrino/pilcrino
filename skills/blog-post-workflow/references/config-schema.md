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
  site_live: true                           # OPTIONAL boolean; whether the site is
                                            #   online and rebuilds from the base
                                            #   branch. Setup asks; adapters read it
                                            #   only for their wording (merging
                                            #   publishes vs. files the post). Absent:
                                            #   today's wording, no behaviour change
  astro:
    content_dir: src/content/blog
    site_dir: web/site                      # OPTIONAL; the Astro project root
                                            #   (owns package.json, emits dist/).
                                            #   Omit when the site IS the repo
                                            #   root; a monorepo points it at the
                                            #   subdirectory, e.g. web/site
    assets_dir: src/assets/blog
    frontmatter_template: adapters/publish/frontmatter/astro-starlight.md
    draft_mechanism: "draft: true"          # how a post is excluded from builds;
                                            #   the literal none means the site has
                                            #   no draft flag: the writer emits no
                                            #   draft line and staging strips nothing
                                            #   (see §Fitting the site's frontmatter)
    frontmatter_keys: [title, date, excerpt, tags, authors, cover, head]
                                            # OPTIONAL; the keys the site's content
                                            #   schema accepts. The writer emits only
                                            #   these and the reviewer checks them.
                                            #   Absent: every key of the template, so
                                            #   nothing changes (invariant 16)
    authors_map_check: astro.config.mjs     # optional; omit to skip
    preview_comment_marker: "<!-- blog-preview -->"  # optional; CI-dependent
  wordpress:
    content_dir: content/blog                       # canonical finalized markdown
    assets_dir: blog-ops/assets                     # local store for generated images pre-upload
    frontmatter_template: adapters/publish/frontmatter/wordpress.md   # frontmatter contract for the writer
    base_url: https://baselinenotes.com
    username: blogbot
    app_password_env: BASELINE_WP_APP_PASSWORD      # env var NAME, never the secret
    # app_password_keychain: pilcrino-wp-baseline   # ALTERNATIVE to app_password_env: a
                                                     #   macOS only: keychain service name; the
                                                     #   account is `username`. Exactly one
                                                     #   of the two is set (invariant 15);
                                                     #   adapters/publish/scripts/wp-secret.sh
                                                     #   resolves whichever it is
    permalink_structure: /%postname%/               # OPTIONAL; the site's WordPress
                                                     #   permalink setting as setup read it
                                                     #   (e.g. /%year%/%monthnum%/%day%/%postname%/);
                                                     #   informational: the adapter prints
                                                     #   the REST response's `link`, never
                                                     #   a URL built from this
    frontmatter_keys: [title, date, excerpt, tags, authors]
                                                     # OPTIONAL; as for astro; absent:
                                                     #   every key of wordpress.md
    default_status: draft
    apply_inbound_links_live: false                 # when true, finalize applies
                                                     #   planned inbound links to
                                                     #   LIVE posts via REST once
                                                     #   the new post is published;
                                                     #   default false (safety: off)
  markdown:
    content_dir: posts                              # posts/<slug>.md
    assets_dir: posts/images                        # posts/images/<slug>/<file>
    image_url_prefix: /images                       # OPTIONAL; when set, images are referenced as <prefix>/<slug>/<file>; after trimming whitespace and dropping one trailing slash it must match ^/[^/\s][^\s]*$ or ^https?://[^/\s]+(/[^\s]*)?$ (accepted: /images/ and ' /images ' both mean /images; rejected: //cdn.example/images, '/image folder', https:///x);
                                                    #   absent: the source-relative path from content_dir, which only
                                                    #   works for a site that copies the assets folder next to the post
    platform: hugo                                  # astro | hugo | jekyll | ghost | nextjs | eleventy | generic
    frontmatter_template: adapters/publish/frontmatter/markdown-hugo.md   # derived from platform at setup; plugin-relative
    frontmatter_keys: [title, description, date, featured_image]
                                                    # OPTIONAL; the keys the theme reads; absent: every key
                                                    #   of the markdown-<platform>.md template (invariant 16).
                                                    #   The cover key named by cover_key below must be in it;
                                                    #   the draft key is never listed (draft_key decides it)
    cover_key: featured_image                       # OPTIONAL; the top-level frontmatter key the theme reads the
                                                    #   cover image from (Ananke: featured_image). One scalar key
                                                    #   only, no dots: a nested cover such as PaperMod's
                                                    #   cover.image is out of scope and keeps the default.
                                                    #   Absent: the template's own key (hugo: cover)
    draft_key: draft                                # OPTIONAL; the platform's draft key as the template defines
                                                    #   it (astro, hugo: draft; jekyll: published), or the
                                                    #   literal none when the site honours no draft flag: the
                                                    #   writer emits no draft line and staging strips nothing.
                                                    #   Absent: the template's default

git:
  branch_prefix: blog/
  base_branch: main
  push_without_asking: false  # OPTIONAL boolean, default false; true records the
                              #   owner's standing consent (given at setup) for the
                              #   workflow to push commits to the base branch (a
                              #   competitor profile, a plan row, a date fix) without
                              #   asking each time. Never covers merging or publishing
  # The PR path is the only publish path. `origin` must resolve AND be a GitHub
  #   repo accessible to authenticated gh (gh repo view succeeds); both are hard
  #   preconditions checked at Step 0. See §GitHub precondition below.

review:                       # OPTIONAL block
  plan_approval: ask          # ask | auto, default ask. ask: the owner reads the plan
                              #   summary and approves it before drafting starts;
                              #   auto: the plan reviewer's approval is enough.
                              #   Autopilot ignores it (the console gates)
  pr_monitor: false           # OPTIONAL boolean, default false. true: after Gate 2 a
                              #   cron watches the post's pull request and acts on
                              #   comments there; false: Gate 2 waits in the session.
                              #   Autopilot ignores it (the console gates)

research:

browser:
  executable: /path/to/chrome   # OPTIONAL; only when Google Chrome is not at the platform default

social:                       # OPTIONAL; social posting targets
  linkedin:
    company_id: "000000000"   # LinkedIn company page id; presence enables /post-to-linkedin. Posts are made AS this page.
```

No secret is ever written in this file: `app_password_env` is the *name* of an
environment variable and `app_password_keychain` the *service name* of a macOS
keychain item (macOS only; Windows and Linux use the variable route); `adapters/publish/scripts/wp-secret.sh` turns either into the
value at the moment a command needs it. The workflow resolves `{drafts_dir}`,
`{content_dir}`, `{assets_dir}`, etc. from this file in a config preamble; no
other file hardcodes a path.

### Fitting the site's frontmatter (optional keys, per adapter)

Every key in this section is optional, and a config without it behaves exactly
as before: the defaults reproduce today's output byte for byte. Setup writes
them after reading the site; an older config needs no edit.

**`publish.<adapter>.frontmatter_keys`** (astro, wordpress, markdown): a
non-empty list of the top-level frontmatter keys the site accepts. When set, the
writer emits only these keys and the reviewer fails a draft that carries any
other key or lacks any of them; when absent, the template's full key list
applies. Four keys are the template's *required keys* and may never be left out
of the list: `title`, the description key, the date key and the cover key (the
WordPress template has no cover key, so there it is three). The draft key is
not governed by this list at all: `draft_mechanism` / `draft_key` decide it (see
below). The template's own section "Which keys to emit" names its keys, and
invariant 16 checks the list. Example: the official Astro blog template's
collection schema is `title, description, pubDate, updatedDate, heroImage`, so
with `frontmatter_template: adapters/publish/frontmatter/astro-content.md` setup
writes `frontmatter_keys: [title, description, pubDate, heroImage]` and the
post carries no `tags` or `author` the site would drop.

| Template | Required keys (always in the list) | Draft key | Omittable keys |
|---|---|---|---|
| `astro-starlight.md` | `title`, `excerpt`, `date`, `cover` | `draft` (`draft_mechanism`) | `tags`, `authors`, `head` (omitting `head` also drops the FAQ JSON-LD and the reviewer skips that sub-check) |
| `astro-content.md` | `title`, `description`, `pubDate`, `heroImage` | `draft` (`draft_mechanism`) | `tags`, `author` |
| `wordpress.md` | `title`, `excerpt`, `date` | `draft` (documentation only) | `tags`, `authors` |
| `markdown-astro.md` | `title`, `description`, `pubDate`, the cover key (`heroImage`) | `draft` (`draft_key`) | `tags`, `author` |
| `markdown-hugo.md` | `title`, `description`, `date`, the cover key (`cover`) | `draft` (`draft_key`) | `tags`, `author` |
| `markdown-jekyll.md` | `layout`, `title`, `description`, `date`, the cover key (`image`) | `published` (`draft_key`) | `tags`, `author` |
| `markdown-ghost.md` | `title`, `excerpt`, `published_at`, the cover key (`feature_image`) | none | `tags`, `authors` |
| `markdown-nextjs.md`, `markdown-eleventy.md`, `markdown-generic.md` | `title`, `description`, `date`, the cover key (`image`) | none | `tags`, `author` |

**Draft field.** `publish.astro.draft_mechanism` is the literal frontmatter line
that keeps a post out of the build (default `"draft: true"`). The value `none`
means the site has no draft flag: the writer emits no draft line, and
`astro-git-pr.md` §Staging step 4 strips nothing. For the markdown adapter the
template already fixes the platform's draft key; `publish.markdown.draft_key`
may restate it (`draft` for astro and hugo, `published` for jekyll) or be
`none` with the same meaning as above (`markdown.md` §Staging step 2 then skips
the strip). A site without a draft flag publishes a merged post at once, which
is why setup records this only after telling the owner so.

**`publish.markdown.cover_key`**: the single top-level key the theme reads the
cover image from, holding one scalar path (Hugo's Ananke theme: `featured_image`).
Default: the template's own key (`heroImage`, `cover`, `image` or
`feature_image`). The writer emits the cover under it, `markdown.md` §Staging
injects the resolved path under it, and the key counts as the required cover
key above. Nested covers (PaperMod's `cover.image`, a map with `image` and
`alt`) are out of scope this round: a `cover_key` containing a dot is invalid,
and such a site keeps the default key.

**`publish.site_live`**: whether the site is online and rebuilds from the base
branch. The workflow reads it for the Gate 2 wording (merging publishes vs.
merging files the post) and for the image gate: on a live site a post pauses
before staging while any image is still missing, so no pending-image note can
be merged live.

**`publish.wordpress.permalink_structure`**: the WordPress permalink setting as
setup read it from `/wp-json/wp/v2/settings` or inferred from a post's `link`.
Informational: no adapter builds a URL from it; the REST response's `link` is
the only source of a post's URL.

**`publish.wordpress.app_password_keychain`**: the alternative to
`app_password_env`; see the invariants (15) and `wordpress-rest.md` §Config
inputs.

**`review.plan_approval`** (`ask` | `auto`, default `ask`): whether the owner
approves each post's plan before drafting (`ask`) or the plan reviewer's
approval suffices (`auto`). The workflow reads it at its plan gate; autopilot
ignores it.

**`review.pr_monitor`** (`true` | `false`, default `false`): whether a cron
watches each post's pull request after Gate 2. `true`: the PR-comment monitor
(`references/pr-monitor.md`) runs every ~15 minutes, answers comments and
reviews on the pull request and finalizes on a merge with proof of approval.
`false` or absent: no cron; Gate 2 waits for the owner's reply in the session,
GitHub comments and reviews are not read, and the owner's own merge on GitHub
counts as approval (SKILL.md Step 15.2). Read at each Gate 2 and resume, and
by each monitor firing (which stops itself when it finds `false`). Autopilot
ignores it: console-gated runs never start the monitor.

**`git.push_without_asking`** (boolean, default `false`): the owner's standing
consent, recorded at setup, for the workflow to push its own commits to the base
branch without a question each time. It never covers merging a PR or publishing.

### `console:` (optional)

Written by `blog-setup` for every blog, with `publish_policy: gated`. The
app decides whether a blog is connected from `~/.pilcrino/console/blogs.json`,
not from this block; its presence changes nothing for a terminal-only blog.
All fields optional with the defaults shown.

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
   `assets_dir`, `frontmatter_template`, `base_url`, `username`, and the one
   password source invariant 15 requires; markdown: `content_dir`, `assets_dir`, `platform` (one
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
11. Documented optional blocks and keys carry the documented types. A `console`
    block, if present, contains only the keys documented above with the
    documented types. Likewise: a `review` block, if present, contains only
    `plan_approval`, one of `ask` / `auto`, and `pr_monitor`, a boolean;
    `publish.site_live` and
    `git.push_without_asking`, if present, are booleans;
    `publish.astro.draft_mechanism` is a non-empty string (`none` allowed);
    `publish.markdown.draft_key`, if present, is the template's draft key or
    `none`; `publish.markdown.cover_key`, if present, is a non-empty string
    without a dot (one top-level key); `publish.wordpress.permalink_structure`
    and `publish.wordpress.app_password_keychain`, if present, are non-empty
    strings. An unknown key in `review` is a failure, as in `console`.
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
15. `publish.adapter: wordpress-rest` → exactly one of
    `publish.wordpress.app_password_env` (a valid environment variable name)
    and `publish.wordpress.app_password_keychain` (a non-empty keychain service
    name) is set. Both or neither is a failure;
    `adapters/publish/scripts/wp-secret.sh` refuses the same two states at run
    time. This is a syntax check: whether the variable is exported or the
    keychain item exists is probed once at staging, never here.
16. `publish.<adapter>.frontmatter_keys`, if present, is a non-empty list of
    non-empty strings that includes every required key of the configured
    template, per the table in §Fitting the site's frontmatter (`title`, the
    description key, the date key, the cover key; `layout` too for jekyll;
    no cover key for wordpress). With `publish.markdown.cover_key` set, that
    key is the cover key the list must include. The draft key does not belong
    in this list: a listed `draft` or `published` fails this invariant (the
    validator and the schema's own tests reject it), and `draft_mechanism` /
    `draft_key` alone decide whether the draft line is emitted (`none`:
    never).

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

A Hugo site built from this repository that serves `static/` at the site root, so the images under `static/images/<slug>/` are served at `/images/<slug>/<file>`; for a site that serves that image shape the merge publishes.

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
    assets_dir: static/images
    image_url_prefix: /images
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
