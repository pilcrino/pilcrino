# Pilcrino

Pilcrino writes blog posts for your product's blog from inside Claude Code:
how-to guides, best-of lists, "alternatives to" posts and comparisons of your
product with its competitors. It works with sites built from a GitHub
repository (Astro, Hugo, Next.js, Eleventy and other markdown sites),
creates drafts in WordPress, and hands you a file to paste in for Webflow,
Ghost, Jekyll and other platforms. For every post it researches Google (and
Reddit and X if you turn those on) in a Chrome of its own, drafts, reviews
and illustrates the post, then opens a pull request on GitHub that you read,
comment on and approve; merging it publishes on a site built from the
repository. Pilcrino never merges or publishes a post itself.

It runs on macOS only. It does not host or deploy your blog: your site must
already publish from its GitHub repository (or be a WordPress site), and
Pilcrino only adds posts to it. Research and writing run on your Claude plan
in a long Claude Code session.

Scope of "never publishes": the plugin never merges a pull request or
publishes a blog post. The `post-to-linkedin` skill does post to your LinkedIn
company page, but only when you run it. The Pilcrino app can merge Astro posts
for you if you choose that setting.

## What you need

Software, installed once:

- Google Chrome.
- Claude Code, signed in to a Claude plan that includes it.
- Apple's Command Line Tools (these bring `git`).
- Node 22.13 or newer; 24 is fine.
- GitHub CLI (`gh`), signed in to your GitHub account.

Accounts:

- GitHub, for the repository your posts go into.
- Google, for research. Pilcrino searches signed in.
- Reddit and X, only if you turn those research sources on in setup.
- WordPress: an application password (in WordPress admin, Users, Profile,
  Application Passwords). Pilcrino creates drafts with it and never publishes.
  Setup asks for the name of an environment variable that holds it, never for
  the password itself, so before you start Claude Code add one line to the
  file `~/.zshrc` in your home folder, for example
  `export MYBLOG_WP_APP_PASSWORD="paste the password here"`, then open a new
  Terminal window. The password stays on your Mac; it never goes into the
  repository or the chat.
- LinkedIn, only for `post-to-linkedin`: you must be an admin of the company
  page.

## Install

Open Terminal (in Spotlight, type Terminal). On a Mac that has never had
developer tools, the very first command below may open an Apple dialog
offering to install them: click Install, wait for it to finish, then run the
command again.

1. Command Line Tools. Type `git --version`. If a dialog appears, that is the
   installer: click Install. When `git --version` prints a version, you are
   done.
2. Homebrew (the installer for the next two). Paste the one-line command from
   https://brew.sh and follow its prompts. When it ends with "Next steps", run
   the two or three commands it prints: they add Homebrew to your PATH, and
   without them the next window will say `command not found: brew`. Check:
   `brew --version`.
3. Node and the GitHub CLI: `brew install node@22 gh`. Check: `node --version`
   prints v22.13 or newer (24 is fine too), `gh --version` prints a version.
4. Sign the GitHub CLI in: `gh auth login`, press Enter on every question to
   take the defaults, and finish the sign-in in the browser window it opens.
   Check: `gh auth status` says "Logged in".

Then, in Claude Code:

5. Run `claude` in Terminal. Which folder you are in does not matter yet. At
   the safety question, choose "Yes, I trust this folder"; the highlighted
   default exits.
6. Type these two commands into Claude Code's prompt, one at a time (they are
   Claude Code commands, not Terminal commands):

   ```text
   /plugin marketplace add pilcrino/pilcrino
   /plugin install pilcrino@pilcrino
   ```

   The install screen asks for a scope; the default, "Install for you", is
   right.
7. Check: type `/plugin`. The Installed tab lists `pilcrino` with 12 skills and
   a `pilcrino-browser` server, and the Errors tab is empty.

Pilcrino works best in Claude Code's auto mode (Shift+Tab switches modes).
When Claude Code still asks whether it may read or write one of Pilcrino's own
files, "Yes, and don't ask again" is safe.

## Quickstart

1. **Open Claude Code in your site's folder.** In Terminal, `cd` into the
   folder that holds your site's repository and run `claude`. If the site is
   not on this Mac yet, download it first: `gh repo clone <you>/<your-site>`,
   then `cd` into it. A WordPress, Webflow or other blog that is not built from
   a repository still needs a GitHub repository, which can be empty: create it
   on github.com, clone it the same way and run setup there. Pilcrino keeps the
   post files in it.
