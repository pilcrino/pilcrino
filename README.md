# Pilcrino

A Claude Code plugin that turns "write a blog post" into a gated,
crash-resumable production pipeline: intake, research, a reviewable plan, a
drafted, reviewed and humanized post, a production-ready image set, and a
publish step that opens a PR (Astro, or a markdown file for any other
platform) or stages a draft (WordPress). It never
auto-merges or auto-publishes.

## What Pilcrino is

One shared plugin, installed once. Every blog personalizes it at runtime
through a `blog-ops/` workspace that a conversational setup wizard builds for
you. Plugin updates reach every blog; only the files a blog deliberately
overrides drift from the shared defaults.

**The pipeline, in words:** intake Q&A → SERP research (plus optional
Reddit/X research) → research analysis → plan synthesis → plan-review gate
→ outline → draft → review-and-revise loop → humanization pass → marker
auto-resolution (`[VERIFY:]`, `[EXTERNAL_LINK_NEEDED:]`,
`[INTERNAL_LINK_NEEDED:]`) → image plan → image generation
(`[IMAGE:]` slots, one adapter per strategy) → action-items compile →
staging into the target platform → Gate 2 human review (a GitHub PR, watched
by the skill's PR-comment cron) → finalize and archive. Side skills cover
setup (`blog-setup`), content planning (`plan-content`), competitor research,
review-blog-post, humanize-text, suggest-images, generate-images,
repurpose-blog-post, LinkedIn posting and a post-run retrospective
(`blog-retro`).

## What's in this repo

| Category | Count | Where |
|---|---|---|
| Skills | 12 | `skills/` |
| Subagents | 7 | `agents/` |
| Personas | 3 | `personas/` (editor, writer, repurposer) |
| Standards docs | 2 | `standards/` (writing-standards, blog-craft) |
| Structural templates | 19 | `templates/` |
| Publish adapters | 3 | `adapters/publish/` (astro-git-pr, wordpress-rest, markdown) |
| Frontmatter templates | 10 | `adapters/publish/frontmatter/` (astro-starlight, astro-content, wordpress, markdown-<platform> for seven platforms) |
| Image adapters | 3 | `adapters/images/` (remotion, ai-prompt, screenshot) |
| Remotion scaffold | 1 | `scaffold/remotion-starter/` |
| Pilcrino browser | 1 | `browser/` (the bundled `pilcrino-browser` MCP server) |
| Config contract | 1 | `skills/blog-post-workflow/references/config-schema.md` |

## Install

Prerequisites:

- Google Chrome
- Node 22 with npm
- Claude Code
- `git`
- A GitHub repository for each blog, with `gh` signed in: every adapter publishes through a pull request, the markdown one included

This repo is its own single-plugin marketplace. In Claude Code:

```bash
/plugin marketplace add pilcrino/pilcrino
/plugin install pilcrino@pilcrino
```

Skills and agents (12 skills, 7 subagents) are installed at user scope by
default, so they are available in every project, namespaced by the plugin
name: `blog-setup` becomes `/pilcrino:blog-setup`, `blog-post-workflow`
becomes `/pilcrino:blog-post-workflow`, and so on.

## The Pilcrino browser

Research runs in Pilcrino's own Chrome window, started on demand from the
plugin's bundled `pilcrino-browser` MCP server. It installs its own packages
the first time it starts. Nothing else to install beyond Chrome: no
extension, no developer mode. The first `/pilcrino:blog-setup` opens the
window and asks you to sign in to Google and, if enabled, Reddit and X, once.
Logins persist across restarts. If a session drops later, the skill that
needed it opens the sign-in window and stops; sign in and run it again. The
window stays in the background while Pilcrino works; only the sign-in window
comes forward.

Sign in happens in a window without remote control; quit it when done. Google
refuses to sign in a browser under remote control, so the `open_login` step
in the skills closes the Pilcrino browser and opens the sign-in pages in a
plain Chrome window on the same profile. Sign in, then quit that Chrome with
Cmd+Q: closing its window leaves Chrome running on macOS, and Pilcrino cannot
restart its browser while that window holds the profile. The next research
call restarts it with your logins.

Troubleshooting: "Google Chrome was not found" means Chrome is not at the
platform default; set `browser.executable` in `blog-ops/config.yaml`. A skill
stopping with "Sign in to Reddit" means that login expired; sign in in the
window it opened, quit it with Cmd+Q, and run the skill again.

## Quickstart

1. Install the plugin (above).
2. In the target blog's own git repo (or an empty directory you're about to
   `git init`), run the setup wizard: `/pilcrino:blog-setup`. Six resumable
   phases interview you and write `blog-ops/config.yaml` plus every required
   `profile/*.md` doc.
