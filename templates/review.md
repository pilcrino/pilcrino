# Review: <slug> draft-v<N>

Written by: `review-blog-post` skill (invoked by the editor at Stage 3b).
Sources: `{drafts_dir}/<slug>/draft-v<N>.md`, `{drafts_dir}/<slug>/outline.md`, `{drafts_dir}/<slug>/facts.md`, `{drafts_dir}/<slug>/brief.md`, `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`, `{profile_dir}/voice.md`, `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md`.
Read by: editor (decides next action), blog-writer (consumed as `review_path` when `mode=revise`).

**Purpose:** a deliberately critical, checklist-driven audit of the draft against every objective rule in the outline + brand docs. The review skill is independent of the writer so it isn't biased by the same prompts that wrote the draft.

## Reviewed

- Draft: `{drafts_dir}/<slug>/draft-v<N>.md` (word count: `<N>`; outline target: `<M>`)
- Outline: `{drafts_dir}/<slug>/outline.md` (status: `<approved>`)
- Author voice: `<author slug from {profile_dir}/authors.md, or "we">` (from brief.md)

## Verdict

`<approve | request_revisions | reject>`

Reasoning (1–3 sentences): `<why this verdict>`

**Iteration counter:** this is revision pass `<N>` of `<max 2>`. If verdict = `request_revisions` AND iteration > 2: the editor should escalate to the human, not dispatch another writer pass.

## 1. Voice + tone

| Check | Pass? | Notes |
|---|---|---|
| Matches `author_voice`: `<author slug, or "we">` (§`{profile_dir}/voice.md` + `{profile_dir}/authors.md`) |  |  |
| First person throughout (`I`, `we`, `you`), no `one`, `users`, `stakeholders` |  |  |
| Active voice (no "X was scanned" shapes) |  |  |
| Burstiness present, every H2 section has visible sentence-length variation |  |  |
| Forbidden phrases count: `<N>` (list below); any hits = fail |  |  |
| Em-dash count: `<N>` (grep `—`); any hits = automatic §1 fail, each logged in §7 as `major` |  |  |
| En-dash context: every `–` hit is inside a numeric range (digits on both sides) |  |  |

Forbidden phrases found (grep output from `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` + `{profile_dir}/voice.md` lists):
- `<phrase>`, draft-v<N>.md:<line>
- ...
(If none: "None found.")

## 2. Structure

| Check | Pass? | Notes |
|---|---|---|
| Frontmatter block present and valid per the publish adapter's frontmatter template (title, date, excerpt, tags, authors, cover, JSON-LD) |  |  |
| Title in frontmatter matches outline "Final title" exactly |  |  |
| Slug / meta description match outline |  |  |
| H2 order in body matches outline body-sections list exactly (no additions, no removals, no reorderings) |  |  |
| Intro is 2–4 paragraphs, 1–3 sentences each (hook / expertise / internal-link cluster / preview) |  |  |
| Direct answer within the first forty words of the body (outline P1 "Direct answer" clause present in the hook) |  |  |
| Key takeaways block present with 3–5 concrete bullets when the outline has `H2 1: Key takeaways` (required intents: transactional, comparison, review, how_to, data_driven, informational_pillar) |  |  |
| Every H2 has at least one rhythm marker (bullet list OR standalone question OR concrete number OR burstiness) |  |  |
| FAQ section has `### <Q>` items matching outline FAQ set 1:1 |  |  |
| JSON-LD FAQPage schema in frontmatter matches FAQ body questions 1:1 |  |  |
| Outro / CTA paragraph present |  |  |

Structural deltas vs outline (if any):
- `<describe any drift from outline.md>`

## 3. Facts + sourcing