2. **Set the blog up:** `/pilcrino:blog-setup`. Setup asks one question at a
   time, each with a recommended answer, and saves as it goes, so you can stop
   and run it again later to continue. It opens the sign-in window for the
   Pilcrino browser once (see below) and installs what it needs. Allow 1 to
   1.5 hours on a new Mac, installs included. Setup writes a `blog-ops/`
   folder in your repository, plus a `tools/remotion/` image project and a
   `.gitattributes` file when you turn on drawn images. Setup does not commit
   them yet, and every post needs them on your main branch on GitHub, so
   before the first post tell Claude Code: "commit the Pilcrino setup files
   and push them to main". For an empty repository that is also its first
   commit.
3. **Plan what to write:** `/pilcrino:plan-content`. It researches your
   product, its competitors and what people search for, and writes a list of
   posts to `blog-ops/content-plan.md`. About 30 minutes, no questions asked
   while it runs.
4. **Write a post:** `/pilcrino:blog-post-workflow new`. A few questions at the
   start, then about 40 minutes of work ending in a pull request. Best-of,
   alternatives and comparison posts need a research profile for every
   competitor they name, no older than 14 days; Pilcrino writes one when you
   ask (`/pilcrino:research-competitor <name>`, about 2.5 minutes each) and
   tells you which posts need them.

You can also just say what you want ("Can you make me a content plan?",
"Write a how-to about ...") and Claude Code picks the right skill.

Your site must already deploy from GitHub. If it builds a preview for every
pull request, Pilcrino shows you that preview; if not, you read the post in
the pull request itself.

## Reviewing and publishing a post

Every post ends as a pull request on GitHub (a WordPress post also appears as
a draft in WordPress admin, with a preview link). Read it there. To ask for
changes, comment on the pull request, or tell Pilcrino in Claude Code; while
Claude Code stays open, a watcher checks the pull request every 15 minutes
(less often when nothing happens), makes the changes and replies.

When the post is right, approve it: if you work alone, tell Pilcrino
"approve" in Claude Code; an approval on GitHub is recorded too. Approving
does not publish. Publishing is your action:

- a site built from the repository (Astro, Hugo, Next.js, Eleventy): merge the
  pull request;
- WordPress: click Publish in WordPress admin;
- Webflow, Ghost, Jekyll and other paste platforms: paste the post in first,
  then merge the pull request so the repository keeps it.

Once the post is live, `/pilcrino:blog-post-workflow published <slug>` marks
it in your content plan.

## The Pilcrino browser

Pilcrino researches in a Chrome of its own, with its own sign-ins, so your
Chrome is untouched; setup opens a sign-in window once, and if a sign-in
expires later, the skill that needs it opens the window again and stops. That
sign-in window is a second Chrome next to your own, with an empty profile (no
bookmarks, none of your extensions) and only the sign-in tabs open: sign in
there, then quit that Chrome with Cmd+Q while it is the front window, because
closing the window is not enough and quitting your own Chrome by mistake
leaves Pilcrino waiting. If Google asks you to prove you are not a robot,
Pilcrino brings its window forward with a tab titled "Pilcrino: pass the
check": pass it there and retry.

## Uninstall

Quit Claude Code first (a running session recreates some of these files).
Then, in Terminal:

```bash
claude plugin uninstall pilcrino@pilcrino
claude plugin marketplace remove pilcrino
rm -rf ~/.claude/plugins/data/pilcrino-pilcrino
rm -rf ~/.pilcrino/browser
rm -rf ~/Library/Caches/claude-cli-nodejs/*/mcp-logs-plugin-pilcrino-pilcrino-browser
```