3. Plan posts if you want a queue: `/pilcrino:plan-content` writes
   `blog-ops/content-plan.md`.
4. Write your first post: `/pilcrino:blog-post-workflow new`.

If the target blog already has live posts, step 2's wizard offers a
consent-gated research pass before the regular interview. It fetches the
homepage, an about page and several recent posts, samples featured and
in-post images, and, once the publish adapter is chosen, runs that adapter's
site-inspection procedure against the live site. The evidence pre-fills the
audience, voice and image-style questions and writes
`{profile_dir}/site-conventions.md` (how this site builds posts: block
library, table-of-contents convention, categories, SEO plugin, permalinks,
post furniture). Every pre-filled answer is still presented for confirmation,
never silently accepted. A brand-new blog with nothing published yet skips
this pass entirely.

## The `blog-ops/` workspace

Every blog is a git repo. For an Astro site, `blog-ops/` lives inside the
site repo itself; for a WordPress blog, the repo holds the canonical
markdown and personalization data, and the publish adapter pushes to WP.

```
<blog-repo>/
└── blog-ops/
    ├── config.yaml            # machine-readable dispatch contract
    ├── content-plan.md        # optional post queue, written by plan-content
    ├── profile/
    │   ├── blog.md             # niche, mission, point of view, content pillars
    │   ├── voice.md            # tone, personality, credibility, lexicon,
    │   │                       #   anecdote bank, additional forbidden phrases
    │   ├── authors.md          # 1..N author voices
    │   ├── audience.md         # segments, pain points, language to use/avoid
    │   ├── image-style.md      # palette, fonts, mood, watermark; shared by
    │   │                       #   every enabled image strategy
    │   ├── product.md          # only if modules.product: true
    │   ├── competitors/        # only if modules.competitors: true
    │   ├── site-conventions.md # required for an existing WordPress blog,
    │   │                       #   recommended otherwise: how this site
    │   │                       #   builds posts (block library, TOC,
    │   │                       #   categories, SEO plugin, permalinks,
    │   │                       #   post furniture); written by the wizard's
    │   │                       #   existing-blog research phase
    │   └── custom-instructions.md  # always optional: standing per-blog
    │                           #   instructions every stage honors
    ├── templates/              # optional same-named overrides of this
    │                           #   plugin's templates/*.md
    └── drafts/
        ├── <slug>/              # brief, checklist, plan, plan-review, facts,
        │                       #   outline, draft-v<N>, review, images,
        │                       #   action-items, pr-monitor.json, research/
        └── _archive/<slug>/
```

`blog-ops/` at the workspace repo root is a **fixed convention, not
configurable**. It is the anchor the workflow uses to find `config.yaml`;
every other path is derived from config values.

**Config highlights (v1.1):** `config.yaml` also carries
`blog.trailing_slash` (whether this site's post URLs end in `/`, detected
from a live post URL at setup and consumed by every internal-link rule and
adapter), and `publish.wordpress.apply_inbound_links_live` (default `false`;
when `true`, finalize applies planned inbound links to LIVE WordPress posts
via REST once the new post is published, instead of leaving them as
hand-apply action items). Full annotated schema:
[`skills/blog-post-workflow/references/config-schema.md`](skills/blog-post-workflow/references/config-schema.md).

## Layered resolution rule

When the workflow or a subagent needs a template or standard file
`<name>.md`, it checks `blog-ops/templates/<name>.md` first; if that
doesn't exist, it falls back to this plugin's own
`${CLAUDE_PLUGIN_ROOT}/templates/<name>.md`. One existence check, no
merging. Profile docs (`profile/*.md`) have no plugin-side default at all:
they are required (or module-gated) wizard output, unique per blog.

## Skills

Every entry point installed by this plugin (`skills/`), namespaced
`pilcrino:<skill>` once installed:

