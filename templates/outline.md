# Outline: <target keyword>

Written by: blog-editor (Stage 2).
Sources: `{drafts_dir}/<slug>/plan.md` (approved at Stage 1c.5 plan review), `{drafts_dir}/<slug>/facts.md`, `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md`, `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`, `{profile_dir}/voice.md`, and (if `modules.product` is on) `{profile_dir}/product.md`.
Read by: blog-writer (Phase 3) during drafting; blog-reviewer at Stage 3b for structural alignment checks.

**Purpose:** the structural blueprint produced at the end of Stage 2 by the editor's editorial judgment (no human gate). It locks every H2/H3, the intro shape, the FAQ set, and the external link plan. Writer may adjust phrasing but not structure. Any structural problem with the outline gets flagged later as a Stage 3b reviewer issue (which forces a writer revise pass) or surfaces at Gate 2 / Final approval as an "outline-level structural issue" the human can request changes on.

## Status

<draft | approved | revision_requested>

## Final title

`<chosen title, 50–60 chars>`

Source: copied from `plan.md` "Recommended title" unless a change was made before plan-review approval, or the human later requests an outline-level change at Gate 2 / Final approval.

## Final slug

`<kebab-case-slug>`

Source: copied from `plan.md`.

## Final meta description

`<≤160 chars; optimized for click>`

Source: copied from `plan.md` unless refined.

## Author voice

<author slug from `{profile_dir}/authors.md`, or "we">

Source: copied from `brief.md` and `plan.md`. Writer honors this voice throughout every section.

## Word count target

<range from `plan.md` "Length target", matches top-5 SERP average per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md`>

## Intent

<transactional | comparison | review | how_to | informational_pillar | data_driven | problem_solution>

Carried from `plan.md`. Determines title formula + body shape.

## Category

`<category name, or "none">`

Source: copied from `plan.md`, which carries it from `brief.md`'s Category field. Consumed at `adapters/publish/wordpress-rest.md` §Staging to resolve/create the WordPress term.

---

## Intro structure (4 paragraphs max)

Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` intro rules: hook with target keyword → expertise statement → internal link cluster → preview.

### P1, Hook

One sentence, includes the target keyword naturally, and carries the direct answer to the target query within the body's first forty words (`${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Intro structure). If built on a statistic, cite source from `facts.md`.

- Direct answer (one clause the hook must contain): `<the top pick and its buyer | the outcome and step count | the headline number | the one-sentence answer>`
- Hook sentence (draft): `<text>`
- Fact anchor (if any): `<fact>`, source: `<url from facts.md>`

### P2, Expertise statement

One sentence that establishes why this blog is qualified to write this post, drawn from the credibility message in `{profile_dir}/voice.md` (and, if `modules.product` is on, something specific from `{profile_dir}/product.md`, e.g., "We built <product> to help our readers ship faster…"). NOT a generic "we are experts" line.

- Expertise sentence (draft): `<text>`

### P3, Intro internal links (≤2, contextual)

At most 1–2 internal links woven into a sentence, only posts that fit the intro's narrative. The remaining internal links are planned per body section (each goes where its topic is discussed, never a "see also" stack). Source: `research/serp.md` existing-posts table + `plan.md`.

| Anchor text | Target slug | Placement (intro or which H2) |
|---|---|---|
| <anchor> | <slug> | <intro \| H2 N> |

### P4, Preview

One sentence: "this guide covers X, Y, and Z", sets the reader's expectations for body sections.

- Preview sentence (draft): `<text>`

---

## Body sections

