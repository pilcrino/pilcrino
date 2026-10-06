---
name: suggest-images
description: "Generate a production-ready image plan for a blog post. For each [IMAGE:] placeholder in the humanized draft + the featured-image slot from the outline, produces a detailed entry with type, concept, suggested filename, production spec, and meaningful alt text. Output: {drafts_dir}/<slug>/images.md per the resolved template `images.md`. Invoked by blog-post-workflow at Stage 4a, or standalone on any draft with an outline + draft on disk."
argument-hint: "<slug>"
allowed-tools: Read, Write, Glob, Grep, Bash
---

# suggest-images

Turns `[IMAGE: ...]` placeholders in the draft + the outline's image placement plan into a concrete, human-executable image plan. One entry per image slot. No generation happens here, this is a spec document.

## When to invoke

- **Stage 4a of `blog-post-workflow`**, right after Stage 3d (marker auto-resolution) finishes and before Stage 4a.5 (image generation dispatch).
- **Standalone**, on any draft that has `outline.md` + a `draft-v<N>.md` on disk.

## Arguments

- `<slug>`, required. The draft directory name under `{drafts_dir}`.

## Tool access

- `Read`, outline, draft, facts, standards docs, profile docs, resolved template, per-type adapters, `{ops_dir}/featured-log/` + legacy `{ops_dir}/featured-log.md`
- `Write`, `{drafts_dir}/<slug>/images.md` + this post's own entry file `{ops_dir}/featured-log/<date>-<slug>.md` (Step 4 item 7 — the ONLY mutation this skill makes outside `{drafts_dir}/<slug>/`)
- `Glob`, find latest draft version
- `Grep`, extract `[IMAGE:]` placeholders from the draft
- `Bash`, `wc` / `date` if needed; no fetching

No MCP. No Chrome. No image generation (this skill produces the spec; `generate-images` dispatches file-producing slots, and the human executes the manual ones).

## Workflow

### Step 1, Resolve inputs