| Skill | What it does |
|---|---|
| `blog-setup` | Interactive wizard that creates or updates a blog's `blog-ops/` workspace (config, profile docs, modules, images, publishing). Run before any other skill. |
| `blog-post-workflow` | Produces a publish-ready blog post through the gated multi-stage pipeline (intake → research → plan → draft → review → humanize → images → publish gate). |
| `review-blog-post` | Standalone critical review of a draft against its outline, curated facts, and this blog's standards docs. |
| `humanize-text` | Standalone final humanization pass (forbidden phrases, voice, rhythm) on any markdown draft. |
| `suggest-images` | Standalone image plan generator for a draft's `[IMAGE:]` placeholders and featured slot. |
| `generate-images` | Dispatches an image plan's slots to their adapters (remotion, ai-prompt, screenshot). |
| `generate-image-codex` | Generates one AI illustration via codex's built-in image model (gpt-image); the sole automated AI-image path, needs no `OPENAI_API_KEY`. Invoked per `ai-prompt` slot by `generate-images`, or standalone. |
| `repurpose-blog-post` | Turns a published post into an X thread, an X short take, a LinkedIn post, and a newsletter. |
| `blog-retro` | Post-run retrospective; suggests shared-skill and blog-local improvements from the actual working session. |
| `research-competitor` | Research a competitor into `{competitors_dir}/<slug>.md` (`modules.competitors`). |
| `plan-content` | Turns a product description into pillars, a scored post queue, and a competitor list, researched through the Pilcrino browser. Writes `blog-ops/content-plan.md`. Re-runs add new posts without repeating existing ones. |
| `post-to-linkedin` | Publish an already-written post to this blog's LinkedIn company page (`social.linkedin.company_id`) and add the link as the first comment. |

## Modules

Optional subsystems, each a boolean under `modules:` in `config.yaml`
(config gates the capability; a post's own brief still opts in per-post
where relevant):

| Module | Config key | What turning it on does |
|---|---|---|
| Reddit research | `modules.reddit_research` | Enables a Reddit search stage for the target keyword through the Pilcrino browser |
| X research | `modules.x_research` | Enables an X (Twitter) search stage |
| Product | `modules.product` | Requires `profile/product.md`; enables intake product-feature questions, plan positioning emphasis, product facts, and writer product-mention discipline |
| Competitors | `modules.competitors` | Requires `profile/competitors/methodology.md`; enables the 14-day freshness re-check, intake hard-halts on stale/missing competitor profiles, and reviewer competitor-pricing checks |
| Repurpose | `modules.repurpose` | Enables `repurpose-blog-post` (turns a published post into an X thread, an X short take, a LinkedIn post, and a newsletter); the skill declines politely when off |

## Image strategies

Any subset can be enabled simultaneously under `images.enabled`; the
image-planner assigns a strategy per slot, and `generate-images` dispatches
each slot to its adapter in `adapters/images/`:

| Strategy | `images.enabled` value | Produces a file? | What happens |
|---|---|---|---|
| Remotion | `remotion` | yes | Renders a React composition from this blog's scaffolded Remotion project (`scaffold/remotion-starter/`, personalized by the wizard) into the assets dir |
| AI prompt | `ai-prompt` | yes | Generates via codex's built-in gpt-image model (`adapters/images/codex.md` → `generate-image-codex` skill). No API key; requires the `codex` CLI on PATH with a codex/ChatGPT login. A failed generation leaves the slot's prompt block as a pasteable manual fallback |
| Screenshot | `screenshot` | no | Writes manual capture instructions into `images.md`; a human captures the real UI/page |

