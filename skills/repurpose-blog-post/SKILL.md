---
name: repurpose-blog-post
description: Turn a published blog post into four platform-native outputs, X thread, X short take, LinkedIn post, newsletter, per personas/repurposer.md. Each output RETHINKS the post for its platform with a distinct hook (enforced by a litmus test across all four). Reads brand rules, author voice from source post frontmatter, and optional archived working files (facts.md / outline.md). Plain canonical URLs (no tracking params, that's future work). Invoked standalone via /repurpose-blog-post <slug>; independent entry point, not wired into blog-post-workflow.
argument-hint: "<slug>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# repurpose-blog-post

Standalone entry-point skill. Takes a published blog post slug, produces four platform-native outputs (X thread, X short, LinkedIn post, newsletter) via the `repurposer` persona. Each output is genuinely distinct, not four formats of the same sentences.

## When to invoke

- After a blog post is live and the human wants to announce it across channels
- Standalone: `/repurpose-blog-post <slug>`, no dependency on blog-post-workflow being mid-flight
- Can be re-run: if you want fresh angles, invoke again; the skill overwrites its four outputs but preserves a timestamped prior copy if any exist

## Arguments

- `<slug>`, required. The slug from the published post filename (e.g., `best-carbon-road-shoes`), matching the filename minus the `.md` extension.

URL-based invocation (passing the canonical URL instead of the slug) is **not yet supported**, slugs only. The published post is local in the workspace repo at a config-derived path, so slug-based lookup is enough for the standard case.

## Step 0, Config preamble (guard first, before anything else)

1. **Locate the config.** `blog-ops/config.yaml` at the workspace repo root, per `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §Bootstrap rule. If missing or does not parse as YAML → stop: "No valid blog-ops/config.yaml, run /blog-setup first."
2. **Module gate.** Read `modules.repurpose`. If `false` → decline politely, naming the config key: "Repurposing is disabled for this blog (`modules.repurpose: false` in `blog-ops/config.yaml`). Set it to `true` to enable this skill." Stop, no files written.
3. **Resolve path variables.** `{profile_dir}`, `{drafts_dir}`, `{templates}` (layered rule) per §Path variables. Resolve `{content_dir}` from the ACTIVE `publish.adapter`:
   - `publish.adapter: astro-git-pr` → `{content_dir}` = `publish.astro.content_dir`; source post lives at `{content_dir}/<slug>.md` in the main tree (the published, non-draft post).
   - `publish.adapter: wordpress-rest` → `{content_dir}` = `publish.wordpress.content_dir`; the canonical finalized markdown lives at `{content_dir}/<slug>.md` in the workspace repo (WordPress itself is not the source of truth, the repo is, per `adapters/publish/wordpress-rest.md` §Config inputs).
   - `publish.adapter: markdown` → `{content_dir}` = `publish.markdown.content_dir`; the post lives at `{content_dir}/<slug>.md` in the workspace repo once its PR is merged (the repo is the post's canonical home, per `adapters/publish/markdown.md` §Relationship to the git repo).
   All three adapters use the same key name `content_dir` inside their own config block; never mix them.
4. Read `blog.url` (canonical URL prefix) and `blog.name`.

## Tool access

- `Read`, source post, profile docs, archived working files, 4 resolved templates, repurposer persona
- `Write`, four output files under `{drafts_dir}/_archive/<slug>/repurpose/`
- `Edit`, checklist stage updates (Step 12)
- `Glob`, find source post by slug; find archived working files
- `Grep`, char-count checks, hook-type sanity, forbidden-phrase sweep
- `Bash`, `wc -w` / `wc -c` for length checks, `mkdir` for output dir, `ls` for discovery

No MCP. No Chrome. No tracking params.

## Design principle: four distinct pieces, not four formats

The whole point of this skill is that a reader following the blog on X + LinkedIn + email should see genuinely different content, not the same post wearing four costumes. The repurposer persona enforces this; this skill enforces it again with a litmus check after drafting.

If the litmus fails (any two outputs share a hook type OR open with substantially identical sentences), regenerate the duplicate piece with a different angle. Max 2 regeneration passes per output; if after that the hooks still collide, flag to human, don't ship duplicates.

## Workflow

### Step 1, Resolve source

1. `Glob` for the blog post file at `{content_dir}/<slug>.md` (per the adapter branch resolved in Step 0.3).
2. If no match: stop, report "no published post found for slug `<slug>` at `{content_dir}/<slug>.md`, check the actual slug".
3. Read the post. Extract from frontmatter: `title`, `date`/`pubDate`, `excerpt`/`description`, `tags`, `authors`.
4. Canonical URL: `{blog.url}{route_prefix}<slug>` (append a trailing `/` iff `blog.trailing_slash: true`).

### Step 2, Locate working files (optional but preferred)

1. `Glob` for the archived draft directory: `{drafts_dir}/_archive/<slug>/`.
2. If exists: read `facts.md`, `outline.md`, `brief.md`, `research/reddit.md` (if present), `research/x.md` (if present). These ground the outputs in the same facts the blog post used.
3. If it doesn't exist yet (repurpose ran before Gate 2 finalize archived the working directory), fall back to `{drafts_dir}/<slug>/` for the same files.
4. If neither exists (post predates this workflow, or the archive was cleaned up): continue with the published post + profile docs only. Add a note to the final handoff: "no archive found, outputs derived from published post only; facts not cross-checked against `facts.md`".

### Step 3, Read persona + profile + templates

- `${CLAUDE_PLUGIN_ROOT}/personas/repurposer.md`, the full editorial contract
- `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`, base forbidden phrases, humanization floor
- `{profile_dir}/voice.md`, additional forbidden phrases, lexicon, rhythm
- `{profile_dir}/audience.md`, primary/secondary audience emphasis
- `{profile_dir}/authors.md`, per-author voice, sign-off patterns
<!-- module: product -->
- `{profile_dir}/product.md`, product source-of-truth (only when `modules.product` is on)
<!-- /module -->
- the resolved template `repurpose-x-thread.md`
- the resolved template `repurpose-x-short.md`
- the resolved template `repurpose-linkedin.md`
- the resolved template `repurpose-newsletter.md`

### Step 4, Decide author voice

Copy from source post's `authors:` frontmatter:
- a single author slug → that author's voice
- multiple author slugs → `we` voice

The voice is locked across all four outputs, don't code-switch per platform.

### Step 5, Pre-plan hooks (enforce distinctness up front)

Before drafting, pick four distinct hook types (from the persona's taxonomy: `contrarian`, `proof`, `data_surprise`, `story_hook`, `question_hook`, `vulnerability_hook`, `memorable_line`, `observation`).

Strategy:
- **Thread**, usually `proof` (data-heavy) or `contrarian` (if the blog has a sharp counterpoint) or `story_hook` (if the blog has a first-person anecdote)
- **X short**, whichever hook type the thread didn't take, often `memorable_line` or `observation`
- **LinkedIn**, `story_hook` / `contrarian` / `vulnerability_hook` work well on LinkedIn's builder audience
- **Newsletter**, pick the remaining hook type; newsletters often land well on `question_hook` or `observation`

Write the four hook types down before drafting any output. If two collide, resolve before writing.

### Step 6, Determine output directory

```
Bash:
  ARCHIVE_DIR={drafts_dir}/_archive/<slug>/repurpose
  DRAFT_DIR={drafts_dir}/<slug>/repurpose

  if [ -d "$(dirname $ARCHIVE_DIR)" ]; then
    OUTPUT_DIR="$ARCHIVE_DIR"
  elif [ -d "$(dirname $DRAFT_DIR)" ]; then
    OUTPUT_DIR="$DRAFT_DIR"
  else
    # No drafts dir at all, create archive location for the repurpose outputs alone
    OUTPUT_DIR="$ARCHIVE_DIR"
    mkdir -p {drafts_dir}/_archive/<slug>/
  fi

  mkdir -p "$OUTPUT_DIR"
```

### Step 7, Backup any existing outputs (idempotent re-runs)

If `<OUTPUT_DIR>/x-thread.md` (or any of the four) already exists:
```
Bash: TS=$(date +%Y%m%d-%H%M%S); for f in x-thread.md x-short.md linkedin.md newsletter.md; do
  [ -f "$OUTPUT_DIR/$f" ] && cp "$OUTPUT_DIR/$f" "$OUTPUT_DIR/.${f%.md}.$TS.md"
done
```

Preserves prior versions as dotfiles. Non-dotfile outputs get overwritten.

### Step 8, Draft all four outputs

For each platform, in this order (thread first because it's the most complex; others adapt around it):

1. **X thread** → `<OUTPUT_DIR>/x-thread.md` per the resolved template `repurpose-x-thread.md`
2. **X short take** → `<OUTPUT_DIR>/x-short.md` per the resolved template `repurpose-x-short.md`
3. **LinkedIn post** → `<OUTPUT_DIR>/linkedin.md` per the resolved template `repurpose-linkedin.md`
4. **Newsletter** → `<OUTPUT_DIR>/newsletter.md` per the resolved template `repurpose-newsletter.md`

Each output follows the template's heading structure exactly. Every placeholder filled. No `<placeholder>` text remaining.

Drafting rules (per the repurposer persona):
- Different hook type per output (declared up front in Step 5)
- Plain canonical URL `{blog.url}{route_prefix}<slug>` (trailing slash per `blog.trailing_slash`), no `?utm=...`
- Per-platform rules from the persona: char caps, casing, hashtag + emoji policy, link placement
- Forbidden-phrase sweep after each draft (dual-sourced: `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` + `{profile_dir}/voice.md`)
- Fact-preservation: every numeric or competitor claim traces to the blog post or `facts.md`; else `[VERIFY:]` marker

### Step 9, Char-count checks

Per-output length validation:

- **X thread:** every tweet ≤ 280 chars. Total thread 6–12 tweets. `wc -c` per tweet block; flag any over.
- **X short:** single tweet ≤ 280 chars.
- **LinkedIn first-line hook:** ≤ 210 chars AND target 5–10 words (hooks under 10 words outperform longer ones by 40% on see-more click rate). LinkedIn body: 1,300–1,800 chars target (sweet spot ~1,400), hard cap 2,500; above 2,000 chars engagement drops ~35%. Body must end with a CTA question that invites a 15+ word reply (see template `## CTA` section); posts without a CTA get ~40% less engagement.
- **Newsletter subject:** ≤ 70 chars. Preview: ≤ 120 chars. Body: target per format class.

If any check fails: truncate or rephrase to fit. Re-check after.

### Step 10, Litmus test

Read the four `Hook type` declarations across the four outputs.

1. Are all four distinct? If two share a hook type → regenerate the later one with a different angle. Max 2 regen passes per output; if still colliding, flag to human.
2. Do the opening sentences feel distinct? Grep the first 200 chars of each output's main content. If any two have >40% word overlap → regenerate the later one.
3. Is the blog/product mentioned exactly the right amount per output? Thread ≤1; short 0–1; LinkedIn 1 (usually in the first-comment link, not the body); newsletter 1 opener + 1 close CTA.

If litmus passed: mark `Litmus result: PASSED` in the final handoff.
If litmus required regeneration: mark `Litmus result: REGENERATED <which pieces>` with rationale.

### Step 11, Forbidden phrase sweep

Grep each of the four output files against `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` §Forbidden phrases AND `{profile_dir}/voice.md` §Additional forbidden phrases. Any hit → rephrase in place. Re-grep after. If any phrase survives after a second pass: leave it and flag in the handoff with line number; do NOT introduce grammar errors trying to chase it out.

### Step 12, Update archived checklist (if exists)

If the draft archive exists (`{drafts_dir}/_archive/<slug>/checklist.md`):

```
Read: <archive path>/checklist.md
Edit: tick Stage 5 Repurpose items for all four outputs
      Append stage log: "Stage 5 Repurpose completed: <ts>, 4 outputs written"
      (status stays `complete`; current_stage stays `complete`; this is post-terminal)
```

If no archived checklist exists: skip this step silently.

### Step 13, Return handoff

Return to the invoker (≤300 words):

```
Repurpose complete for <slug>.

Source: <path to published post>
Canonical URL: {blog.url}{route_prefix}<slug><trailing slash iff blog.trailing_slash: true>
Author voice: <author slug | we>

Outputs:
- Thread:    <OUTPUT_DIR>/x-thread.md    (<N> tweets, total body <N> chars)
- Short:     <OUTPUT_DIR>/x-short.md     (<N>/280 chars)
- LinkedIn:  <OUTPUT_DIR>/linkedin.md    (first-line <N>/210, body <N> chars)
- Newsletter: <OUTPUT_DIR>/newsletter.md (<format class>, <N> words)

Hook types:
- Thread:    <type>
- Short:     <type>
- LinkedIn:  <type>
- Newsletter: <type>

Litmus result: PASSED (all four hook types distinct)
             OR REGENERATED <piece>, <why>
             OR FLAGGED, <which pieces still collide>

Forbidden phrase sweep: 0 survivors / <N> surviving (see file: <path>:<line>)

Next (human):
1. Open each output and copy into the target platform / scheduler.
2. For X thread: post tweets in order; post the link as reply #1 after the last tweet.
3. For LinkedIn:
   a. **Before publishing**, spend ~15 minutes leaving thoughtful 15+ word comments on 5–10 posts from your network / target ICP. This is the single highest-ROI ritual practitioners report, it warms the algorithm and surfaces your post to those people's networks.
   b. Post the body. Immediately (within 60 seconds) post the "First comment" line as the first reply.
   c. The first 10–15 minutes determine ~95% of reach. Reply to every comment that lands in the first hour, then again at the 6h and 24h marks.
   d. Best windows if you have flexibility: Tue–Thu, 7:30–10am local. Otherwise post when you can be present for the first hour.
4. For newsletter: paste subject + preview + body into your ESP (Beehiiv / Kit / Loops / etc).
```

Keep the output content OUT of the return, the files are the artifacts.

## Failure handling

- **`modules.repurpose: false`:** decline at Step 0.2, no files written.
- **Source post not found (no `{content_dir}/<slug>.md`):** stop, do not write any outputs, report.
- **Published post has no `authors:` frontmatter:** flag; fall back to `we` voice; write outputs with a note in editor notes.
- **Char count can't be hit after two rewrites (e.g., LinkedIn first-line hook stubbornly >210 chars):** ship the piece anyway, flag in handoff, let the human tighten.
- **Litmus fails after 2 regen passes:** ship all four outputs anyway (don't leave empty files), flag in handoff with which pieces still collide. The human decides whether to edit or reshuffle hook types manually.
- **Forbidden phrase sweep leaves survivors:** ship the files, flag with line numbers. Don't introduce grammar errors to chase phrases.
- **Output dir creation fails (permissions, disk):** stop, report, no partial writes.

## Failure modes that should never happen

- **Two outputs with identical first sentences:** shipping a known-duplicate opening is a repurpose failure, not a near-miss. If the litmus + 2 regen passes can't produce distinct openings, the skill flags to human, it does NOT silently ship duplicates.
- **Any output with a tracking URL:** plain canonical URL only. If the draft has `?utm=...`, strip it before writing.
- **Invented facts:** every claim traces to the blog post or `facts.md` (if archived). Anything else is `[VERIFY:]`.

## What this skill does NOT do

- Does not fetch remote URLs, the source post is local
- Does not schedule posts, outputs are markdown for the human to use with their scheduler
- Does not add UTM or tracking parameters, that's future work
- Does not modify the source blog post, it's already live
- Does not post to X / LinkedIn / any platform, no API integration
- Does not generate newsletter HTML, plain text dominant, ESP-agnostic
- Does not fetch social media metrics, no Grafana, no analytics
- Does not spawn subagents, runs inline
- Does not support URL-based invocation yet (slug only)
- Does not enforce a Gate 4. If a human review gate is wanted, the human can review the four files on disk and re-run with tweaks, there's no special approval flow built in.