`~/.pilcrino/browser` is the Pilcrino browser's signed-in Chrome profile
(about 1.3 GB). If you want those Google, Reddit and X sessions ended rather
than just deleted, sign out of them in the Pilcrino browser before removing
it. Delete only that `browser` folder: the rest of `~/.pilcrino` belongs to
the Pilcrino app (its settings and each connected blog's database) if you
use it, so remove it only with the app, after a backup. `blog-ops/` and
`tools/remotion/` in your repository are yours to keep or delete.
`~/.claude.json` keeps harmless usage counts for the skills.

## For developers

The rest of this file describes how the plugin is built.

### How a post is made

One shared plugin, installed once. Every blog personalizes it at runtime
through a `blog-ops/` workspace that the setup wizard builds. Plugin updates
reach every blog; only the files a blog deliberately overrides drift from the
shared defaults.

The pipeline: intake Q&A, SERP research (plus optional Reddit and X research),
research analysis, plan synthesis, plan-review gate, outline, draft,
review-and-revise loop, humanization pass, marker auto-resolution
(`[VERIFY:]`, `[EXTERNAL_LINK_NEEDED:]`, `[INTERNAL_LINK_NEEDED:]`), image
plan, image generation (`[IMAGE:]` slots, one adapter per strategy),
action-items compile, staging into the target platform, Gate 2 human review
(a GitHub PR, watched by the skill's PR-comment cron), finalize and archive.
Side skills cover setup (`blog-setup`), content planning (`plan-content`),
competitor research, review-blog-post, humanize-text, suggest-images,
generate-images, repurpose-blog-post, LinkedIn posting and a post-run
retrospective (`blog-retro`).

The Pilcrino browser is the bundled `pilcrino-browser` MCP server
(`browser/`), started on demand from `.mcp.json` with `node`; it needs Node
(see What you need) and Chrome and installs its own packages the first time
it starts. Its Chrome runs on the profile at `~/.pilcrino/browser`; the
`open_login` tool quits it and opens the sign-in pages in a Chrome on the same
profile without remote control, because Google refuses to sign in a browser
under remote control, and the next tool call relaunches it once that Chrome
has quit. When a Google search hits the unusual-traffic check or returns no
results, the browser leaves that tab open under the title "Pilcrino: pass the
check", brings its window forward and releases it; the next blocked search
first closes earlier tabs with that title that no run is using. "Google
Chrome was not found" means Chrome is not at the platform default; set
`browser.executable` in `blog-ops/config.yaml`.

### What's in this repo

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

This repo is its own single-plugin marketplace. Skills and agents (12 skills,
7 subagents) are installed at user scope by default, so they are available in
every project, namespaced by the plugin name: `blog-setup` becomes
`/pilcrino:blog-setup`, `blog-post-workflow` becomes
`/pilcrino:blog-post-workflow`, and so on.

### Existing blogs at setup

If the target blog already has live posts, the setup wizard offers a
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

### The `blog-ops/` workspace

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

### Layered resolution rule

When the workflow or a subagent needs a template or standard file
`<name>.md`, it checks `blog-ops/templates/<name>.md` first; if that
doesn't exist, it falls back to this plugin's own
`${CLAUDE_PLUGIN_ROOT}/templates/<name>.md`. One existence check, no
merging. Profile docs (`profile/*.md`) have no plugin-side default at all:
they are required (or module-gated) wizard output, unique per blog.

### Skills

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

### Modules

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

### Image strategies

Any subset can be enabled simultaneously under `images.enabled`; the
image-planner assigns a strategy per slot, and `generate-images` dispatches
each slot to its adapter in `adapters/images/`:

| Strategy | `images.enabled` value | Produces a file? | What happens |
|---|---|---|---|
| Remotion | `remotion` | yes | Renders a React composition from this blog's scaffolded Remotion project (`scaffold/remotion-starter/`, personalized by the wizard) into the assets dir |
| AI prompt | `ai-prompt` | yes | Generates via codex's built-in gpt-image model (`adapters/images/codex.md` → `generate-image-codex` skill). No API key; requires the `codex` CLI on PATH with a codex/ChatGPT login. A failed generation leaves the slot's prompt block as a pasteable manual fallback |
| Screenshot | `screenshot` | no | Writes manual capture instructions into `images.md`; a human captures the real UI/page |

> **Runtime prerequisite for `ai-prompt`:** the [`codex` CLI](https://github.com/openai/codex) installed and logged in (its built-in imagegen authenticates via the codex/ChatGPT login, no `OPENAI_API_KEY`). Without it, `ai-prompt` slots degrade to a manual prompt fallback instead of failing the run.

### Publish adapters

Every adapter publishes through a pull request, so every blog needs a GitHub
repository. The site must already deploy from that repository (or be a
WordPress site); a per-PR preview deploy is optional and, for Astro, is read
from the CI comment named by `publish.astro.preview_comment_marker`.

| Adapter | `publish.adapter` value | Frontmatter template(s) | How it publishes |
|---|---|---|---|
| Astro (git PR) | `astro-git-pr` | `adapters/publish/frontmatter/astro-starlight.md` or `astro-content.md`, chosen via `publish.astro.frontmatter_template` | Stages the post into `content_dir`/`assets_dir`, opens a PR through the shared Gate 2 shell; a human merges to publish |
| WordPress (REST) | `wordpress-rest` | `adapters/publish/frontmatter/wordpress.md`, set via `publish.wordpress.frontmatter_template` | The workspace repo's markdown stays canonical. At staging it's converted to native Gutenberg block markup (`adapters/publish/scripts/md-to-gutenberg.py`, with a classic-block pandoc/marked fallback) and a WordPress draft is created via the REST API (as the rendered preview), idempotently re-synced by stored post ID through the review loop, and never pushed past `status: draft`. A human publishes in WP admin |
| Markdown (any platform) | `markdown` | `adapters/publish/frontmatter/markdown-<platform>.md`, derived from `publish.markdown.platform` (astro, hugo, jekyll, ghost, nextjs, eleventy, generic) | Writes `<slug>.md` in the platform's frontmatter shape with its images and opens a PR through the same staging as Astro; like every adapter it needs a GitHub repository. When the site builds from the repo (Astro, Hugo, Next.js, Eleventy) and serves the image shape set at setup (an `image_url_prefix` URL or a path relative to the post), the merge publishes; otherwise (Jekyll, Ghost, anything else) the owner pastes the post in before approving |

### The Pilcrino app

The plugin is complete on its own. The Pilcrino app adds background writes
and a dashboard: it runs these skills on a schedule for every blog you
connect, and you approve, give feedback on and track posts from the browser.
See https://pilcrino.com.

## Changelog

### 0.48.0 - the plugin fits the site's frontmatter

- New optional config keys, every one with a default that reproduces today's output, so an existing `blog-ops/config.yaml` needs no edit: `publish.<adapter>.frontmatter_keys` (the keys the site accepts; the writer emits only those, the reviewer fails any other key; `title`, the description, date and cover keys stay required), `publish.markdown.cover_key` (the theme's cover key, Ananke's `featured_image`; one top-level key, nested covers such as PaperMod's `cover.image` stay out of scope), `publish.astro.draft_mechanism: none` and `publish.markdown.draft_key: none` (the site has no draft flag: no draft line is written and staging strips nothing), `publish.site_live`, `publish.wordpress.permalink_structure`, `review.plan_approval` (`ask` | `auto`) and `git.push_without_asking`. Setup starts writing them in a later release; the workflow reads `site_live` and `plan_approval` in a later release too.
- WordPress password from the macOS keychain: `publish.wordpress.app_password_keychain` (a service name; the account is `username`) as the alternative to `app_password_env`, exactly one of the two. New `adapters/publish/scripts/wp-secret.sh` prints the password from whichever source the config names and nothing else; every `curl` in `wordpress-rest.md` now binds `WP_APP_PASSWORD="$(wp-secret.sh)"` at the top of its own Bash block, because each block is a fresh shell, and the `${!WP_APP_PASSWORD_ENV}` indirection is gone. Tested with `node --test` (env var set, unset, keychain item present and missing, neither or both keys).
- `config-schema.md`: a new section "Fitting the site's frontmatter" with the required-keys table per template; invariants 15 (one password source) and 16 (`frontmatter_keys` is a non-empty list that includes the required keys); invariant 11 now types every optional key and the `review` block. The workflow's Step 0 list agrees with the schema (1 to 16, including 14, which the list had left out).
- Every frontmatter template gained a "Which keys to emit" section naming its required keys, its draft key and what `frontmatter_keys` may leave out; the writer persona and the review skill honour the list and the `none` draft setting; `markdown.md` injects the cover under the configured key and skips the draft strip for `none`; `astro-git-pr.md` step 4 likewise.
- `tests/check_markdown_frontmatter.py` keeps pinning each markdown template's default keys and now also checks that each template documents the `frontmatter_keys` and `cover_key` overrides and names its required keys.

### 0.47.0 - README for a first-time owner

- A fresh-Mac test (a non-technical owner installing from the README alone) needed Google three times for a bare prerequisites list, and a README review found no word on supported systems, hosting, or what Pilcrino does not do. The README now opens with four plain sentences on what it writes, for which platforms, that you approve a pull request and merging publishes, and that it runs on macOS only and does not host or deploy your blog.
- Install is a numbered list with one route and one check per prerequisite: Apple's Command Line Tools (and the dialog that appears on a new Mac), Homebrew with its PATH step, `brew install node@22 gh` ("Node 22.13 or newer, 24 is fine", the browser's real requirement), `gh auth login`, GitHub CLI spelled out. The two `/plugin` commands are shown as Claude Code commands, with `claude`, the trust prompt and a `/plugin` check around them.
- Accounts are listed (Claude plan, GitHub, Google, Reddit and X when on, a WordPress application password, LinkedIn admin for `post-to-linkedin`), the GitHub repository moved from install to Quickstart (a WordPress or Webflow blog needs one too), and Quickstart carries rough times from the test runs: setup 1 to 1.5 hours on a new Mac, a plan about 30 minutes, about 2.5 minutes per competitor profile, a post about 40 minutes.
- New "Reviewing and publishing a post" section: read the pull request, comment there or in Claude Code, approve, then merge or click Publish in WordPress yourself. "Never publishes" is scoped: the plugin never merges or publishes a post, `post-to-linkedin` posts when run, the app can auto-merge Astro posts if you choose. The recommended Claude Code permission mode is stated.
- The browser section is three plain sentences for the owner (the sign-in window is a second Chrome next to your own; quit it with Cmd+Q; pass Google's check when asked); the mechanics moved to the developer section. Two wrong claims fixed: the browser needs Node, and setup has resumable steps rather than "six phases".
- New Uninstall section, from the uninstall test: quit Claude Code, the two `claude plugin` commands, the data folder, `~/.pilcrino` (about 1.3 GB), the MCP logs, signing out first, and what to keep. `plugin.json` describes the plugin in plain words.

### 0.46.0 - the editor idles while a subagent runs

- `blog-post-workflow`: a new §Hand-offs to subagents rule. Between an `Agent` call and the subagent's return the editor makes no tool calls: no reading ahead of documents a later stage needs, no grepping of archives or source code, no setup for a later stage, no wake-up timers. Measured on real runs, the editor spent 5 to 12 turns per hand-off on such work at 200k to 340k tokens of context each, about 8M cache-read tokens per post; every stage already reads what it needs when it starts. Every "Wait for return" line in the skill and the editor persona now says so.

### 0.45.1 - Google's check stays open

- When the Google search capture hits Google's unusual-traffic check or returns no results, the Pilcrino browser leaves that tab open and brings its window to the front instead of closing it at the end of the run. Before retaining one the browser closes every tab with exactly the title "Pilcrino: pass the check" that no run in this process owns, rereading each tab's title right before closing it and leaving it open if the title changed or cannot be read, so repeated blocks and empty results do not pile up. The retained tab gets that title only after the run has released it and brought it to the front, as its last step, so a concurrent run's tab never carries the title while in use and is never closed. If the title cannot be set, that tab is left for the owner and never cleaned up. Nothing is stored between runs; two blocks at the same moment may leave two tabs. Other sites' captures, Reddit's included, are unchanged.
- The workflow tells you `Google is asking for a check. Pass it in the Pilcrino browser window that is open, then retry.` in both cases; autopilot parks `serp_blocked` with that sentence as the detail.

### 0.45.0 - markdown publish adapter

- `adapters/publish/markdown.md`: a third publish adapter, `markdown`, for every platform without a direct adapter (Hugo, Jekyll, Ghost, Next.js, Eleventy, anything that takes a markdown file). It writes `<slug>.md` in the platform's frontmatter shape with the images beside it and opens a pull request through the same staging as `astro-git-pr`. For a site built from the repository that serves the configured image shape (optional `publish.markdown.image_url_prefix`) the merge publishes; for Jekyll, Ghost and any other platform the owner pastes the post in before approving.
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