| Check | Pass? | Notes |
|---|---|---|
| Every numeric claim traces to a `facts.md` entry OR has `[VERIFY:]` marker |  |  |
| Every competitor name used carries a "Best suited to" sentence plus a trade-off, not a takedown |  |  |
| Methodology H2 present with criteria and disclosure (transactional, comparison and review posts; a review's disclosure only when it names this blog's product; `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Comparison posts) |  |  |
| Every comparison table cell is a fact, not an adjective; when `modules.product` is on, the product appears as an option in the table (N/A for a review without a comparison table of options, or with the module off; a table of the reviewed product's own plans is not one) |  |  |
| The plan's information gain element survived into the draft, in the H2 the outline names |  |  |
| Pricing / feature claims about competitors match `facts.md` values (verify dates not stale) |  |  |
| Product mentions (count: `<N>`, if `modules.product` is on) are each earning their place, none can be deleted without losing meaning |  |  |
| Internal links (count: `<N>`) exist in the intro cluster per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` |  |  |
| Every internal blog link is root-relative `{route_prefix}<slug>` (trailing slash iff `blog.trailing_slash: true`), not `https://yourblog.com{route_prefix}...` (absolute = `major`) |  |  |
| External links (count: `<N>`) each point to reputable sources; anchor text = literal claim |  |  |
| Target keyword appears 2–8 times in body (actual count: `<N>`) |  |  |

Unsourced / suspicious claims:
- `draft-v<N>.md:<line>`, "<claim>", issue: `<not in facts.md, no [VERIFY:] marker>`
- ...

## 4. Markers + placeholders

| Marker | Count | Placement OK? |
|---|---|---|
| `[VERIFY:]` | `<N>` |  |
| `[EXTERNAL_LINK_NEEDED:]` | `<N>` |  |
| `[INTERNAL_LINK_NEEDED:]` | `<N>` |  |
| `[IMAGE:]` | `<N>` vs outline `<M>` slots |  |
| Every data image has its values in nearby text (preceding sentence, same-section table, or caption) | `<N data slots>` |  |

Marker-shape problems (e.g., `[Verify:]` lowercase v, extra spaces, rogue formats the Phase 4 grep will miss):
- `<list or "None">`

## 5. Word count

- Draft: `<actual>` words (body, excluding frontmatter)
- Outline target: `<target>` words
- Delta: `<+N% | -N%>`
- Band: `<within ±10% = pass, no issue | beyond ±10% up to ±15% = minor issue logged in §7 (trim/expand note), still counts as a pass for the verdict gate | beyond ±15% = fail, forces request_revisions>`

## 6. Humanization floor (per `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` + `{profile_dir}/voice.md`)

| Check | Pass? | Notes |
|---|---|---|
| No forbidden phrases (0 hits) |  |  |
| Zero em-dashes (`—`, grep returns nothing) |  |  |
| En-dashes (`–`) only in numeric ranges |  |  |
| First-person throughout |  |  |
| Active voice |  |  |
| ≥1 rhythm marker in every H2 |  |  |
| ≥1 bullet list per ~300 words |  |  |
| ≥1 standalone-question paragraph per major section (if the selected author voice calls for it, per `{profile_dir}/authors.md`) |  |  |
| ≥1 concrete number or named example per major section |  |  |
| No em-dash overuse |  |  |
| Visible sentence-length variation in every section |  |  |

## 7. Specific issues

Issues ranked by severity. `critical` = must fix before approve; `major` = fix if revising; `minor` = nit-pick.

| Section (H2) | Line | Severity | Issue | Fix instruction (verbatim for writer if revising) |
|---|---|---|---|---|
| `<H2>` | `<N>` | `critical \| major \| minor` | `<issue description>` | `<specific, actionable instruction>` |

If no issues: "None, draft is clean."

## 8. What the draft does well

Three specific strengths the writer should preserve on revision. Calling these out explicitly prevents the writer from rewriting strong sections accidentally.

- `<strength 1>`
- `<strength 2>`
- `<strength 3>`

## 9. Instructions for writer (only if verdict = `request_revisions`)

Copy-paste-ready prompt block for the writer's `mode=revise` invocation. The writer reads this verbatim.

```
The editor requested revisions to draft-v<N>.md. Apply ONLY these issues
(preserve everything else, including the strengths listed above):

1. <issue 1 fix instruction>
2. <issue 2 fix instruction>
3. ...

Do NOT remove [VERIFY:] / [EXTERNAL_LINK_NEEDED:] / [INTERNAL_LINK_NEEDED:] /
[IMAGE:] markers unless the issue explicitly says to. Do NOT change the H2
order, title, slug, meta description, or FAQ set, those are locked.

Produce {drafts_dir}/<slug>/draft-v<N+1>.md. Do not overwrite the prior draft.
```

If verdict = `approve` or `reject`: leave this section as `N/A`.

## 10. Reviewer notes (free-form)

Anything the checklist didn't capture, tone drift the editor should watch for, an unexpectedly strong angle that could be leaned into harder, a concern that doesn't fit a table row.

`<free text or "None">`