> **Runtime prerequisite for `ai-prompt`:** the [`codex` CLI](https://github.com/openai/codex) installed and logged in (its built-in imagegen authenticates via the codex/ChatGPT login, no `OPENAI_API_KEY`). Without it, `ai-prompt` slots degrade to a manual prompt fallback instead of failing the run.

## Publish adapters

| Adapter | `publish.adapter` value | Frontmatter template(s) | How it publishes |
|---|---|---|---|
| Astro (git PR) | `astro-git-pr` | `adapters/publish/frontmatter/astro-starlight.md` or `astro-content.md`, chosen via `publish.astro.frontmatter_template` | Stages the post into `content_dir`/`assets_dir`, opens a PR through the shared Gate 2 shell; a human merges to publish |
| WordPress (REST) | `wordpress-rest` | `adapters/publish/frontmatter/wordpress.md`, set via `publish.wordpress.frontmatter_template` | The workspace repo's markdown stays canonical. At staging it's converted to native Gutenberg block markup (`adapters/publish/scripts/md-to-gutenberg.py`, with a classic-block pandoc/marked fallback) and a WordPress draft is created via the REST API (as the rendered preview), idempotently re-synced by stored post ID through the review loop, and never pushed past `status: draft`. A human publishes in WP admin |
| Markdown (any platform) | `markdown` | `adapters/publish/frontmatter/markdown-<platform>.md`, derived from `publish.markdown.platform` (astro, hugo, jekyll, ghost, nextjs, eleventy, generic) | Writes `<slug>.md` in the platform's frontmatter shape with its images and opens a PR through the same staging as Astro; like every adapter it needs a GitHub repository. When the site builds from the repo (Astro, Hugo, Next.js, Eleventy) the merge publishes; otherwise (Jekyll, Ghost, anything else) the owner pastes the post in before approving |

## The Pilcrino app

The plugin is complete on its own. The Pilcrino app adds background writes
and a dashboard: it runs these skills on a schedule for every blog you
connect, and you approve, give feedback on and track posts from the browser.
See https://pilcrino.com.

## Changelog

### 0.45.0 - markdown publish adapter

- `adapters/publish/markdown.md`: a third publish adapter, `markdown`, for every platform without a direct adapter (Hugo, Jekyll, Ghost, Next.js, Eleventy, anything that takes a markdown file). It writes `<slug>.md` in the platform's frontmatter shape with the images beside it and opens a pull request through the same staging as `astro-git-pr`. For a site built from the repository the merge publishes; for Jekyll, Ghost and any other platform the owner pastes the post in before approving.
- Seven frontmatter docs, `adapters/publish/frontmatter/markdown-<platform>.md`; `tests/check_markdown_frontmatter.py` pins each block's keys.
- `config-schema.md` documents the `publish.markdown` block; `publish_policy: auto` stays Astro only. `blog-setup` offers the adapter in Phase 5.
- README prerequisites name `git` and a GitHub repository with `gh` signed in: every adapter publishes through a pull request.

### 0.44.2 - interrupted runs restart

- The console contract documents `interrupted_retry`: the app restarts a run that was killed mid-flight in the same mode, and parks `interrupted_retries_exhausted` after two restarts.

### 0.44.1 - layout check loads lazy images for real

- Headless Chrome did not start lazy image loads on a scripted scroll, so the check timed out on any post with `loading="lazy"` images below the fold (every Pilcrino post). Every image is now switched to eager before the wait, which resumes the deferred loads at once. Verified on the live posts.

### 0.44.0 - layout check on the rendered post

- `adapters/publish/scripts/layout-check.mjs --url <page>` opens the page in a throwaway headless Chrome at 1440px and 390px and reports every element that extends past its own container, plus a page that scrolls sideways. JSON out, exit 1 on findings, no model involved. It reproduces the fault that shipped on 2026-10-07: a table 147px wider than its column, under the table of contents, which the build passed and nobody measured.
- The Gate 2 banner carries a `Layout:` line for every post: the `astro-git-pr` adapter runs the check on the staging-deploy URL (§Staging step 9) and the PR monitor runs it once when that URL first appears, commenting the findings on the PR (§Each firing step 2a); `wordpress-rest` runs it on the draft preview and says "not checked" when the preview needs a signed-in browser.
- `tests/lint.sh` runs the publish adapter scripts' tests too, and prints a failing test log instead of swallowing it.

### 0.43.3 - tags are created on merge

- A merge to main that bumps the plugin version now gets the tag `v<version>` from a workflow (`.github/workflows/tag.yml`). No hand tagging; the app pins these tags.

### 0.43.2 - CLAUDE.md for sessions working on the plugin

- `CLAUDE.md` states the rules a Claude Code session needs in this repository: bump the version and changelog with every change, run the lint, release by tag, and never edit the pinned copy under the app's `plugin/`.

### 0.43.1 - competitor profiles come from the base branch

- A post run read competitor profiles from its own branch, which can be
  months behind main. A refresh on the Competitors screen landed on main and
  never reached the post, so `competitor_profile_stale` parked forever.
- `skills/blog-post-workflow/scripts/competitor-profiles.mjs` fetches `origin/<base>`, pins one
  commit and reads the profiles from it. Intake lists and date-checks from
  it; Stage 1.5c snapshots the profiles into the draft's
  `research/profiles/`, and the researcher reads only that snapshot. The post
  branch is never touched.
- Park text names where the profile was read and its date.

### 0.43.0 - the console finds its plugin

- The Remotion composition-id helper lives in the plugin at
  `adapters/images/scripts/`.
- Lint checks every `${CLAUDE_PLUGIN_ROOT}` reference, not only Markdown.
- `video-setup` no longer ships in the plugin.

## Licence

MIT. See [LICENSE](LICENSE).