Every H2 must include ≥1 fact reference (sourced from `facts.md`) and, if `modules.product` is on, may include product mentions only when they earn their place (no stuffing, the mention must serve the reader's question).

The first body H2 is the key takeaways block for intents `transactional`, `comparison`, `review`, `how_to`, `data_driven` and `informational_pillar` (optional for `problem_solution`), per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Key takeaways block. Number the sections after it from H2 2:

### H2 1: Key takeaways

- Bullet 1 (restates the direct answer): `<one sentence with a number, a name or a recommendation>`
- Bullet 2: `<...>`
- Bullet 3: `<...>`
- Bullets 4–5 (optional): `<...>`
- Approximate word count: `<60–120>`

For comparison posts (intent = transactional, comparison or review, or any post with a comparison table naming this blog's product), per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Comparison posts:

- One body H2 is the methodology section, placed before the first per-option H3 (transactional), the first criterion H2 (comparison) or "What works" (review). Fill it as a normal `### H2 N:` block so the writer and reviewer see it in the H2 order:

```
### H2 N: How we compared   (review: `How I tested`)

- Disclosure line (first sentence, when `modules.product` is on, and in a review only when the post names this blog's product; else "none"): `<line from {profile_dir}/voice.md §Disclosure line, else "I build [product], so weigh this accordingly.">`
- Criteria, in the order applied: `<price | delivery model | who it is for | differentiators from product.md §"Unique-in-category differentiators" | ...>`
- How each option was checked: `<profile date | hands-on test | public docs>`
- Approximate word count: `<N>`
```

- Each product/item gets its own H3 with these two lines instead of pros, cons and a label. The H3s sit under the comparison H2 (transactional), under "Who should pick which" (comparison) or under "Who it is for" (review: the reviewed product, and this blog's product when the post names it). This blog's own product gets both lines too:

```
#### H3 N.M: `<option name>`

- Best suited to: `<one sentence naming the buyer this option fits>`
- Trade-off: `<at least one stated downside>`
- Key fact to cite, from `facts.md` entry: `<fact>`, source: `<url>`
```

- Comparison table cells are facts (prices, limits, plan names, yes or no, dates), never adjectives. This blog's product appears as an option in the table when `modules.product` is on (row or column), and it gets its own H3 with the two lines above; a review needs no table, and a table of the reviewed product's own plans is not a comparison table; a blog without a product compares third-party options only.

### H2 2: `<heading>`

- Bullet: what this section covers
- Bullet: key fact to cite, from `facts.md` entry: `<fact>`, source: `<url>`
- Bullet: product reference (if any, module: product), reason it earns its place: `<why>`
- Approximate word count: `<N>`

#### H3 2.1: `<subheading>` (if listicle/how-to)

- Bullet: ...
- Bullet: ...

### H2 3: `<heading>`

- Bullet: what this section covers
- Bullet: key fact, `<fact>`, source: `<url>`
- Approximate word count: `<N>`

<!-- repeat H2 blocks for each section; typical post has 5–8 H2s plus FAQ -->

---

## Closing CTA

Sits immediately before the FAQ (the FAQ is the last block). Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Conclusion / CTA: ≤2 short paragraphs, links this blog's primary CTA (target and hook from `{profile_dir}/blog.md`) with an action anchor, no feature re-list, durable framing.

- CTA angle (one line): <what the reader does next>

---

## FAQ block

3–5 questions. Each answer gets a one-sentence direction here; the writer expands in draft. These feed the JSON-LD FAQ schema in the post frontmatter.

- Q: `<question>` → A direction: `<one sentence on what the answer should emphasize>`
- Q: `<question>` → A direction: `<…>`
- Q: `<question>` → A direction: `<…>`

---

## Inbound internal links (existing posts → this post)

1–4 already-published posts that should link TO this new post. Each row: the existing post to edit, the section/context where the link fits, and the draft anchor. Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Internal linking; flows to `action-items.md` (the human edits the existing post files at publish).

| Existing post (slug) | Section / context for the link | Anchor text (draft) |
|---|---|---|
| <slug> | <where in that post + why it fits> | <anchor> |

---

## External link plan

Only reputable sources. Every link backs a literal claim in the post. Source: `facts.md` + `research/serp.md` §"Citations harvested from competitors".

**Forbidden:** any URL listed in `research/serp.md` top-10 SERP results (we don't promote our ranking competitors). Exception: domains on the authoritative-site allowlist in `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §External linking. When a competitor article is the only place a stat appears, route to the **primary source** the competitor cites (their `externalLinks` field), not to the competitor.

Each row gets a `Source classification` so the reviewer can verify the rule programmatically. Allowed values:
- `primary_source`, the original study / dataset / official doc; preferred class
- `authoritative_allowlist`, on the allowlist in `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §External linking; permitted even if it appears in top-10 SERP
- `internal_facts`, derived from `facts.md` "Product facts" section (module: product); the link target is our own content

`forbidden_serp_competitor` is what the reviewer flags when it spots an external link to a top-10 SERP URL not on the allowlist; this row should never appear in a healthy outline.

| Anchor (literal claim in post) | Target URL | Source classification | Facts.md source / SERP citation reference |
|---|---|---|---|
| <anchor> | <url> | <primary_source \| authoritative_allowlist \| internal_facts> | <facts.md line, OR research/serp.md §Citations harvested from competitors row N> |

---

## Image placement plan (high-level)

Specifics (prompts, filenames, alt text) come in Phase 4 via the `suggest-images` skill. This section just fixes the slots.

Placement rules:
- **Featured image is frontmatter-only.** It's referenced via the post's frontmatter cover-image field per the publish adapter's convention (`adapters/publish/<adapter>.md`). Do **not** also list it as the first in-post slot; the post would then render the same asset twice.
- **In-post slots sit *after* the section heading + the section's first body paragraph**, not before the heading. Headings introduce the section; the image illustrates a point already framed in the prose.
- **Exception:** an image that closes evidence cited in the prior section's prose may sit before the next H2 (use sparingly).
- **Don't earmark a chart-style image whose content is already a markdown table in the same section.** Tables already render as SERP-eligible HTML. A duplicate image adds maintenance cost without rich-result benefit. A chart is justified only when the visual adds something the table can't (color coding, callouts, computed totals, derivative chart shape).

- **Featured (frontmatter cover):** `<concept>`, type: `<images.featured_default from config, or the planner's choice from images.enabled>` (must be one of `remotion | ai-prompt | screenshot`; see `${CLAUDE_PLUGIN_ROOT}/adapters/images/<type>.md` for the production spec)
- **After H2 `<heading>` + 1 paragraph:** `<concept>`, type: `<remotion | ai-prompt | screenshot>`
- **After H2 `<heading>` + 1 paragraph:** `<concept>`, type: `<remotion | ai-prompt | screenshot>`

---

## Word count roll-up

Editor's internal consistency check. **Total estimate = body prose only: intro + body sections + outro/CTA, EXCLUDING the FAQ** (FAQ length is schema-driven, not prose). This is the exact basis the Stage 3b reviewer measures against, keep them aligned.

- Intro: ~200 words
- Body sections total: `<sum of H2 word counts>`
- Outro / CTA: ~100 words
- **Total estimate (body prose, no FAQ):** `<N>` vs plan target `<range>`
- FAQ: ~150 words (listed for completeness; NOT part of the gated total)

---

## Information gain placement

Carried from `plan.md` §Information gain so the writer places it and the reviewer can find it.

- **Element:** `<copied from plan.md>`
- **Lands in:** `### H2 N: <heading>`, as `<table | quote | screenshot slot | paragraph>`

---

## Open questions (recorded, no longer block on a human gate)

There's no human gate on the outline anymore, so any open questions the editor would have raised at Gate 2 (in the old workflow) get logged here AND surfaced in the editor's continuation message before Stage 3a starts. The human can choose to interrupt and address them, or let the workflow continue and address them at Gate 2 / Final approval if they affect the shipped post.

- [ ] `<question>`
- [ ] `<question>`

If no open questions, write: "None."

---

## Changes requested by human (log)

Append here if the human requests outline-level revisions later (typically surfaced at Gate 2 / Final approval, but can also happen mid-flight if the human pauses the workflow). Editor updates the outline above and moves the log entry here.

- `<YYYY-MM-DD HH:MM>`, `<change requested>`, status: `<addressed | pending>`
