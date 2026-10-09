---
name: blog-setup
description: Interactive wizard that creates or updates a blog-ops/ workspace. Six resumable phases (identity & niche, voice & authors, modules, images, publishing, validation) plus Phase 3.5, a one-time sign-in to the Pilcrino browser, interview the blog owner one question at a time and write blog-ops/config.yaml plus every profile/*.md doc the rest of this plugin consumes (blog.md, audience.md, voice.md, authors.md, product.md, image-style.md, competitors/methodology.md, site-conventions.md, custom-instructions.md). An optional Phase 1.5, offered when the blog already has live content, runs consent-gated research against the live site (fetched pages, sampled images, and, once the adapter is chosen, its site-inspection procedure) to pre-fill audience/voice/image-style from evidence instead of a blank interview. Scaffolds the Remotion image project and rewrites its theme tokens when remotion is enabled, and probes the configured publish adapter's auth (for WordPress, at most once per run, with lockout guidance on failure, never retried). Re-running detects existing artifacts per phase and offers update-or-skip. Ends by running config-schema.md's validation invariants 1-14 and handing off to `/blog-post-workflow new`. An optional Phase 7 offers to prepare the blog for the Pilcrino app (background writes plus a browser approval dashboard), scaffolding blog-ops/content-plan.md and a config.yaml console block, then re-running invariants 1-14. Must be run before blog-post-workflow, whose Step 0 config preamble hard-stops without a valid blog-ops/config.yaml.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, mcp__plugin_pilcrino_pilcrino-browser__tabs, mcp__plugin_pilcrino_pilcrino-browser__navigate, mcp__plugin_pilcrino_pilcrino-browser__capture, mcp__plugin_pilcrino_pilcrino-browser__screenshot, mcp__plugin_pilcrino_pilcrino-browser__wait, mcp__plugin_pilcrino_pilcrino-browser__login_status, mcp__plugin_pilcrino_pilcrino-browser__open_login
---

# blog-setup

Builds the `blog-ops/` workspace that every other component in this plugin
reads: `blog-post-workflow`'s Step 0 config preamble, the personas, the
agents, `review-blog-post`, `humanize-text`, `suggest-images`,
`generate-images`, `repurpose-blog-post`, and `blog-retro` all consume the
files this wizard writes. Run this FIRST, in the blog's own repository (or
an empty directory that will become one).

The authoritative contract for everything this skill produces is
`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md`
(the full `config.yaml` schema, both example configs, validation invariants
1-14, and the path-variable table). If anything below and that file
disagree, that file wins; re-read it before making a judgment call this
skill doc doesn't cover explicitly.

## What gets produced

```
<blog-repo>/
└── blog-ops/
    ├── config.yaml
    ├── profile/
    │   ├── blog.md
    │   ├── audience.md
    │   ├── voice.md
    │   ├── authors.md
    │   ├── image-style.md
    │   ├── product.md                  # only if modules.product: true
    │   ├── competitors/                # default location; configurable via
    │   │   └── methodology.md          #   competitors.profile_dir (only if modules.competitors: true)
    │   ├── site-conventions.md         # only if Phase 1.5 research ran (§Phase 1.5)
    │   ├── setup-notes.md              # Phase 3.5 sign-in outcome
    │   └── custom-instructions.md      # only if seeded in Phase 6; always optional
    └── reference/                      # only if Phase 1.5 research ran
        ├── site-research.md            # evidence log, cites every fetched URL
        └── image-samples/              # downloaded featured/in-post images
```

Plus, if `images.remotion` is enabled, a copied-and-personalized Remotion
project at `images.remotion.project_dir` (scaffolded from
`${CLAUDE_PLUGIN_ROOT}/scaffold/remotion-starter/`).

`blog-ops/templates/` (optional same-named overrides of this plugin's
`templates/*.md`) and `blog-ops/drafts/` are NOT created by this wizard;
they come into existence on demand (an override the blog owner adds later,
or the first `/blog-post-workflow new` run creating a slug directory).

## Path variables

Per config-schema.md §Path variables: `{ops_dir}` (`blog-ops`),
`{profile_dir}` (`blog-ops/profile`), and `{drafts_dir}` (`blog-ops/drafts`)
are FIXED conventions, never configurable, so this wizard can write profile
docs before `config.yaml` even exists. `{content_dir}`, `{assets_dir}`, and
`{remotion_dir}` are resolved from the answers gathered in Phase 4 and
Phase 5 below; use the literal values the user gave you once you have them,
the `{...}` notation here is just shorthand for "the path this variable
resolves to."

## Global rules (apply to every phase)

1. **One question at a time.** Never dump a numbered list of questions and
   ask the user to answer all of them in one message. Ask, wait for the
   reply, ask the next one. Offer a sensible default in most questions
   ("press enter for `<default>`") so the interview moves fast for a user
   who's happy with conventions.
2. **Write artifacts immediately**, at the end of each phase, not batched
   at the very end of the whole wizard. A crash or an intentional stop
   after Phase 3 leaves Phases 1-3's files on disk, ready for a resumed run
   to pick up at Phase 4.
3. **Resumability.** Before starting a phase, check whether its artifact(s)
   already exist. If they do: read them, print a short summary (2-5
   lines), and ask: "Keep as-is, update, or start over for this phase?"
   - **Keep as-is** → skip straight to the next phase, no writes.
   - **Update** → re-run the interview pre-filled with the existing
     answers as defaults (a user hitting enter on every question
     reproduces what's already there); rewrite the artifact(s).
   - **Start over** → run the interview from scratch, ignoring the
     existing content, then overwrite.
4. **`config.yaml` is always rewritten whole.** Never append a YAML
   fragment to the end of the file. Each phase that touches `config.yaml`
   reads the current file (if any), merges its new/updated top-level
   key(s) into the in-memory structure, and writes the complete file back.
   This keeps the file valid YAML at every checkpoint, not just at the end.
5. **Never write a secret VALUE anywhere** — not in `config.yaml`, not in
   any profile doc, not in a status message. Only environment-variable
   NAMES (e.g. `app_password_env`). If a question could produce a
   secret answer, phrase it as "what environment variable holds this?" not
   "what is this?".
6. **No placeholder tokens left behind.** Every doc this wizard writes must
   be fully filled from the interview; never leave a literal `<...>`
   template placeholder in a file presented as finished. If the user has
   no answer for an optional field, write "none yet" or omit the section
   per that section's own optionality rule (documented per phase below),
   never leave the angle-bracket placeholder in place.
7. **`blog-ops/` is fixed at the workspace repo root.** Never ask the user
   where to put it, never make it configurable. Every path this wizard
   writes into `config.yaml` or discusses with the user is relative to the
   repo root (the current working directory).

## Phase 0, Bootstrap

Runs once, before Phase 1, on every invocation (resumed or fresh).

1. **Git repo check.** `git rev-parse --is-inside-work-tree` (from the cwd).
   - If it fails (not a git repo): tell the user this workspace needs to be
     a git repo (the publish adapters and the shared Gate 2 shell both
     assume one), and ask permission: "Initialize a git repo here with
     `git init`?" Only run `git init` after an explicit yes. If the user
     declines, stop the wizard, tell them to `git init` (or `cd` into an
     existing repo) and re-run `/blog-setup`.
2. **Resume detection.** `Glob: blog-ops/config.yaml` and
   `Glob: blog-ops/profile/*.md`.
   - Neither exists → fresh run, proceed to Phase 1.
   - Either exists → this is a resume/update run. Read what's there,
     summarize which phases already have artifacts (config.yaml keys
     present; which profile docs exist), and tell the user: "Found an
     existing blog-ops/ workspace. I'll walk through all six phases
     (plus the optional existing-blog research pass between Phases 1 and
     2, if this blog already has live content); each one will offer to
     keep, update, or redo what's already there."
     Then proceed to Phase 1 (each phase's own resumability check per
     Global rule 3 handles the skip-vs-update decision).

## Phase 1: Identity & niche

**Goal:** establish who this blog is and who it's for. Writes
`{profile_dir}/blog.md`, `{profile_dir}/audience.md`, and starts
`blog-ops/config.yaml` with the `blog:` block.

**Resume check:** `{profile_dir}/blog.md` and `{profile_dir}/audience.md`.

### Interview: blog identity

Ask one at a time:

1. Blog name (e.g. "Trail Notes")
2. Blog URL (e.g. `https://trailnotes.example`)
3. Language code (default `en`)
4. Niche/topic: what is this blog about, in one or two sentences?
5. Mission: why does this blog exist? What transformation does a reader
   get from following it?
6. Point of view: what does this blog believe about its niche that's
   distinct or contrarian? (This is what keeps posts from reading as
   generic SEO filler.)
7. Content pillars: 3-5 recurring topic buckets this blog returns to
8. Tag taxonomy: the fixed list of tags posts draw from (2-4 tags per post
   come from this list — both Astro frontmatter templates read it from
   `{profile_dir}/blog.md`)
9. Primary CTA target + hook: what should every post's closing CTA point
   to (newsletter signup, product trial, app download, etc.), and what's
   the one-line hook for it (e.g. "Subscribe for weekly trail reports")?
10. Publish cadence: how often does this blog publish? (Informational,
    not consumed by any downstream check, but useful context for anyone
    reading this doc later.)
11. Route prefix: the URL path prefix this blog's posts are served under
    (default `/blog/`; use `/` for a root-routed blog with no prefix). This
    drives every internal link, canonical URL, and inbound-link ownership
    grep the rest of the plugin emits — get it right up front.
12. Trailing slash: do (or will) this blog's post URLs end with a trailing
    slash (e.g. `/blog/my-post/`) or not (`/blog/my-post`)? **Gate — press
    the user for a real answer here only if this is a brand-new blog with
    no live posts yet, or you already know Phase 1.5's research offer (the
    very next thing this wizard asks, right after this interview) will be
    declined.** In both of those cases Phase 1.5(a) will never fetch real
    post URLs to detect the actual convention from, so this is the only
    chance to pin it down. If this blog already exists and there's a real
    chance its research offer will be accepted, don't press for an answer
    here — write the default below as a provisional placeholder and let
    Phase 1.5(a) detect the real convention from the fetched post URLs,
    presenting it for the SAME single confirmation as its other pre-fills
    (§Phase 1.5(f)) instead of asking the user twice. Default `yes`
    (`true`) if unsure — most sites do. Whichever path sets it, Phase 5's
    adapter site inspection remains the final cross-check: if the live
    site's actual convention disagrees with whatever value is on file, that
    step flags it loudly and corrects `blog.trailing_slash` to match
    reality rather than leaving the mismatch silent.
    For an Astro site, don't press at all: the site's Astro config already
    answers it, and Phase 5 step 2a reads `trailingSlash` and `build.format`
    from that config and sets this value from evidence. Write the default
    here as a placeholder.

Write `{profile_dir}/blog.md`:

```markdown
# <Blog name>

## Niche

<answer 4>

## Mission

<answer 5>

## Point of view

<answer 6>

## Content pillars

- <pillar 1>
- <pillar 2>
- ...

## Tag taxonomy

- <tag 1>
- <tag 2>
- ...

## Primary CTA

**Target:** <link or destination from answer 9>
**Hook:** <one-line hook from answer 9>

## Publish cadence

<answer 10>
```

### Interview: audience

Ask one at a time:

1. Primary audience: who reads this blog (role, context, what brought them
   here)?
2. Secondary audience, if any (skip if there's only one clear audience)
3. Top pain points this audience has, in priority order (this order
   matters, `{profile_dir}/voice.md` and the writer persona use it to
   decide what to lead with)
4. Language to use: words/phrasing that resonate with this audience
5. Language to avoid: jargon, marketing-speak, or tone that turns this
   audience off
6. Niche jargon that needs translating for this audience (terms an
   insider would know but this blog's typical reader might not) — this
   extends `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`
   §Insider-jargon translation with this blog's own niche's terms
7. Insider posture: does this audience already know the niche jargon (an
   expert/insider readership), or does every post need to translate it on
   first use? (Default: translate on first use.)

Write `{profile_dir}/audience.md`:

```markdown
# Audience

## Primary audience

<answer 1>

## Secondary audience

<answer 2, or "None — this blog writes for a single audience.">

## Pain points (priority order)

1. <highest priority>
2. <next>
...

## Language to use

- <phrase/word pattern 1>
- ...

## Language to avoid

- <phrase/word pattern 1>
- ...

## Niche jargon translation

| Insider term | Reader-facing translation |
|---|---|
| <term> | <plain-language explanation> |

## Reading posture

<answer 7 — "insider audience, jargon OK" or "translate niche jargon on first use">
```

### Write config.yaml (blog: block)

Read the existing `blog-ops/config.yaml` if present (resume case), merge in:

```yaml
blog:
  name: "<answer 1>"
  url: <answer 2>
  language: <answer 3>
  route_prefix: <answer 11, default /blog/>
  trailing_slash: <answer 12, default true>
```

Write the full file (Global rule 4). If this is a fresh run, the file now
contains only the `blog:` block; later phases add the rest. When Q12's gate
above deferred `trailing_slash` (existing blog, research offer still
pending), the value written here is the provisional default — Phase 1.5(a),
if it runs, re-merges and rewrites this same `blog:` block once the real
value is confirmed (Global rule 4), so this is never a second permanent
answer, just a placeholder.

## Phase 1.5: Existing-blog research (optional)

**Goal:** when the blog already has live content, gather concrete evidence
from the site itself — fetched pages, extracted palette/typography, sampled
images, and (once Phase 5 has chosen and verified the publish adapter) its
recorded conventions — and use that evidence to pre-fill the audience, voice,
and image-style questions the rest of the wizard would otherwise ask cold.
This phase is entirely consent-gated: a brand-new blog has nothing to
research, and even an existing one may decline.

**Offer.** Ask: "Does <blog name> already have posts live at <answer 2 from
Phase 1>, or is this a brand-new blog with nothing published yet?"

**Record the answer durably, before branching on it.** Read the
`{profile_dir}/blog.md` Phase 1 already wrote, insert `existing_blog:
<true|false>` as its own line directly under the `# <Blog name>` heading,
and write the file back. Do this for BOTH branches below, not just "already
exists" — `blog.md` is the durable spot precisely because it always
exists, unlike `blog-ops/reference/site-research.md`, which never gets
written at all in the brand-new case or the decline sub-case just below.
This is the field the Phase 5 resume check and Phase 6's site-conventions
advisory check read, instead of proxying the answer off `site-research.md`'s
mere presence — a proxy that misses an existing blog that goes on to
decline research.

- **Brand-new** (`existing_blog: false`) → skip this whole phase, no
  further question, go straight to Phase 2.
- **Already exists** (`existing_blog: true`) → ask consent separately: "I
  can research the live site now — fetch a few pages, sample images, and
  (later, once your publish adapter is set up) detect its conventions — to
  pre-fill your audience, voice, and image-style docs from real evidence
  instead of a blank interview. Want me to run that before Phase 2?" Decline
  → skip to Phase 2, same as a brand-new blog (no `blog-ops/reference/` is
  created, and `{profile_dir}/site-conventions.md` stays unwritten — per
  config-schema.md it's recommended, not required, for a non-WordPress
  adapter or a blog that declined this offer). Before moving on, firm up
  Phase 1 Q12's provisional `blog.trailing_slash` now — ask the user
  directly (research detection will never run for this blog); update
  `config.yaml` with the confirmed value.

**Resume check:** `blog-ops/reference/site-research.md`. If it exists,
summarize what's on file (URLs fetched, images sampled, whether the
adapter site-inspection sub-step below already completed) and apply Global
rule 3 (keep as-is / update — re-fetch everything, useful after a redesign —
/ start over).

### (a) Discover and fetch

Ask for the blog's homepage URL if it differs from `<answer 2>`. Discover
5-10 recent post URLs by trying, in order, until one yields results (don't
require all three): the site's feed (`<url>/feed/`, `<url>/rss.xml`,
`<url>/atom.xml`), its sitemap (`<url>/sitemap.xml` or
`<url>/sitemap_index.xml`), or, if it looks like WordPress, its REST API
(`<url>/wp-json/wp/v2/posts?per_page=10`, no auth needed for published
posts). `WebFetch` the homepage, the About page (if discoverable from the
homepage's nav or at `/about`), and the discovered post URLs. Log every
fetched URL plus a 1-2 sentence takeaway into
`blog-ops/reference/site-research.md` as you go (Global rule 2: write
immediately, don't batch until the end of the phase).

**Also detect `trailing_slash` from these same URLs.** Look at whichever of
the discovered post URLs are real permalinks (not feed/sitemap/REST API
endpoints) and note whether they end in `/` (e.g. `/blog/my-post/`) or not
(`/blog/my-post`). This is real evidence Phase 1's Q12 couldn't have had —
fold it into the SAME single pre-fill confirmation as (b)-(d)'s evidence in
(f) below, never a separate ask. Phase 5's adapter site inspection later
cross-checks this against the live site's actual permalink format and flags
any disagreement.

### (b) Palette and typography from page source

From the homepage's source, look for CSS custom properties (`--color-*`,
`--font-*`, etc.) in inline `<style>` blocks or linked stylesheets, and note
the declared font-family stack(s). Record extracted hex values and font
stacks into `site-research.md` — this is what pre-fills Phase 4's palette
question below.

### (c) Screenshots from the Pilcrino browser

Screenshots use the Pilcrino browser: `tabs open <live post URL>`, `wait`
2000, `screenshot` with `mode: full` to `{profile_dir}/_setup-shots/<n>.png`,
`Read` the PNG, `tabs close`. Delete `{profile_dir}/_setup-shots/` when
Phase 1.5 ends. If `tabs open` fails (Chrome not found), write the note
'Pilcrino browser could not start, no screenshots' to `site-research.md`
and continue.

Resolve the repo root once with Bash (`git rev-parse --show-toplevel`) and
reuse it: `screenshot`'s `outFile` must be an absolute path. Take the
homepage and one representative post (`<n>` = `1`, `2`):

```
mcp__plugin_pilcrino_pilcrino-browser__tabs        { "action": "open", "url": "<homepage or post URL>" }   -> tabId
mcp__plugin_pilcrino_pilcrino-browser__wait        { "tabId": <tabId>, "ms": 2000 }
mcp__plugin_pilcrino_pilcrino-browser__screenshot  { "tabId": <tabId>, "outFile": "<repo root>/{profile_dir}/_setup-shots/<n>.png", "mode": "full" }
Read                               each path in the returned `paths`
mcp__plugin_pilcrino_pilcrino-browser__tabs        { "action": "close", "tabId": <tabId> }
```

The PNGs are for visual reference only and do not outlive this phase, so
record what they show (layout, hero treatment, image style) in
`site-research.md`; Phase 4 reads those notes, not the files.

### (d) Image sampling

From the fetched pages, download 5-10 images — prioritize each recent
post's featured/hero image, plus a few in-post images — into
`blog-ops/reference/image-samples/`. Characterize the SET as a whole (not
image-by-image) in `site-research.md`: photography vs. illustration vs.
diagram, overall tone (bright/muted/technical/playful), whether images
typically carry text overlays. This characterization is the evidence Phase
4 cites when drafting `image-style.md`'s mood-word answer.

### (e) Adapter site inspection — deferred

The active publish adapter's `## Site inspection (setup-time)` procedure
(`${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` or
`astro-git-pr.md`) is what actually writes `{profile_dir}/site-conventions.md`
— but it needs the publish adapter CHOSEN, and for `wordpress-rest`
specifically, its application-password credential already VERIFIED, and
neither exists yet at this point in the wizard (Phase 5 is where both
happen). **Do not attempt this sub-step here.** Note in `site-research.md`:
"Site-conventions inspection deferred to immediately after Phase 5's
adapter setup." Phase 5 carries this forward explicitly — see that phase's
own "Site conventions" section, which runs the deferred procedure the
moment the adapter is known (and, for WordPress, the moment its one-shot
auth probe succeeds) and writes/confirms `site-conventions.md` at that
point instead.

### (f) Pre-fill downstream phases

Using ONLY (a)-(d)'s evidence (never (e), which hasn't run yet):

- **Audience (Phase 1, already written above).** Draft a proposed addition
  to `audience.md` from the About/homepage copy and the fetched posts'
  framing (language patterns, implied pain points) and present it as a
  diff: "Based on the site research, here's what I'd add to your
  audience.md: `<draft>`. Keep, edit, or skip?" Only write if confirmed —
  never silently overwrite the answers already on file from Phase 1's own
  interview.
- **`trailing_slash` (Phase 1, `blog:` block, already written above).**
  (a)'s URL-based detection is the real evidence Q12's gate (§Phase 1) may
  have deferred. Present the detected value alongside (b)-(d)'s evidence in
  this SAME confirmation pass: "Based on the fetched post URLs, this blog's
  posts <do/don't> end in a trailing slash — update `blog.trailing_slash`
  to match?" Confirmed → re-merge and rewrite `config.yaml`'s `blog:` block
  (Global rule 4) with the real value. Never a separate ask from the rest
  of this pre-fill batch.
- **Voice (Phase 2, next).** The posts fetched in (a) count as the
  "existing posts" Phase 2's writing-sample path asks the user to supply.
  When Phase 2 runs, it checks for `site-research.md` first and, if
  present, uses those already-fetched posts as its samples instead of
  asking the user for paths/URLs again (see that phase's own note).
  Extends, never replaces, the existing writing-sample synthesis and
  confirmation step.
- **Image style (Phase 4, later).** The palette hexes from (b) and the
  characterization from (d) become the DEFAULTS Phase 4 offers for its
  palette and mood-word questions, instead of the scaffold's generic
  defaults — the user still confirms or overrides every value (see that
  phase's own note).

Every pre-filled doc or diff produced here is presented for explicit
confirmation, exactly like every other phase in this wizard (Global rule
3) — this phase introduces no silent-accept exception.

**Artifacts:** `blog-ops/reference/site-research.md` (evidence log, cites
every fetched URL) and `blog-ops/reference/image-samples/` (downloaded
images). The (c) screenshots are deleted when this phase ends.
`{profile_dir}/site-conventions.md` is NOT written by this phase — see (e)
above; it's written later, by Phase 5.

## Phase 2: Voice & authors

**Goal:** capture this blog's personality and who writes it. Writes
`{profile_dir}/voice.md` and `{profile_dir}/authors.md`.

**Resume check:** `{profile_dir}/voice.md` and `{profile_dir}/authors.md`.

### Writing-sample path (offer first)

**Check for Phase 1.5 evidence first.** If `blog-ops/reference/site-research.md`
exists, the posts it fetched already ARE the 2-3+ existing-post samples this
path needs — use those directly (re-read them from the URLs cited in
`site-research.md`, or re-`WebFetch` if the content wasn't retained) instead
of asking the question below. Otherwise, ask it fresh:

Before interviewing from scratch, ask: "Do you have 2-3 existing posts I
can read to learn your voice from evidence? (local file paths, or URLs I
can fetch)"

- **Local paths** → `Read` each file.
- **URLs** → `WebFetch` each one.
- If the user has none, or fewer than 2 usable samples, skip straight to
  the direct interview below.

For each sample, note (with a short quoted excerpt as evidence for each):
sentence-length pattern (short-vs-long mix), first-person usage, how
personal anecdotes get woven in, formality level, recurring phrases or
openers, humor, how technical the vocabulary runs, paragraph length.

Synthesize these into a **draft** `voice.md` (structure below) and present
it to the user: "Here's the voice profile I derived from your samples,
with the evidence for each trait. Confirm, edit, or tell me what's off."
Iterate until confirmed, then still ask the direct-interview questions
below for anything the samples didn't reveal (credibility message,
anecdote bank, additional forbidden phrases, additional allowlist domains
— these are rarely visible from 2-3 posts alone).

### Interview: voice

Ask one at a time (skip any already answered by the writing-sample pass):

1. Tone in 3-5 adjectives (e.g. "direct, funny, no-nonsense")
2. Credibility message: the one-line authority statement that opens every
   post's expertise-statement sentence (e.g. "After testing 50 pairs of
   trail shoes over 200 miles, here's what held up.")
3. Lexicon: words or phrases this blog uses often, signature phrasing
4. Personal-anecdote bank: 3-5 short personal stories or experiences an
   author can draw on across posts
5. Positioning: what value proposition should posts lead with, and in
   what priority order (most relevant if `modules.product` will be on,
   but useful for any blog with an opinion to push)
6. Additional forbidden phrases: any phrases, beyond the generic AI-tell
   list in `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`, this
   blog specifically wants banned
7. Additional allowlist domains: any extra reputable domains (beyond
   `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Authoritative-site
   allowlist) this blog wants permitted to cite even when they show up in
   the target keyword's top-10 SERP

Write `{profile_dir}/voice.md` — the section names below are exact; other
components grep for them by these literal headings:

```markdown
# Voice

## Tone

<answer 1>

## Credibility message

<answer 2>

## Lexicon

- <word/phrase 1>
- ...

## Personal-anecdote bank

- <anecdote 1>
- <anecdote 2>
- ...

## Positioning

<answer 5>

## Additional forbidden phrases

- <phrase 1>
- <phrase 2>
(or: "None beyond the generic list in writing-standards.md.")

## Additional allowlist domains

- <domain 1>
- <domain 2>
(or: "None beyond the generic allowlist in blog-craft.md.")
```

The two "Additional ..." headings must read EXACTLY `## Additional
forbidden phrases` and `## Additional allowlist domains` — the
`review-blog-post`, `humanize-text`, and `repurpose-blog-post` skills grep
for these literal section names.

### Interview: authors

1. How many authors/voices write for this blog? (1 = single voice; more
   than 1 = multiple named voices, plus optionally a co-signed "we" voice)
2. For each author: name, a short slug (lowercase, e.g. `alex`), a 1-2
   sentence bio, area of expertise, voice notes (how this author's tone
   differs from the blog's general voice — sentence-length habits,
   reading-level default, any jargon they're allowed to keep), byline
   format, sign-off pattern (for co-signed content)
3. If more than 1 author: ask when to use "we" (co-signed) vs. a specific
   author's voice — write this into a Selection rubric.

Write `{profile_dir}/authors.md`:

```markdown
# Authors

## <slug 1> — <Display Name>

**Bio:** <bio>
**Expertise:** <expertise>
**Voice notes:** <tone, sentence-length defaults, reading level, jargon rules>
**Byline:** <how this author's name appears in frontmatter/body>
**Sign-off:** <sign-off pattern, or "none — byline only" for single-voice posts>

## <slug 2> — <Display Name>

...
```

If more than one author, additionally append:

```markdown
## Co-signed voice (we)

<how the "we" voice differs from any single author's solo voice — typically
less personal, more newsroom-tone> Sign-off: <co-signed sign-off pattern,
e.g. "<Author 1> and <Author 2>, Co-founders of <blog name>">

## Selection rubric

<heuristics for choosing author_voice per post, e.g.:>

| Post shape | author_voice |
|---|---|
| Technical deep-dive | <slug> |
| Beginner-friendly how-to | <slug> |
| Product-wide announcement | we |

## Slug-to-site-key map

| author_voice slug | Site display key |
|---|---|
| <slug 1> | <Display Name> |
| <slug 2> | <Display Name> |
```

The `## Selection rubric` heading is exact — it's what the editor persona
and `templates/brief.md` point to as "select per `{profile_dir}/authors.md`
§Selection rubric." Only write it (and Co-signed voice, and the
slug-to-site-key map) when there's more than one author; a single-author
blog's `authors.md` is just the one `## <slug> — <Display Name>` block, no
rubric needed (matches personas/editor.md: "single-author blogs: skip this
step, `author_voice` is fixed").

## Phase 3: Modules

**Goal:** decide which optional pipeline modules are on, write the
`modules:` block in `config.yaml`, and (module-gated)
`{profile_dir}/product.md` and `{competitors_dir}/methodology.md`.

**Resume check:** read `modules:` from `config.yaml` if present, plus
`competitors.profile_dir` (if set, resolve `{competitors_dir}` from it
instead of the default) and `{profile_dir}/product.md` /
`{competitors_dir}/methodology.md` existence.

**Downgrade case.** If a resumed run flips `modules.product` or
`modules.competitors` from `true` to `false`, leave the corresponding doc
(`product.md` / `{competitors_dir}`) on disk — invariant 5 only requires the
doc to exist when the module is ON, it doesn't require the doc's absence
when the module is off, and nothing reads a module-gated doc while its
module is off. Tell the user it's still there in case they flip the
module back on later, and offer to delete it if they'd rather clean up;
only delete on an explicit yes.

### Interview: modules

Ask one at a time, in plain language (no internal jargon — a blog owner
shouldn't need this doc open to answer):

1. "Should this blog's research stage search Reddit for the target
   keyword?" (`modules.reddit_research`)
2. "Should this blog's research stage also search X (Twitter)?"
   (`modules.x_research`)
3. "Does this blog promote its own product?" (`modules.product`). If yes,
   run the product interview below.
4. "Will posts reference or compare named competitors?"
   (`modules.competitors`). If yes, ask (4a) and seed the competitor
   methodology below.
4a. If (4) is yes: "Where should competitor profiles live: the default
    location inside this blog's own workspace (`blog-ops/profile/competitors`),
    or an existing directory this blog already shares with other
    tooling?" Default → write nothing (`competitors.profile_dir` stays
    unset, `{competitors_dir}` resolves to the default). Existing
    directory → ask for its repo-relative path and write
    `competitors.profile_dir: <path>` to `config.yaml`.
5. "Enable the repurpose skill (turns a published post into an X thread,
   an X short take, a LinkedIn post, and a newsletter)?"
   (`modules.repurpose`)

Merge into `config.yaml`:

```yaml
modules:
  reddit_research: <bool>
  x_research: <bool>
  product: <bool>
  competitors: <bool>
  repurpose: <bool>

competitors:
  profile_dir: <answer 4a>   # OPTIONAL; write this block only when
                             #   answer 4a is a non-default path; omit
                             #   the whole `competitors:` block otherwise
```

### If `modules.product` is on: product interview

1. Product name
2. What the product does, in 1-3 sentences
3. Core features: a list, each with a 1-line description (this becomes
   the feature list `templates/plan.md` draws its "feature emphasis" label
   from)
4. Differentiators: what's genuinely unique vs. alternatives
5. Unique-in-category differentiators specifically worth surfacing in a
   transactional comparison post (optional — skip if none stand out;
   when present, the editor persona checks every comparison-post outline
   surfaces these)
6. First-party data availability: what can this product's own usage data
   support citing in a post? For each claim, classify its availability:
   `derivable` (data is ready to cite now), `needs_scan` (the data exists
   but needs a query/audit before it's citable), or `hypothetical` (not
   yet verified — brainstorming only, writers must never cite this in a
   published post)
7. Positioning recommendations: where in a post the product should appear,
   and in what order relative to educational content
8. Existing posts: title + URL + which feature each covers (skip / write
   "none yet" for a blog with no posts yet)
9. Pricing page URL (posts never state specific prices; they link here
   instead, per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Own-product
   pricing claims)

Write `{profile_dir}/product.md`:

```markdown
# Product

## Identity

<answer 1> — <answer 2>

## Features

- **<feature>:** <description>
- ...

## Differentiators

- <differentiator 1>
- ...

## Unique-in-category differentiators (for use in transactional comparison posts)

- <differentiator 1>
(omit this whole section if answer 5 was empty)

## First-party data availability

| Claim | Availability | Context |
|---|---|---|
| <claim> | derivable \| needs_scan \| hypothetical | <one sentence> |

## Positioning recommendations

<answer 7>

## Existing posts

| Title | URL | Feature covered |
|---|---|---|
| <title> | <url> | <feature> |
(or: "None yet — this is a new blog.")

## Pricing page

<answer 9>
```

### If `modules.competitors` is on: seed methodology.md

Explain to the user, in plain language, before writing anything: "This
blog will keep a synthesized profile per competitor at
`{competitors_dir}/<slug>.md`. Every post that names a competitor
must point at a profile that's no more than 14 days old — the workflow
hard-halts otherwise. I'm going to write the methodology doc that defines
the profile shape and this freshness rule; you (or a research skill) add
actual competitor profiles later, whenever you want to name one in a
post."

No interview needed — this doc is a fixed contract, not per-blog content.
If `{competitors_dir}/methodology.md` already exists (the external-dir case
from question 4a, an existing corpus shared with non-blog tooling), leave
it as-is and skip writing it — apply Global rule 3 (keep as-is / update /
start over) instead of silently overwriting a corpus this blog doesn't own
alone. Otherwise, create the directory and write
`{competitors_dir}/methodology.md`:

```markdown
# Competitor profile methodology

Every competitor this blog mentions by name needs a synthesized profile at
`{competitors_dir}/<slug>.md`. `blog-post-workflow` validates a
named competitor has a matching profile at intake (Stage 0) and re-checks
its freshness defensively at Stage 1.5c before research analysis runs.

## The 14-day freshness contract

Every profile carries a `**Last verified:**` date. A profile older than 14
days is stale: the workflow hard-halts and asks a human to refresh it
before the post can proceed. To refresh a profile, re-visit the
competitor's own pricing/features pages, update every section below with
current information, and set `**Last verified:**` to today's date.

## Profile shape

Create each profile at `{competitors_dir}/<slug>.md` following this
exact shape (the H1, `**Slug:**` line, and `**Last verified:**` line are
load-bearing — the workflow matches a named competitor against the H1 or
the slug line, and reads the verified date, from just the first ~10 lines). The Site line is what the console's Refresh reads.

```markdown
# <Competitor Name>

**Slug:** <slug>
**Site:** <https://competitor.example/>
**Last verified:** <YYYY-MM-DD>

## TL;DR

<one-paragraph summary: what this competitor is, who it's for>

## Audience/positioning

<who this competitor targets, how they position themselves>

## Pricing

| Tier name | Monthly price | Annual price | Limits / quotas | Key features bundled |
|---|---|---|---|---|
| <tier> | <$X/mo> | <$Y/yr> | <limits> | <features> |

**Free tier?** <yes/no, terms>
**Trial?** <yes/no, length>

## Features

### Core

- <feature 1>

### Differentiators they actively market

- <differentiator 1, in the competitor's own framing/wording>

### Notable absences

- <something they don't offer that's worth knowing>

## Integrations and platforms

- <integration 1>

## Self-reported metrics

- <metric, with source>

## Recent product direction signals

- <signal, e.g. a changelog entry, a roadmap post>

## Headline value prop

"<verbatim quote from their marketing copy>"
```

If `modules.product` is also on, append an "Overlap with our product"
section per profile, capability-by-capability, facts only, no editorializing
("better"/"worse").
```

Note that the template block above is embedded verbatim inside
`methodology.md` (per `personas/editor.md`'s pointer: "Add a profile per
`{competitors_dir}/methodology.md` (template at the bottom of that
file)") — write it as shown, a nested fenced block is fine in the final
file. **This is the one sanctioned exception to Global rule 6** ("no
leftover `<...>` placeholders"): the angle-bracket tokens inside this
nested block are a template FOR future profiles, not unfilled content of
`methodology.md` itself. Phase 6's "no leftover placeholders" check
excludes this nested block explicitly (see that section).

## Phase 3.5: Sign in to the Pilcrino browser

Pilcrino researches in its own Chrome window, the Pilcrino browser. Google and Reddit block a browser that has never signed in, so this one-time step opens the window and checks each site when you say you are done.

Resumable: on re-run, call `login_status` first; if every needed site is `signed_in`, say so and offer to skip.

1. Sites needed: `google` always; `reddit` when `modules.reddit_research`; `x` when `modules.x_research`; `linkedin` when `social.linkedin` is configured.
2. Call `mcp__plugin_pilcrino_pilcrino-browser__open_login` with those sites. It quits the Pilcrino browser and opens the sign-in pages in a Chrome window on the Pilcrino profile without remote control (Google refuses to sign in a browser under remote control). Tell the owner: "A Chrome window on the Pilcrino profile is open with one tab per site. Sign in to each, then quit that Chrome with Cmd+Q (closing the window is not enough) and tell me when you are done." Then wait for the owner's reply. Do not poll and do not sleep.
3. When the owner says done, call `mcp__plugin_pilcrino_pilcrino-browser__login_status` once with the same sites and report each site's state in one line per site. It restarts the Pilcrino browser with remote control. If it fails with `signin_window_open`, the sign-in window is still running: say "The Pilcrino sign-in window is still open. Quit it with Cmd+Q and tell me when you have." and check again on the reply.
4. A site still `signed_out`: ask "Sign in to <site> and tell me when you are done, or skip <site> for now?" On "done", check once more (step 3); repeat only when the owner asks. Skipping is allowed; research for that source parks later with a card until the owner signs in.
5. `blocked`: "<site> is showing a challenge in the Pilcrino window. Pass it and tell me when you are done." `error`: "The Pilcrino browser could not reach <site>. Check the connection and tell me when to check again." Offer a check again or a skip.
6. Record the outcome in `blog-ops/profile/setup-notes.md` as "Pilcrino browser: signed in to <sites> on <date>".

```
mcp__plugin_pilcrino_pilcrino-browser__open_login    { "sites": ["google", "reddit"] }
mcp__plugin_pilcrino_pilcrino-browser__login_status  { "sites": ["google", "reddit"] }   -> { "google": "signed_in", "reddit": "signed_out" }
```

## Phase 4: Images

**Goal:** decide which image strategies this blog uses, write the
`images:` block in `config.yaml` and `{profile_dir}/image-style.md`, and
(if `remotion` is enabled) scaffold + personalize the Remotion project.

**Resume check:** `images:` in `config.yaml`, `{profile_dir}/image-style.md`,
and (if remotion was previously enabled) `images.remotion.project_dir`.

### Interview: images: block

1. "Which image strategies should this blog use? Any subset of `remotion`
   (React-rendered diagrams/hero images, needs Node), `ai-prompt`
   (automated AI image generation via codex's built-in gpt-image — needs
   the `codex` CLI logged in, no API key), `screenshot` (manual UI/page
   captures)." → `images.enabled`, must be non-empty (invariant 1).
2. "Which of those should be the default for a post's featured image?" —
   if only one strategy was enabled, skip this question and set
   `images.featured_default` to it. If more than one, offer "let the
   planner pick per-post" as a valid answer (in which case OMIT
   `images.featured_default` from config entirely, per config-schema.md's
   comment: "Omitted → planner picks from enabled").
   **Validate immediately** (Global rule, enforced at entry): if the
   user's answer is not a member of `images.enabled` from question 1,
   reject it and re-ask; don't defer this check to Phase 6.
3. If `remotion` ∈ enabled: "Where should the Remotion project live in
   this repo?" (default `tools/remotion`) → `images.remotion.project_dir`.

Merge into `config.yaml`:

```yaml
images:
  enabled: [<list>]
  featured_default: <value>   # omit key entirely if the planner should pick
  remotion:                    # omit whole block if remotion not enabled
    project_dir: <path>
```

### Interview: image-style.md

**Check for Phase 1.5 evidence first.** If `blog-ops/reference/site-research.md`
exists, use its extracted palette hexes (§(b)) and image characterization
(§(d)) as the DEFAULTS offered below instead of the scaffold's generic
defaults — still ask every question, still let the user override any
subset; the evidence just changes the starting point, it never gets
silently accepted.

1. Palette: 8 hex colors — `background`, `surface`, `border`, `text`,
   `muted`, `primary`, `accent`, `warn`. Offer the scaffold's defaults
   (`#FAFAFA`, `#FFFFFF`, `#E5E7EB`, `#1F2937`, `#6B7280`, `#2563EB`,
   `#0E9F8E`, `#E11D48`) as the starting point — or, if Phase 1.5 extracted
   hexes from the live site's CSS, offer those instead; let the user
   override any subset either way.
2. Fonts: sans-serif stack and monospace stack. Defaults:
   `Inter, ui-sans-serif, sans-serif` and `ui-monospace, monospace`.
3. Mood words: 3-5 adjectives describing the visual mood (e.g. "clean,
   confident, technical") — pre-fill from Phase 1.5's image-set
   characterization if it ran.
4. Watermark text (default: the blog's domain, e.g. `trailnotes.example`)
   and opacity (default `0.55`)
5. Annotation conventions for screenshot markup: accent color (default:
   reuse the `accent` palette token), stroke width (default `3px`),
   corner radius (default `6px`)
6. Aspect-ratio default for `ai-prompt` images (default `3:2`,
   matching the Remotion canvas so a mixed featured/in-post set stays
   visually consistent)
7. Featured-image variation archetypes: offer the default list below
   (mirrors the built-in list in
   `${CLAUDE_PLUGIN_ROOT}/skills/suggest-images/SKILL.md` §Featured-slot
   archetype) and let the user drop, rename, or add archetypes. Explain the
   mechanism in one line: the image-planner rotates these across posts
   (never repeating the archetype of the previous 2 posts, tracked in
   `{ops_dir}/featured-log/`, one entry file per post) so covers stay on-brand but don't all look
   the same. Defaults: `object-metaphor`, `split-contrast`, `diagram-lite`,
   `big-number`, `pattern-break`, `scene-vignette`, `negative-space`. Keep
   at least 4 (fewer starves the rotation).

Write `{profile_dir}/image-style.md`:

```markdown
# Image style

## Palette

| Token | Hex |
|---|---|
| background | <hex> |
| surface | <hex> |
| border | <hex> |
| text | <hex> |
| muted | <hex> |
| primary | <hex> |
| accent | <hex> |
| warn | <hex> |

## Fonts

**Sans:** <font stack>
**Mono:** <font stack>

## Mood

<mood words>

## Watermark

**Text:** <watermark text>
**Opacity:** <opacity>

## Annotation conventions

**Accent color:** <hex, or "palette.accent">
**Stroke width:** <e.g. 3px>
**Corner radius:** <e.g. 6px>

## Aspect ratio defaults

<e.g. "3:2 for featured and most in-post images; adjust per-slot when a chart genuinely needs a different ratio.">

## Featured-image variation

Composition archetypes for featured images. The image-planner rotates these
across posts (never repeating the archetype used in the previous 2 posts,
tracked in `{ops_dir}/featured-log/`). Palette, fonts, watermark, and the
title band never vary; only the composition does.

- <archetype-slug>: <one-line description>
- <archetype-slug>: <one-line description>
<...one line per archetype the user kept in the interview...>
```

### If `remotion` is enabled: scaffold + personalize + test-render

1. Resolve `REMOTION_DIR` = `images.remotion.project_dir` from the answer
   above.
2. If `REMOTION_DIR` already has a `package.json` (resume case): summarize
   what's there, ask keep/reinstall per Global rule 3. Otherwise:
   ```bash
   mkdir -p "$(dirname "<REMOTION_DIR>")"
   cp -R "${CLAUDE_PLUGIN_ROOT}/scaffold/remotion-starter/" "<REMOTION_DIR>"
   ```
3. **Rewrite ONLY `<REMOTION_DIR>/src/theme.ts`** from the `image-style.md`
   values gathered above. Keep `CANVAS`, `TITLE_TOP`, and `SAFE_MARGIN`
   exactly as the scaffold defines them (`{ width: 1800, height: 1200 }`,
   `110`, `120`) — those are canvas/layout constants, not personalization
   inputs, and this wizard never touches them. Rewrite `palette`, `fonts`,
   and `watermark` to the interview answers:
   ```ts
   export const palette = {
     background: "<hex>", surface: "<hex>", border: "<hex>",
     text: "<hex>", muted: "<hex>",
     primary: "<hex>", accent: "<hex>", warn: "<hex>",
   };
   export const fonts = { sans: "<stack>", mono: "<stack>" };
   export const watermark = { text: "<text>", opacity: <opacity> };
   ```
   Never touch any other file in the project (`Root.tsx`, `BlogWatermark.tsx`,
   `SampleDiagram.tsx`, `package.json`, etc.) — the theme-token indirection
   is exactly what lets this rewrite be safe.
4. **Union-merge the composition registry.** `<REMOTION_DIR>/src/Root.tsx` is
   append-only: every post registers one uniquely-named composition in it, so
   two concurrent post branches only ever both add distinct lines. Without a
   `merge=union` attribute git calls that a conflict, and the console's
   auto-resolver (`console/src/merge-resolve.ts` `resolveConflictOnBranch`)
   CANNOT settle it: that function activates the driver by copying the BASE
   branch's `.gitattributes`, so a repo without one has no driver, and every
   such PR parks for a human. Ensure the repo-root `.gitattributes` carries the
   line, creating the file when absent and appending when it exists (never
   rewriting rules already there):
   ```bash
   ATTR="<REMOTION_DIR>/src/Root.tsx merge=union"
   grep -qxF "$ATTR" .gitattributes 2>/dev/null || printf '%s\n' "$ATTR" >> .gitattributes
   ```
   `<REMOTION_DIR>` here is the path RELATIVE to the repo root, matching how
   `.gitattributes` patterns are resolved. Commit the file with the rest of the
   scaffold.

   **Scope it to generated registries only.** Never add a prose path (anything
   under `{content_dir}`) to this file: union-merging two edits to the same
   paragraph keeps both sides and silently publishes a mangled sentence.
5. `npm install`, from inside `REMOTION_DIR`.
6. Test-render the sample composition:
   ```bash
   cd "<REMOTION_DIR>" && npx remotion still SampleDiagram --output=out/preview-sample-v1.png
   ```
7. `Read` the rendered PNG and show it to the user: "Here's a test render
   with your palette/fonts/watermark applied. Look right?" If not, go
   back to the image-style.md interview, adjust, rewrite `theme.ts`, and
   re-render.

### If `ai-prompt` is enabled: check codex + offer a test generation

1. Check the codex CLI is available: `command -v codex && echo found || echo missing`.
2. If missing: tell the user `ai-prompt` slots need the `codex` CLI on PATH
   with a working codex/ChatGPT login, and that this is fine to fix later —
   a missing codex degrades cleanly at run time (the slot is recorded
   `failed` and its `Prompt:` block stays a pasteable manual fallback; it
   never breaks the pipeline). Warn, don't block the wizard, and don't add
   a config invariant for it.
3. If found: offer "Want me to fire one test generation to confirm codex
   imagegen works?" If yes, run `${CLAUDE_PLUGIN_ROOT}/skills/generate-image-codex/SKILL.md`
   with a minimal throwaway prompt (e.g. "a simple flat-vector test image,
   a single blue circle on a white background, no text") and an explicit
   output path (its optional caller input) under a temp dir
   (`$(mktemp -d)/codex-test.png`) — the explicit path bypasses all
   `{assets_dir}` resolution, so no blog asset folder is touched. `Read`
   the result and show it, then remove the temp dir.

## Phase 5: Publishing

**Goal:** pick and configure the publish adapter, write the `publish:` and
`git:` blocks, verify adapter auth, and check the GitHub precondition.

**Resume check:** `publish:` and `git:` in `config.yaml`. If present, apply
Global rule 3 — but the "short summary" that rule calls for must surface
two things a bare "`publish:`/`git:` present" check would hide, so "keep
as-is" is an informed choice rather than a guess:

- **The last WP auth probe's outcome, if one was recorded.** The auth-probe
  step below leaves a crash-note in `blog-ops/reference/site-research.md`
  precisely so a later resumed run can report this (see that step's own
  note, a few paragraphs down). No recorded outcome (non-`wordpress-rest`
  adapter, or no probe has run yet this workspace) → omit this line.
- **Whether `{profile_dir}/site-conventions.md` exists, when it's
  REQUIRED.** Per config-schema.md, that file is required when
  `publish.adapter: wordpress-rest` AND `{profile_dir}/blog.md` records
  `existing_blog: true` (the durable flag Phase 1.5's Offer step wrote —
  read THAT, not whether `blog-ops/reference/site-research.md` exists: an
  existing blog that declined Phase 1.5's research offer has
  `existing_blog: true` with no `site-research.md` ever written, and still
  owes this file); recommended otherwise. Check both conditions and report
  a mismatch explicitly rather than staying silent.

Phrase it like: "publish config exists (auth probe: FAILED on last run;
site-conventions.md: MISSING — required for this adapter): keep as-is /
update / start over."

**Even on "keep as-is":** Global rule 3's "keep as-is → skip straight to the
next phase, no writes" applies only to the interview questions above — it
never skips a pending REQUIRED sub-flow. If `{profile_dir}/site-conventions.md`
is missing and required per the check above, the auth probe (if it hasn't
yet recorded `auth OK`) and the "Site conventions" sub-flow below still run
this pass, even when the user picks "keep as-is" for the `publish:`/`git:`
interview itself. Only once `site-conventions.md` exists (or the check
above finds it genuinely isn't required) does "keep as-is" mean "nothing
left to do in Phase 5."

### Interview: adapter choice

1. "Which publish adapter? `astro-git-pr` (an Astro site, posts land as
   markdown in the site repo via a PR), `wordpress-rest` (posts publish
   to a WordPress site via its REST API, with the markdown still living in
   this repo as the source of truth), or `markdown` (a markdown file per
   post for any platform: Hugo, Jekyll, Ghost, Next.js, Eleventy, or
   anything else that takes one)." → `publish.adapter`.

### If `astro-git-pr`

2. "Is this repo the Astro site itself, or does the site live in a
   subdirectory (a monorepo)?" Repo root, omit `publish.astro.site_dir`.
   Subdirectory, ask for its repo-relative path (the directory holding
   `package.json` and `astro.config.mjs`) and write it to
   `publish.astro.site_dir`. Every other path key stays repo-relative.
2a. **Page style and trailing slash (read, don't ask).** Read the Astro
   config in `<site_dir>` (default the repo root): `astro.config.mjs`,
   `.ts` or `.cjs`. Find `build.format` and `trailingSlash`, and state what
   you found in one line. Astro builds each page either as a folder
   (`<route>/index.html`, the default `build.format: 'directory'`) or as a
   single file (`<route>.html`, `build.format: 'file'`). The console's
   verification handles both, so nothing is written for the style itself.
   It decides `blog.trailing_slash`:
   - `trailingSlash: 'never'`, or `build.format: 'file'` with
     `trailingSlash` unset → `false`
   - `trailingSlash: 'always'`, or `build.format` unset or `'directory'`
     with `trailingSlash` unset → `true` (hosts serve a folder-style page
     at its slashed URL)
   - `trailingSlash: 'ignore'` → the config does not settle it; keep the
     value on file.
   If the derived value differs from `blog.trailing_slash` in
   `config.yaml`, show both values and the Astro config line, and write the
   derived one once the user confirms (rewrite the whole file, Global rule
   4). If they already agree, record nothing new and move on.
3. `content_dir` (default `src/content/blog`)
4. `assets_dir` (default `src/assets/blog`)
5. Frontmatter template: "Does this site use Starlight, or plain Astro
   content collections?" Starlight →
   `adapters/publish/frontmatter/astro-starlight.md` (supports a `head[]`
   JSON-LD FAQ schema injection). Plain content collections →
   `adapters/publish/frontmatter/astro-content.md` (the FAQ schema is the
   site layout's job instead, this template leaves a marker comment for
   it). → `publish.astro.frontmatter_template`.
6. `draft_mechanism` (default `"draft: true"`, the literal frontmatter
   line marking a post excluded from production builds)
7. "Does this site have an authors-map file (e.g. `astro.config.mjs`) that
   maps author keys to display info?" If yes, ask its repo-relative path
   → `publish.astro.authors_map_check`. If no, omit the key.
8. "Does your CI post a PR comment with a staging-preview URL? If so,
   what's the HTML comment marker it upserts?" (e.g.
   `<!-- blog-preview -->`) If none, omit
   `publish.astro.preview_comment_marker`.

Verify the directories exist on disk:
```bash
[ -d "<content_dir>" ] && [ -d "<assets_dir>" ] && echo "both exist" || echo "missing"
```
- If missing and this doesn't otherwise look like an Astro project
  (no `astro.config.mjs` / no `package.json` with an `astro` dependency in
  `<site_dir>`, defaulting to the repo root), tell the user this needs an
  Astro site scaffolded first (e.g. `npm create astro@latest`), and pause
  Phase 5 until they confirm it's ready; don't fabricate directories into a
  non-Astro repo.
- If missing but this IS an Astro project (just these specific
  directories aren't created yet), offer to `mkdir -p` them.

### If `wordpress-rest`

2. `content_dir` — where the canonical finalized markdown lives in THIS
   repo (WordPress is not the source of truth) (default `content/blog`)
3. `assets_dir` — local store for generated images pre-upload. **Default
   `blog-ops/assets`** (per the brief; distinct from the Astro default,
   since a WordPress blog's repo has no existing site-asset convention to
   match).
4. `frontmatter_template` — state, don't ask: fixed at
   `adapters/publish/frontmatter/wordpress.md` for this adapter (unlike
   Astro, there's no Starlight-vs-content-collections choice to interview
   for).
5. `base_url` (e.g. `https://yourblog.com`)
6. `username` (the WordPress username the application password belongs to)
7. "What environment variable holds the WordPress application password?"
   (name only) → `app_password_env`
8. `default_status` — state, don't ask: this is always `draft` in v1; the
   adapter never publishes past draft, the human clicks Publish in WP
   admin.
9. `apply_inbound_links_live` — state, don't ask: always written as
   `false`. Safety note to relay verbatim: "live-edits published posts at
   finalize when true; leave false unless you want that."

**Env var placement (check BEFORE probing).** The app-password env var named
above must be exported from `~/.zshrc` or `~/.profile` (whichever file the
user's login shell actually loads) — NOT merely typed into a separate
interactive terminal. Claude Code's Bash tool starts a fresh non-interactive
shell per command; it does not inherit exports made by hand in an
interactive session that isn't one of those two files. Ask the user to
confirm the export lives in one of those files before running the probe
below — this is the single most common cause of a probe that fails despite
"correct" credentials.

Run the auth probe from
`${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` §Staging step 2,
**AT MOST ONCE this run — never retried, never polled** (the same rule that
section states for the real workflow's staging probe applies here
identically):
```bash
WP_USER="<username>"
WP_APP_PASSWORD_ENV="<app_password_env>"
WP_BASE="<base_url>"
curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" "$WP_BASE/wp-json/wp/v2/users/me" >/dev/null \
  && echo "auth OK" || echo "auth FAILED"
```
**Crash-note (both outcomes, when `blog-ops/reference/site-research.md`
exists):** append a line to that file recording today's outcome — e.g.
"WordPress auth probe: OK on `<today's date>`." or "WordPress auth probe:
FAILED on `<today's date>`; site-conventions.md not written this run."
This is what the Resume check above reads back on a later run so "keep
as-is" is an informed choice instead of a guess. No `site-research.md`
(Phase 1.5 never ran, or was declined) → nothing to append to; skip this
note, matching the "recommended, not required" case in the Resume check
above.

- **`auth OK`** → report it, continue to the `git:` block below (and, if
  Phase 1.5's research ran, straight into the deferred site inspection
  right after it).
- **`auth FAILED`** → STOP here. Do NOT re-run the curl command, do not
  attempt any second check "just to be sure." Report the lockout guidance
  verbatim, quoting `wordpress-rest.md` §Staging step 2's own lockout
  sentence word for word, with exactly one adapted clause (**bolded**
  below — the source is written for the real per-post workflow's staging
  probe, whose bare "re-run once" has no object in that context; the
  wizard needs to name what's being re-run, so this is the one insertion
  allowed):

  "on a 401/403, do not retry — a failed WordPress login may have already
  tripped the host's or a security plugin's login-attempt limiter, keyed to
  your IP and username. Retrying immediately only extends the lockout. Tell
  the human to wait it out or clear the limiter in the site's security
  dashboard, then re-run **this wizard** once, by hand, when ready." (Source
  clause, for comparison: "...then re-run once, by hand, when ready.")

  A failed probe doesn't block FINISHING the rest of the wizard (Phase 6
  re-states the failure, it never re-probes) — the user may fix credentials
  and re-run later — but flag it loudly: this exact command is what the
  real workflow's one-shot staging probe runs for real, on the first post,
  so a failure here is a strong signal to fix it before attempting one. A
  failed probe also means the deferred site inspection below cannot run
  this pass (it reuses this same credential, never a fresh probe of its
  own) — `{profile_dir}/site-conventions.md` stays unwritten until a later
  run's probe succeeds (see the crash-note above and the Resume check at
  the top of this phase, which is how that later run finds out).

### If `markdown`

2. `content_dir` (default `posts`): the folder in this repo where each post
   lands as `<slug>.md`.
3. `assets_dir` (default `posts/images`): each post's images land in
   `<assets_dir>/<slug>/`.
4. "Which platform reads these files? It sets the frontmatter at the top of
   each post." → `publish.markdown.platform`, one of:
   - `astro`: `title`, `description`, `pubDate`, `tags`, `author`, `heroImage` (an Astro content collection)
   - `hugo`: `title`, `description`, `date`, `tags`, `author`, `cover`
   - `jekyll`: `layout: post`, `title`, `description`, `date`, `tags`, `author`, `image`; you rename each file to `YYYY-MM-DD-<slug>.md` in `_posts`
   - `ghost`: `title`, `excerpt`, `published_at`, `tags`, `authors`, `feature_image`, Ghost's own field names
   - `nextjs`: `title`, `description`, `date`, `tags`, `author`, `image`
   - `eleventy`: the same keys as `nextjs`
   - `generic`: the same keys, for any other platform (Webflow, a page builder)
5. Repo platforms only (`astro`, `hugo`, `nextjs`, `eleventy`; skip for
   `jekyll`, `ghost`, `generic`): "How does your site serve a post's
   images?" → `publish.markdown.image_url_prefix`. Offer two answers, the
   platform's usual layout first as the default:
   - the usual layout for the platform:
     - `hugo`: files under `static/images/<slug>/`, served at `/images`
     - `nextjs`: files under `public/images/<slug>/`, served at `/images`
     - `eleventy`: a folder the site's config passes to
       `addPassthroughCopy` (for example `images`), served at its URL
       (for example `/images`)
     - `astro`: relative paths, as `astro-content.md` (the content
       collection resolves them at build); the other answer for astro is
       files under `public/images/<slug>/`, served at `/images`
   - "relative, my site copies the folder next to the post".

   When the answer is a prefix: normalize it first, in three steps: (a) trim
   surrounding whitespace, (b) drop one trailing `/`, (c) require that the
   result is either a site path (a single leading `/`, then at least one
   character that is not `/`, no whitespace anywhere, so `/images`) or an
   absolute URL (`http://` or `https://`, then a host, then an optional
   path with no whitespace, so `https://cdn.example.com/images`); if it is
   neither (for example `//cdn.example/images`, `/image folder` or
   `https:///x`), say so, name those two shapes, and ask again, and write
   nothing until it is one of them. `/images/` and
   ` /images ` both become `/images`. Then write `image_url_prefix:
   <normalized prefix>` (for
   example `/images`), and when `assets_dir` (item 3) is not the folder
   that prefix serves, suggest changing it to that folder (for example
   `static/images` for Hugo, `public/images` for Next.js). When the answer
   is relative: write no `image_url_prefix`. Either way, say: "Pilcrino
   does not inspect your site, so the first post's page on the site is the
   check: open it after the merge and confirm the images load."
6. `frontmatter_template`: state, don't ask:
   `adapters/publish/frontmatter/markdown-<platform>.md`.

Then say in one line what the merge does for their platform. Repo platforms
(`astro`, `hugo`, `nextjs`, `eleventy`): "Merging a post's pull request
publishes it when your site builds from the base branch and serves the
image shape you just chose." Paste platforms
(`jekyll`, `ghost`, `generic`): "Before you approve each post, download its
zip from the app (or copy the file and its images) and paste it into
<Platform>; merging then files it in this repository."

Verify the directories exist on disk:
```bash
[ -d "<content_dir>" ] && [ -d "<assets_dir>" ] && echo "both exist" || echo "missing"
```
If missing, offer to `mkdir -p` them; this adapter needs no site project in
the repo.

### git: block (every adapter)

10. `git.branch_prefix` (default `blog/`)
11. `git.base_branch` (default `main`)

Merge into `config.yaml`:

```yaml
publish:
  adapter: <astro-git-pr | wordpress-rest | markdown>
  astro:            # only if adapter = astro-git-pr
    content_dir: <path>
    site_dir: <path>                # omit if the repo root IS the Astro site
    assets_dir: <path>
    frontmatter_template: <path>
    draft_mechanism: "<line>"
    authors_map_check: <path>       # omit if not set
    preview_comment_marker: "<marker>"   # omit if not set
  wordpress:        # only if adapter = wordpress-rest
    content_dir: <path>
    assets_dir: <path>
    frontmatter_template: adapters/publish/frontmatter/wordpress.md
    base_url: <url>
    username: <username>
    app_password_env: <env var name>
    default_status: draft
    apply_inbound_links_live: false
  markdown:         # only if adapter = markdown
    content_dir: <path>
    assets_dir: <path>
    image_url_prefix: <prefix>      # omit when images are relative
    platform: <astro | hugo | jekyll | ghost | nextjs | eleventy | generic>
    frontmatter_template: adapters/publish/frontmatter/markdown-<platform>.md

git:
  branch_prefix: <prefix>
  base_branch: <branch>
```

### Site conventions (deferred from Phase 1.5)

If `blog-ops/reference/site-research.md` exists (Phase 1.5's existing-blog
research ran and the user consented to it earlier in this session), run
the now-resolved adapter's `## Site inspection (setup-time)` procedure —
`${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` or
`astro-git-pr.md`, whichever matches `publish.adapter` above — now, at
exactly this point. This IS Phase 1.5(e), deferred to here per that
phase's own note, because it needed the adapter chosen (just happened,
above) and, for `wordpress-rest`, its credential already verified (the
probe above, a few paragraphs up):

- **`wordpress-rest`:** only run this if the probe above reported
  `auth OK`. It reuses that SAME credential — never a fresh probe of its
  own, per that section's own auth-reuse rule. If the probe failed, skip
  this step entirely this run (see the note at the end of the auth-probe
  section above).
- **`astro-git-pr`:** no credential dependency at all — run this
  immediately, regardless of the directory-verification outcome above
  (it only reads files already in the repo).
- **`markdown`:** no inspection procedure (the adapter never reads the
  site): skip this section. `site-conventions.md` stays unwritten and is
  never required for this adapter.

Either branch writes `{profile_dir}/site-conventions.md` (shape:
`${CLAUDE_PLUGIN_ROOT}/templates/site-conventions.md`) and presents it to
the user for confirmation before treating it as final, per that adapter
section's own last step — never silently accepted, same as every other
pre-filled doc in this wizard.

**Cross-check `blog.trailing_slash`.** Both adapters' inspection procedures
read the site's actual permalink format and compare it against
`blog.trailing_slash` (set by Phase 1's Q12 directly, when its gate was
open, or already corrected once by Phase 1.5(a)'s own pre-fill confirmation
otherwise — either way, usually already correct by this point, but this
cross-check is the final safety net regardless of which path set it). If
they disagree, flag it loudly to the user instead of silently picking
one — per each adapter's own note — then, once the user confirms which one
is actually right, correct `blog.trailing_slash` in `config.yaml`
(re-merge and rewrite the whole file, Global rule 4) to match the real
site.

If `blog-ops/reference/site-research.md` does NOT exist (a brand-new blog,
or the user declined Phase 1.5's offer), skip this section entirely —
`site-conventions.md` stays unwritten. Per config-schema.md, that file is
required only when `publish.adapter: wordpress-rest` AND the blog already
existed at setup; recommended otherwise. A brand-new blog correctly has
nothing to inspect yet.

**Resume:** if `{profile_dir}/site-conventions.md` already exists, apply
Global rule 3 (keep as-is / update by re-running the adapter's inspection
procedure / start over) instead of blindly re-running it.

### Check the GitHub precondition

Per config-schema.md §GitHub precondition (this is unconditional for
every adapter, because the shared git staging shell runs underneath all of them):

```bash
ORIGIN=$(git remote get-url origin 2>/dev/null)
gh auth status
if [ -n "$ORIGIN" ] && gh repo view "$ORIGIN" --json name >/dev/null 2>&1; then
  echo "GitHub precondition: ok (PR publish path available)"
else
  echo "GitHub precondition: FAILED"
fi
```

**A failure here is a SETUP FAILURE, not a mode.** There is no local publish
path any more: the PR path is the only publish path, so an unreachable
`origin` means every post this blog attempts would hard-stop at the
workflow's Step 0 config preamble. Report the failing command's output and
stop this phase — the operator fixes the remote (or authenticates `gh`) and
re-runs setup. Do not write a "mode" anywhere; there is nothing to record.

On success, report in one sentence what it buys: every post opens a GitHub
PR and a background monitor watches for review comments.

## Phase 6: Validation & handoff

**Goal:** confirm the workspace is complete and correct, fix anything
that isn't, then hand off.

This phase always runs in full on every invocation (no skip option — it's
cheap and it's the whole point of the wizard).

### Run invariants 1-14

Run each one from config-schema.md §Validation invariants, in order,
against the final `blog-ops/config.yaml` and `{profile_dir}/`. Report a
pass/fail table as you go:

| # | Invariant | Result |
|---|---|---|
| 1 | YAML parses; `blog.name`, `blog.url`, `modules`, non-empty `images.enabled`, `publish.adapter` present | ✅/❌ |
| 2 | `images.featured_default` (if set) ∈ `images.enabled` | ✅/❌ |
| 3 | `remotion` ∈ `images.enabled` → `images.remotion.project_dir` set AND exists on disk | ✅/❌ |
| 4 | `publish.adapter` ∈ {astro-git-pr, wordpress-rest, markdown} and its config block present with required keys | ✅/❌ |
| 5 | Module-conditional profile docs exist iff module on (`product.md`, `competitors/methodology.md`) | ✅/❌ |
| 6 | Required profile docs always present: `blog.md`, `voice.md`, `authors.md`, `audience.md`, `image-style.md` | ✅/❌ |
| 7 | `blog.route_prefix` present, starts and ends with `/` | ✅/❌ |
| 8 | `browser.executable`, if present, is an absolute path | ✅/❌ |
| 9 | `blog.trailing_slash` present and a boolean | ✅/❌ |
| 10 | `console.publish_policy: auto` → `publish.adapter` is `astro-git-pr` (`wordpress-rest` and `markdown` are gated only) (N/A, ✅ by vacuity, if no `console:` block yet) | ✅/❌ |
| 11 | `console:` block, if present, contains only documented keys with documented types (N/A, ✅ by vacuity, if no `console:` block yet) | ✅/❌ |
| 12 | `competitors.profile_dir`, if set, is a repo-relative path that exists on disk when `modules.competitors` is true (N/A, ✅ by vacuity, if unset — the default applies) | ✅/❌ |
| 13 | `social.linkedin`, if present, has a non-empty string `company_id` (N/A, ✅ by vacuity, if `social.linkedin` is absent — this phase doesn't offer a wizard step for it, add it by hand) | ✅/❌ |
| 14 | `remotion` ∈ `images.enabled` → repo-root `.gitattributes` marks `<images.remotion.project_dir>/src/Root.tsx` as `merge=union` (N/A, ✅ by vacuity, if `remotion` is not enabled) | ✅/❌ |

For each ❌: identify which earlier phase owns the gap, jump back into that
phase's interview (pre-filled with whatever's already known), fix it,
rewrite the artifact, then re-run JUST that invariant. Continue until the
whole table is ✅. Invariants 10-11 are normally vacuous here since Phase 7
(which writes the `console:` block) runs after this phase; Phase 7 re-runs
the full 1-14 set once that block exists. This wizard has no interview step
for `social.linkedin` (invariant 13); the operator adds that block to
`config.yaml` by hand per `config-schema.md` §Schema.

### Supplementary checks (beyond the 14 numbered invariants)

- **No leftover placeholders.** `Grep` every file under `{profile_dir}/`
  (plus `{competitors_dir}/methodology.md` too, when `competitors.profile_dir`
  points outside `{profile_dir}/` and so isn't already covered by that
  sweep) for a literal `<` immediately followed by a word character and `>`
  later on the same line (a leftover template token), EXCLUDING
  `{competitors_dir}/methodology.md`'s nested "Profile shape"
  fenced block (Phase 3) — that block's angle brackets are a template for
  future per-competitor profiles, not unfilled wizard output; the rest of
  `methodology.md` (everything outside that one fenced block) is still
  subject to this check. Any other hit → that doc wasn't fully filled in;
  go back to the owning phase and fill it.
- **Adapter auth re-confirmed.** Re-state the Phase 5 auth probe result
  (WordPress: the `users/me` check; Astro and markdown: `gh auth status` +
  `gh repo view`). If either failed, remind the user it needs fixing
  before the first real post, but don't block handoff on it (the config
  preamble will catch it again at workflow-run time).
- **Git repo status + the GitHub precondition result**, re-stated from Phase 5, one line.
- **Site conventions, recommended-doc check (not a numbered invariant).**
  Per config-schema.md, `{profile_dir}/site-conventions.md` is REQUIRED
  when `publish.adapter: wordpress-rest` AND this blog already existed at
  setup — read that condition off `{profile_dir}/blog.md`'s
  `existing_blog: true` line (Phase 1.5's Offer step), never off whether
  `blog-ops/reference/site-research.md` happens to exist: an existing blog
  that declined Phase 1.5's research offer still has `existing_blog: true`
  and still owes this file, with no `site-research.md` on disk to proxy the
  check off of. If that combination holds and the file is still missing (Phase
  1.5 was declined, or its research ran without a successful auth probe by
  the time Phase 5's deferred inspection needed one), tell the user this
  doc is missing and recommend running the wizard again once credentials
  work, or answering "yes, research it" if Phase 1.5 was declined — but
  don't block handoff on it; this is advisory, not one of the ✅/❌ rows
  above.

### Custom instructions (optional)

Ask, as this phase's last question, regardless of invariant results:
"Want to seed a `custom-instructions.md` for this blog? Standing
instructions every stage of `blog-post-workflow` honors from here on —
tone tweaks, hard bans, platform quirks — ranked below your own live
instructions in any given conversation, but above this plugin's
personas/standards defaults."

- **Yes** → collect the content (free-text, multi-line is fine — this is
  the one profile doc with no fixed template shape). Write
  `{profile_dir}/custom-instructions.md` with exactly what the user gave
  you, verbatim, under a `# Custom instructions` heading if they didn't
  already provide their own structure. No placeholder tokens to fill in
  (Global rule 6 doesn't apply here — there's no template to leave gaps
  in).
- **No, or left blank** → skip. This doc is always optional per
  config-schema.md's registered-doc list — no file is written, and no
  invariant above depends on its presence.

**Resume:** if `{profile_dir}/custom-instructions.md` already exists, read
it, show a short summary, and apply Global rule 3 (keep as-is / update /
start over) instead of asking from scratch.

### Handoff

Once every invariant is ✅, do NOT print the completion message yet — first
run Phase 7 (offer the optional autopilot console). Phase 7 is where the
terminal "Setup complete" message is printed, on BOTH its branches (accept
or decline), so the optional console phase is always offered BEFORE the flow
declares itself done. Proceed to Phase 7 now.

## Phase 7 — Console & content plan (optional)

Offer, don't push: "Pilcrino can also run as an app: background writes on a
schedule and a browser dashboard for approvals. Do you want this blog ready
for it? You can add this any time later."

If yes:
1. Scaffold `blog-ops/content-plan.md` from `${CLAUDE_PLUGIN_ROOT}/templates/content-plan.md`
   (skip if present). It is an empty table; posts are added with
   `/pilcrino:plan-content` (standalone until the app connects this blog,
   then the app imports the file once and owns the list). If the blog has an
   existing editorial-calendar file, do not copy its rows into this file;
   tell the owner to add those posts with `/pilcrino:plan-content`.
2. Add the `console:` block from references/config-schema.md defaults to
   `blog-ops/config.yaml` (skip if already present). **Write it via the
   whole-file rewrite mechanism (Global rule 4), NOT an append.** For
   `wordpress-rest` and `markdown` blogs force `publish_policy: gated` and
   say why (invariant 10: WordPress go-live is manual, and every markdown
   post waits for the owner's approval).
3. Say where the app is: "The Pilcrino app is at https://pilcrino.com. Once
   installed, connect this folder from its dashboard; it imports
   `blog-ops/content-plan.md` into its post list on connect."
4. Re-run the config validation invariants (1-14, with invariants 10 and
   11 no longer vacuous since the `console:` block now exists).
5. Then print the terminal completion message (below).

**Resume:** if `blog-ops/content-plan.md` and/or `config.yaml`'s `console:`
block already exist, summarize what's on file and apply Global rule 3 (keep
as-is / update / start over) instead of re-offering from scratch.

**If no:** skip the console scaffolding entirely, no files written. This phase
can be run again later — nothing else in the wizard depends on it. Then print
the terminal completion message (below).

### Completion (printed at the end of Phase 7, both branches)

Whether the operator accepted or declined the console, close the wizard by
printing exactly:

```
Setup complete. Run `/blog-post-workflow new` to write your first post.
```