1. Verify `{drafts_dir}/<slug>/` exists.
2. `Glob` the latest `draft-v*.md`. Must exist. If not: stop, report "no draft found, run Stage 3a first".
3. Verify:
   - `{drafts_dir}/<slug>/outline.md` (image placement plan comes from here)
   - `{drafts_dir}/<slug>/facts.md` (for remotion chart/diagram data concepts)
   - `blog-ops/config.yaml` (`images.enabled`, `images.featured_default`)
   - `{profile_dir}/image-style.md` (palette, typography, aspect-ratio defaults for this blog's images; its §Featured-image variation section, when present, is this blog's archetype list — when absent, use the built-in default list in §Featured-slot archetype below)
   - `{ops_dir}/featured-log/` (this blog's featured-archetype rotation history, one entry file per post) plus the legacy single-table `{ops_dir}/featured-log.md` when present; OPTIONAL — absent on a blog's first post, this skill creates the directory at Step 4. Their absence is never a failure
   - the resolved template `images.md` (output contract)
   - `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md`, `ai-prompt.md`, `screenshot.md` (per-type production-spec contracts, read the ones matching this blog's `images.enabled`)
   - `{profile_dir}/product.md` (module: product; only needed if a slot is a candidate for an own-product screenshot)
4. If any missing: stop and report.

### Step 2, Extract slots

Two sources feed the final list:

1. **Featured image**, from `outline.md` § Image placement plan. Always one. Renders only via the frontmatter cover-image field (a banner above the title, per the publish adapter's convention). It is **not** an in-post slot. **Hard rule: the featured concept must represent the WHOLE post's thesis through ONE simple, bold visual idea, not one feature, and NOT by cramming every section/practice into a dense annotated diagram.** A featured image is a book cover, not an infographic: one clear metaphor, few elements (aim for ≤3 focal objects beyond the title + watermark), generous empty space, legible as a small thumbnail and at the 1.91:1 OG crop. Numbered callouts, badges, multi-point highlight pile-ups, and "annotate all N things" layouts are forbidden on the cover, that density belongs only in in-post diagrams. If the outline's featured concept is a single feature OR a busy multi-callout composition, brainstorm 2–3 simpler editorial concepts that say what the whole post is about in one glance and pick the cleanest (note the alternatives + rationale in § Featured image). It carries the post title (see layout primitives below).
2. **In-post images**, from grep of `[IMAGE:` in the draft:
   ```
   Grep: pattern="\[IMAGE:", path=<draft path>, output_mode=content, -n=true
   ```
   Each hit is one slot. Preserve draft order. Associate each with the preceding H2 heading (backtrack the line to find the most recent `## ` line above it).

**Featured-image hygiene check (hard rule):** if any `[IMAGE:]` placeholder in the draft has `Suggested filename: featured.<ext>` OR a concept that visibly matches the outline's featured-image concept, treat it as a **violation** of the writer's placement rules. Record it in § Editor notes as `MAJOR: featured image duplicated inline; recommend the human delete the inline placeholder before Stage 4b finalize`. Do not produce a separate in-post entry for it: emit one Featured image entry only.

**Table-duplicate-chart hygiene check:** if any `[IMAGE:]` placeholder is a chart-style `Type: remotion` slot AND the draft has a markdown table with the same content within ±20 lines, record a `WARNING` in §Editor notes recommending the chart be dropped unless it adds visualization the table cannot (color coding, callouts, computed values). Still spec it (the human decides).

Sanity check: the count of draft `[IMAGE:]` placeholders should equal the count of in-post slots in `outline.md`'s image placement plan (excluding the featured slot, which is frontmatter-only). If they differ, report the delta in § Editor notes, but still write the plan (the draft is the source of truth for what exists on disk).

### Step 3, For each slot, decide specifics

For each slot, produce: `type`, `concept`, `filename`, `production spec`, `alt text`.

#### Type selection: the enabled ladder

The `Type:` for every slot must be a member of this blog's `images.enabled` (from `blog-ops/config.yaml`). Walk the fixed priority order below and pick the first rung that is BOTH in `images.enabled` AND fits the concept, don't skip a higher rung because a lower one feels easier to brief:

1. **`remotion`** (if enabled): a custom React composition rendered to PNG via `{remotion_dir}/`. Prefer it for any branded diagram, redirect/flow chain, data chart, or illustration, including the featured slot's default choice. On-brand fonts + palette (guaranteed by the shared theme tokens), ships with `<BlogWatermark />`, editable forever in git. Authoring conventions live in `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md`, every `remotion` slot's production spec must conform to it.
2. **`screenshot`** (if enabled): a real capture of a screen this blog does NOT own — an external surface (a competitor pricing page, a quoted comment, an external how-to screen). Preferred for in-post slots that show a real external screen the human can capture. Off-brand when it's an external product; use only when the post genuinely needs an external moment. **Do not default this blog's own product/site UI here — see the hard rule below.** The `generate-images` skill does NOT auto-generate these, they stay a human action-item. Production-spec contract: `${CLAUDE_PLUGIN_ROOT}/adapters/images/screenshot.md`.
3. **`ai-prompt`** (if enabled): AI-generated, automated — via codex's built-in gpt-image, no API key (dispatch: `${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md`). For abstract/concept art or diagrams that don't need a specific data-accurate layout or verbatim in-image text. Reserve for slots that genuinely benefit from an illustrative, non-literal image, or as the fallback when neither `remotion` nor `screenshot` is enabled or fits. Prompt-quality bar: `${CLAUDE_PLUGIN_ROOT}/adapters/images/ai-prompt.md`. Modern gpt-image renders described text reliably, but never assign it to a slot whose whole point is a precise, verbatim numeric claim rendered as text, that belongs to `remotion` (real rendered text, exact by construction).

**Hard rules:**

- **Never propose a `remotion` chart image whose content is already presented as a markdown table in the draft.** A chart slot is justified only when the visual adds something the table can't (color coding, callout arrows, computed totals, a derivative chart shape).
- **Never use `screenshot` to fake a `remotion` composition.** If you want to illustrate a state with no real screenshot available, use `remotion` (annotated mockup) instead.
- **Never spec `screenshot` for this blog's own product/site UI when `remotion` is enabled (module: product).** A screen you'd have to go capture yourself blocks an autopilot run on a manual action-item; recreate it instead as a `remotion` UI mockup — it renders immediately with no capture step, leaks nothing from a real account or session, and stays editable in git. Reserve `screenshot` for this blog's own UI only when `remotion` is disabled for this blog, or for the rare case a real, specific data state must be shown authentically rather than illustratively.
- **Never assign a `Type:` not in this blog's `images.enabled`.** A slot whose only sensible type is disabled gets the next-best enabled rung instead; note the tradeoff in § Editor notes.

#### Featured-slot type (the invariant)

- **If `images.featured_default` is set in config:** use it. **Invariant: `images.featured_default`, when set, is always a member of `images.enabled`** (the config preamble validates this per config-schema.md invariant 2 before this skill ever runs; this skill does not need to re-derive it, but a slot emitting a type NOT in `images.enabled` is still a bug, see the Hard rules above).
- **If `images.featured_default` is unset:** pick from `images.enabled` using the same priority ladder as any other slot (§Type selection above). `remotion` is the strongest fit for the title-banner treatment described below and is usually the right pick when enabled; `screenshot` is rarely right for a from-scratch featured concept (it needs a pre-existing thing to capture) but is not forbidden if that is genuinely this blog's only enabled, fitting strategy.

#### Featured-slot archetype (variation rotation)

Featured images share locked brand elements (palette tokens, fonts, watermark, verbatim title band — those NEVER vary), so without deliberate rotation every cover converges on the same composition. The archetype is the anti-convergence mechanism: a named composition pattern, rotated across posts.

1. **Resolve the archetype list.** Use `{profile_dir}/image-style.md` §Featured-image variation when that section exists; otherwise use this built-in default list:
   - `object-metaphor` — one oversized central object or visual metaphor for the post's thesis; no cards, no flow.
   - `split-contrast` — a two-panel before/after or this-vs-that composition; the accent marks the winning side.
   - `diagram-lite` — a minimal card + arrow flow (the classic house style); at most 3 nodes.
   - `big-number` — typographic lead: one huge stat, figure, or short phrase from the post carries the composition.
   - `pattern-break` — a repeated motif grid where exactly one element differs (accent-colored); the anomaly is the message.
   - `scene-vignette` — a small illustrated scene or moment showing the problem/outcome, not a diagram of it.
   - `negative-space` — one small focal element placed off-center in generous empty canvas.
2. **Read the rotation history**, which lives in TWO places and is the union of both, sorted by `date` ascending:
   - `{ops_dir}/featured-log/*.md` — one entry file per post (the current format; see Step 4 item 7). List the directory; the filenames sort chronologically.
   - `{ops_dir}/featured-log.md` — the legacy single-table ledger, if it exists. READ-ONLY history: parse its rows, never append to it. Blogs created before the split have their history here, and it must keep counting or the rotation forgets everything before the change.

   Both are OPTIONAL — a blog with neither (its first post) blocks nothing, and that is never a failure.

   Compute the blocked set from PRIOR POSTS ONLY: first drop any entry whose slug is THIS post's slug (a Stage 4a re-run must be able to keep its own prior pick, not churn away from it), then take the archetypes of the last up-to-2 remaining entries — those are OFF LIMITS. One remaining row blocks that one archetype (the second post must not repeat the first); zero remaining rows (missing or empty ledger) blocks nothing. From the non-blocked archetypes, pick the one that best fits the featured concept — and when the concept doesn't genuinely need a flow, prefer something other than `diagram-lite`.
3. **Record the pick** in `images.md` §Featured image under `Archetype:`, and shape the featured production spec (layout, elements, prompt composition) to that archetype. The archetype governs COMPOSITION ONLY — palette, fonts, watermark, and the title band stay exactly per the adapter/style docs.

#### Concept writing

One sentence per slot. Concrete. "A dashboard showing 12 broken links flagged in red, with the top row highlighted" beats "monitoring screen".

#### Filename writing

Kebab-case, descriptive, 3–5 words. Extensions: `.png` for `remotion` and `screenshot` outputs; match the tool's native output format for `ai-prompt` unless this blog's convention requires PNG. **Featured image filename is always `featured.<ext>`** (typically `.png`).

Examples:
- `broken-link-example.png`
- `smart-link-routing-diagram.png`
- `affiliate-income-chart-q1-2026.png`
- `featured.png` (featured slot)

#### Production spec, fill the matching block

Based on `Type`, fill exactly one of the three blocks in the resolved template `images.md` (`remotion`, `ai-prompt`, `screenshot`). Every slot MUST carry the full production-spec block its type requires, never leave a block half-filled or fall back to prose:

- **`remotion`** → per `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md`: composition `<Still>` ID, component file path, canvas dimensions (featured: 1800×1200 per the adapter's `CANVAS` token; in-post: same canvas unless the adapter defines a smaller variant), the featured-only title + `<BlogWatermark />` layout primitives (in-post slots carry NO title, NO subtitle), a detailed visual spec (layout, exact copy strings, palette tokens from `{profile_dir}/image-style.md` + the adapter's §Color conventions, typography per `{profile_dir}/image-style.md`, icons/assets, arrow conventions if directional flow is needed, card recipe if cards appear), source data (a `facts.md` row or an explicit "hardcoded illustrative value" note), a reference composition to mimic, the iteration/preview command, and the worktree-safe final-export command targeting `{assets_dir}/<slug>/<filename>`.
- **`ai-prompt`** → per `${CLAUDE_PLUGIN_ROOT}/adapters/images/ai-prompt.md`'s quality bar, every point below is mandatory:
  - **Style block** pulling palette/mood/typography language from `{profile_dir}/image-style.md` by name (specific colors/textures/references, not "on-brand").
  - **Composition**: subject, foreground/background relationship, framing/angle, not just a topic.
  - **Aspect ratio**, stated explicitly (3:2 to match the featured-slot default, or the specific ratio an in-post chart/diagram needs).
  - **Negative prompts**: text artifacts, watermarks, extra limbs, stray logos, fake UI chrome, anything contradicting this blog's locked palette.
  - **Text-in-image warning**: if the concept needs exact, legible text or numbers, say so explicitly and flag that a human generating it may need a post-processing text overlay; never assign `ai-prompt` to a slot whose whole point is precise verbatim text (that's a `remotion` job).
  - **Style reference** (if any) and **source data** (if any, cite the `facts.md` row).
- **`screenshot`** → per `${CLAUDE_PLUGIN_ROOT}/adapters/images/screenshot.md`: source (this blog's own product/site UI, or `External: <name>`), URL to capture, what to include in frame, what to crop out, zoom/device, capture tool, capture date (external only), any annotations required, and annotation style (color per `{profile_dir}/image-style.md`'s accent color by default, 3px stroke, 6px rounded corners).

Ground any chart/diagram data in `facts.md` where possible. If a chart slot would need data not yet in `facts.md`, note it: "needs fresh data before generation", the human may decide to skip the chart or pull the data pre-publish.

**Values stated in text.** Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Data in images, every `remotion` or `ai-prompt` slot that shows numbers, labels or data values gets a `Values stated in text at:` line naming where the draft states them: the sentence before the placeholder (quote its first words), a markdown table in the same section, or `caption needed`. Alt text never satisfies it. When the draft does not state the values, write `caption needed` and list the slot in the Step 5 handoff so the editor adds a one-line caption under the placeholder before Stage 4a.5.

#### Alt text writing

50–125 chars typical. Meaningful, describes the image content, not the image medium. Good: "Dashboard showing 12 broken affiliate links in red". Bad: "screenshot", "image of the product".

### Step 4, Write `images.md`

1. Read the resolved template `images.md` for the heading structure.
2. Create `{drafts_dir}/<slug>/images.md`. Preserve template heading structure exactly.
3. Fill § Summary with actual counts (total, breakdown by type).
4. Fill § Featured image with the featured-slot spec.
5. One § Image N block per in-post slot, in draft order. Include the verbatim draft placeholder text as `Draft placeholder (verbatim)` so the human can grep the draft and replace it. Fill `Values stated in text at:` on every data slot.
6. Confirm the § File destination path is `{assets_dir}/<slug>/`.
7. **Write this post's rotation entry** to its OWN file,
   `{ops_dir}/featured-log/<YYYY-MM-DD>-<slug>.md` (`mkdir -p` the directory
   if absent). Exactly one file per post, overwritten in place on a Stage 4a
   re-run:

   ```markdown
   date: 2026-08-05
   slug: affiliate-link-management-tools
   archetype: Grid / map
   motif: five job pips over a ranked shortlist column
   ```

   `date` is today (`date +%Y-%m-%d`), `archetype` is the one chosen at Step 2,
   and `motif` is a ≤10-word summary of the featured concept (e.g. `oversized
   padlock over a muted browser card`). Name the file for the same date, so a
   plain filename sort is a chronological sort.

   **One file per post is the whole point — never a shared ledger file.** Every
   post writes this at the same stage, on its own branch. A single append-only
   table put every concurrent post's row on the same line of the same file, so
   whichever post merged second hit a merge conflict on a PR that was otherwise
   ready, and a conflicting PR runs no CI at all (`console-contract.md`
   §`pr_conflicted`). Two posts writing two different filenames cannot
   conflict, so there is nothing to resolve and no rule to get right.

   Durability: on the PR publishing path, Stage 4b.5 staging commits this file
   into the post's PR (`adapters/publish/astro-git-pr.md` §Staging step 6c/6e),
   so the entry travels with the post and a fresh checkout sees current
   rotation history. This skill only writes the main-tree copy; it never
   commits.

### Step 5, Return handoff

Return to the editor (≤200 words):

- Path: `{drafts_dir}/<slug>/images.md`
- Total image count: `<N>` (1 featured + `<N-1>` in-post)
- Breakdown by type: `remotion: <N>`, `screenshot: <N>`, `ai-prompt: <N>`
- Priority-ladder check: confirm every slot picked the right type (e.g., flag any `screenshot` slot where a `remotion` annotated mockup would work, or any chart-style `remotion` slot that duplicates a markdown table)
- Featured slot type + whether it came from `images.featured_default` or the planner's own pick
- Featured archetype chosen + which archetypes the ledger ruled out (e.g., `big-number; ledger blocked diagram-lite, object-metaphor`)
- Any mismatch between draft `[IMAGE:]` count and outline image slot count
- Any chart that needs data not currently in `facts.md` (flagged for the human)
- Slots marked `caption needed` (section and placeholder), so the editor adds the caption line
- Any ambiguous outline slot where the skill made a judgment call (so the editor / human can override)

## Failure handling

- **No draft found:** stop, report; do not write an images.md.
- **No `[IMAGE:]` placeholders in the draft AND no featured slot in outline:** verdict = warning; write a minimal images.md with just the featured slot (inferred from post type) and flag to human that no in-post images were requested.
- **Outline status ≠ `approved`:** still proceed, Phase 4 runs after Stage 3d, so outline is always approved by now. If the status field reads something else, flag but continue.
- **Facts.md missing or sparse:** remotion chart slots that would have cited it get "needs fresh data" flagged; skill continues.
- **`images.enabled` has no member that fits a slot's concept:** pick the closest available rung, note the compromise in § Editor notes; never emit a `Type:` outside `images.enabled`.

## What this skill does NOT do

- Does not generate images. `generate-images` dispatches `remotion` and `ai-prompt` (codex) slots automatically; the human executes `screenshot` slots. This skill is spec-only.
- Does not edit the draft, `[IMAGE:]` placeholders remain exactly as the writer placed them. The human (or the publish adapter's staging step) replaces them with real Markdown image syntax.
- Does not download any assets, nothing goes into the asset folder. `generate-images` creates the folder and renders file-producing slots; the human populates `screenshot` slots and any `failed` fallbacks.
- Does not update `checklist.md`, the editor (main skill) does that after Step 5 returns.
- Does not spawn subagents, runs inline.
- Does not change the asset folder destination path format, `{assets_dir}/<slug>/` is fixed by the config-resolved path variable.
