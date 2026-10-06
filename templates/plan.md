# Plan: <target keyword>

Written by: blog-editor (synthesis stage).
Sources: brief.md, research/serp.md, {profile_dir}/product.md, facts.md.
Read by: plan-reviewer (Stage 1c.5), blog-editor (outline stage, Phase 2), blog-writer (Phase 3).

**Purpose:** the strategic document approved at Stage 1c.5 plan review. Once approved, it locks the angle, audience, and structure. Outline and drafting must follow this plan.

## Status

<draft | awaiting_plan_review | approved | revision_requested>

## Intent

<one of: transactional | comparison | review | how_to | informational_pillar | data_driven | problem_solution>

Reasoning: <one sentence>

## Category

<carried from `brief.md`'s Category field, resolved against `{profile_dir}/site-conventions.md` §Categories when it exists>

## Audience emphasis

- **Primary:** <segment per `{profile_dir}/audience.md`>, <one-sentence rationale>
- **Secondary:** <segment per `{profile_dir}/audience.md`, or "none">, <one-sentence rationale>

Reader knowledge level: <beginner | intermediate | advanced>

## Author voice

<author slug from `{profile_dir}/authors.md`, or "we" for co-authored/product-wide content>, <one-sentence rationale; defaults from `{profile_dir}/authors.md`>

<!-- module: product -->
## Product positioning emphasis

<a short label for which product feature(s) this post emphasizes, drawn from `{profile_dir}/product.md`'s feature list, e.g. `<feature-a>_primary | <feature-b>_primary | both_balanced | discovery | analytics | technical_credibility`>

Per `{profile_dir}/voice.md`: lead with this blog's primary value proposition unless the post is genuinely about a different aspect. Default for most posts is `both_balanced` or the blog's designated primary feature.
<!-- /module -->

## SERP shape match

<one of: best-of-listicle | how-to-numbered | definitional | data-driven | mixed>

Based on `research/serp.md` top-results analysis. The post structure will match this shape.

## Title candidates (3 options)

1. `<option 1>`, <N chars>, tone: <framing rationale>
2. `<option 2>`, <N chars>, tone: <framing rationale>
3. `<option 3>`, <N chars>, tone: <framing rationale>

## Recommended title

`<the chosen one>`

Rationale: <one sentence on why this over the others>

## Slug

`<kebab-case-slug>`

Validation: target keyword only, no year, no trigger words.

## Meta description (draft)

`<≤160 chars; optimized for click>`

## Angle

One paragraph (2–4 sentences): the unique take this post brings. What's the hook that differentiates from the SERP competitors identified in research? This is the soul of the post.

## Information gain

The one element on this page no competing page can publish, per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Information gain. A plan with nothing to put here goes back to `facts.md` and `brief.md` before review.

- **Element:** `<what it is, in one sentence>`
- **Type:** `<first-party data | real-use screenshot | own test | buyer quote with link | named expert quote | founder anecdote | methodology and comparison table (transactional, comparison and review posts)>`
- **Source:** `<facts.md row | product.md data-inventory row marked derivable | research/reddit.md or research/x.md quote with URL | brief.md §Founder anecdote>`
- **Lands in:** `<which H2, and as what: table, quote, screenshot slot, paragraph>`

## Key sections (preview, becomes the outline in Phase 2)

High-level H2s the post will have. Not the full outline, just the structural skeleton.

1. <H2 1>
2. <H2 2>
3. <H2 3>
4. <H2 4>
5. <H2 5>
6. <H2 6>
7. <H2 7>
8. FAQ

For listicle posts, list the products / items planned to appear:
- <item 1>
- <item 2>
- <item 3>

## Comparison criteria

Transactional, comparison and review posts (else write "n/a"). The criteria the methodology section will name, in the order they are applied, per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Comparison posts. Include the product-specific differentiators from `{profile_dir}/product.md` §"Unique-in-category differentiators" when that section exists.

1. <criterion, e.g. price per seat>
2. <criterion>
3. <criterion>

<!-- module: product -->
## Product references planned

Where in the post the product will appear. From `{profile_dir}/product.md` positioning recommendations.

- **Intro expertise statement:** <one-sentence framing>
- **Body mentions:** <list where and why>
- **Conclusion CTA:** <action being recommended>
<!-- /module -->

## Internal links planned

From `{profile_dir}/product.md` existing-posts table (if `modules.product` is on) or the editor's own inventory of prior posts.

| Target slug | Anchor text (draft) | Where in the post |
|---|---|---|
| <existing-slug> | <anchor> | intro |

## External links planned

From `research/serp.md` and `facts.md`. Only reputable sources.

| Source | Claim it backs | URL |
|---|---|---|
| <source> | <claim> | <url> |

## Facts / data to feature prominently

From `facts.md`. Top 3–5 that are the spine of the post.

- <fact 1>
- <fact 2>

## Image plan (high-level)

Specifics come in Phase 4 via the `suggest-images` skill (image-planner subagent).

- **Featured:** <concept>, type: `<images.featured_default from config, or the planner's choice from images.enabled>`
- **In-post images:** approximately <N>, types: `<remotion | ai-prompt | screenshot>` (mix per `images.enabled`; the image-planner subagent assigns per slot)

## Length target

<word count range, matching post-type matrix in `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md`>

## Tone hooks

Specific tonal notes for this post beyond the default brand voice:

- <note 1>
- <note 2>

## Open questions (resolved or flagged for plan review)

Things the editor needs the human to decide before outline creation:

- [ ] <question 1>
- [ ] <question 2>

If no open questions, write: "None, awaiting approval to proceed."

## Changes requested by human (log)

Append here if plan review requests revisions. Editor updates the plan above and moves the log entry here.

- <YYYY-MM-DD HH:MM>, <change requested>, <status: addressed | pending>
