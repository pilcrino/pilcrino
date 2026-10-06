---
name: review-blog-post
description: Run a deliberately critical, checklist-driven review of a blog post draft against the approved outline, curated facts, and this blog's standards docs. Produces {drafts_dir}/<slug>/review.md per the resolved template `review.md`, a structured audit with verdict (approve / request_revisions / reject), a verbatim revision prompt for the writer, and a Specific Issues table. Invoked by the blog-post-workflow skill during Stage 3b, but also invokable standalone on any draft that has outline + facts on disk. Independent of the writer, this is the skill that catches what the writer missed.
argument-hint: "<slug> <iteration> [draft-v<N>]"
allowed-tools: Read, Write, Glob, Grep, Bash
---

# review-blog-post

Reviews a blog post draft against the full rule set. Deliberately critical, a lenient review is worse than no review because it passes sloppy work through.

## When to invoke

- **Stage 3b of `blog-post-workflow`**, after `blog-writer` produces `draft-v<N>.md`; the editor runs this skill, reads the produced `review.md`, and dispatches either approve / revise / reject.
- **Standalone**, on any draft where `{drafts_dir}/<slug>/outline.md` + `{drafts_dir}/<slug>/facts.md` exist on disk. Useful for sanity-checking a draft you wrote by hand, or re-reviewing after manual edits.

## Arguments

- `<slug>`, required. The draft directory name under `{drafts_dir}`.
- `<iteration>`, required. The current review pass number: `1` for the first review, `2`/`3` for a re-review after a revise pass. Drives the escalation check in Step 4 and is echoed into `review.md`'s iteration counter.
- `[draft-v<N>]`, optional. Which draft version to review. Default: the highest-numbered `draft-v*.md` in `{drafts_dir}/<slug>/`.

## Design principle: be critical

The review skill and the writer must not share a bias. If the writer invented a stat (and marked it `[VERIFY:]`), the writer thinks it did the right thing, but the review should still flag whether the surrounding sentence works WITHOUT the stat, in case the human can't verify it in time.

Concrete posture:
- **Cite every concern to a specific line.** Vague reviews get ignored.
- **Distinguish severity**, critical / major / minor. A `critical` alone forces `request_revisions`.
- **Name strengths too.** If the review only lists problems, the writer deletes strong sections on the revise pass. Call out what NOT to change (§8 of `review.md`).
- **Default to `request_revisions`, not `approve`.** `approve` requires all checklist passes green AND zero critical issues. Anything else is `request_revisions`. Only declare `reject` when the draft is structurally broken (missing frontmatter, half the outline unwritten, wrong topic), not for tone issues.

## Tool access

- `Read`, draft, outline, facts, brief, standards docs, profile docs, resolved template
- `Write`, `{drafts_dir}/<slug>/review.md`
- `Glob`, find draft versions
- `Grep`, forbidden phrases, markers, unsourced claims
- `Bash`, `wc -w` for word count; never for fetching or mutation outside `{drafts_dir}/<slug>/`

No MCP. No Chrome. No curl.

## Workflow

### Step 1, Resolve inputs

1. Verify `{drafts_dir}/<slug>/` exists. If not: stop, report "draft directory not found".
2. If `<draft-vN>` was passed: verify the file exists. Else: `Glob` the latest `draft-v*.md` (highest N wins).
3. Verify required inputs:
   - `{drafts_dir}/<slug>/outline.md` (must have status `approved`)
   - `{drafts_dir}/<slug>/facts.md`
   - `{drafts_dir}/<slug>/brief.md`
   - `{drafts_dir}/<slug>/research/serp.md` (needed for §3.5 forbidden-link cross-reference)
   - the resolved template `review.md`
   - `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` (the base §Forbidden phrases list drives §1.1; §Humanization floor drives §6)
   - `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` (the §Authoritative-site allowlist + §Forbidden external links rules drive §3.5; §Placeholder marker shapes drives §4.4; the module-wrapped §Competitor pricing and feature claims + §Own-product pricing claims drive §3.6/§3.7/§3.9)
   - `{profile_dir}/voice.md` (§Additional forbidden phrases extends §1.1; §Additional allowlist domains extends §3.5)
   - `{profile_dir}/authors.md` (author-voice notes drive §1.6)
   - `{profile_dir}/audience.md` (if it defines this blog's own niche-jargon translation list, feeds §1.7)
4. If any missing: stop with a clear report.

### Step 2, Read everything into working memory

Read the draft, outline, facts, brief, standards docs, profile docs, and the review template. Note `author_voice` from `brief.md`, subsequent checks depend on it.

### Step 3, Objective checks (§ numbers map to `review.md` sections)

Run these in order. Record each result for the output file.

#### §1 Voice + tone

1. **Forbidden-phrase grep, dual-sourced.** Grep the draft against BOTH `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` §Forbidden phrases AND `{profile_dir}/voice.md` §Additional forbidden phrases. For each phrase from either list that appears:
   ```
   Grep: pattern="<forbidden phrase>", path=<draft path>, output_mode=content, -n=true
   ```
   Record every hit with line number. If any hits exist → §1 fail.
2. **Em-dash hunt (zero tolerance).** Per `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` §Forbidden characters, em-dashes are a character-level forbidden mark. Grep:
   ```
   Grep: pattern="—", path=<draft path>, output_mode=content, -n=true
   ```
   Every hit is a §1 fail automatically. Each one must be added to the Specific Issues table with severity `major` and a fix instruction specifying the replacement (period / comma / colon / parens). A single em-dash forces verdict `request_revisions` (or `approve` becomes unreachable).
3. **En-dash validity.** Grep for `–` (U+2013). For each hit, verify the surrounding context is a numeric range (digits or range-words like `8th` / `9th` on both sides). Mid-sentence en-dashes acting as a break are flagged in Specific Issues with severity `minor` and treated the same way in the revise prompt.
4. **First-person check.** Grep for `\b(one could|one should|users are|stakeholders)\b`. Any hit is a likely third-person drift. Also grep for passive markers like `\bwas (scanned|checked|monitored|built)\b`. Flag per occurrence.
5. **Burstiness inspection.** For each H2 section: extract its body text, compute sentence lengths (split on `. ? !`), flag any section where stddev of sentence length is < 4 words (uniform, an AI tell).
6. **Author voice match.** Cross-reference `brief.md` → `author_voice` against `{profile_dir}/authors.md`: read the matching author entry (or, for `author_voice=we`, the co-signed-voice notes in the same file) for tone, sentence-length defaults, and reading level. Flag any section where the draft's tone visibly drifts from that entry (e.g., a personal-voice author reading as stiff generic marketing copy, or a `we` voice slipping into a single-narrator "I" voice), citing a specific line.
7. **Intro jargon check** (per `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` §Insider-jargon translation). Extract the intro paragraphs (between the closing frontmatter `---` and the first `## ` heading). Grep for niche-jargon patterns: the SEO/marketing examples in that section (`share a SERP`, `same SERP`, `funnel`, `top of funnel`, `bottom of funnel`, `featured snippet`, `rich snippet`, `E-E-A-T`) as a baseline, plus any additional jargon patterns `{profile_dir}/audience.md` defines for this blog's own niche. Unless `{profile_dir}/authors.md` says the selected author's voice keeps jargon in the intro (an insider-audience posture), each hit in the intro is a `major` issue. Fix instruction: "translate to plain English in the intro, OR move the technical depth out of the intro into a body section that earns it."

   <!-- module: product -->
8. **Product code-literal grep against the body** (only when `modules.product` is on). Read `{profile_dir}/product.md`. Extract every backticked literal that looks like an internal code constant (snake_case identifiers, status-enum strings, table/component names). Grep the draft body for those literals. For each hit that's NOT inside a fenced code block AND has no definitional anchor the first time it appears (e.g., `the \`link_classification\` table, which tracks...`): flag as `major` for a body that should stay user-facing, or `minor` when the literal appears with a definitional anchor.
   <!-- /module -->

9. **Intro-hook over-anchoring.** When the intro uses a time-bound event hook (e.g., a price hike, a recent launch, a news peg), the rest of the article should stand on its own. Procedure:
   - Identify the intro's hook noun phrase (e.g., "October 2025 price hike", "the recent launch", "the new policy"). If no clear event-anchored hook, skip this check.
   - Grep the body for repeats of that phrase or close paraphrases ("after the hike", "post-launch", "since the change").
   - Each repeat after the intro in section openers, H2 / H3 headings, or the outro is a `minor` issue. Fix: "the hook stays in the intro; reframe section openers to the underlying value rather than the time-bound event. The post should still read in 12 months when the event is no longer recent."

#### §2 Structure

1. **Frontmatter validity.** Read the frontmatter template file specified in `publish.<adapter>.frontmatter_template` (each adapter's config block). Verify every required field from that template is present and filled (each template defines its own set), and verify the FAQPage schema mechanism the template describes is present (Starlight: `head[]` JSON-LD script; astro-content: the `<!-- schema:faq -->` body marker; wordpress-rest: no JSON-LD requirement at the adapter level, skip this sub-check). Missing/invalid → §2 fail + mark in Specific Issues.
2. **Title + slug + meta match outline.** Extract `Final title`, `Final slug`, `Final meta description` from `outline.md`. Compare to frontmatter. Any mismatch → §2 fail.
3. **H2 order diff vs outline.** Extract `## ` headings from the draft (in order). Extract `### H2 N:` headings from `outline.md`. Diff. Any addition / removal / reordering → §2 fail + record the delta in Specific Issues.
4. **Intro structure.** Count paragraphs between frontmatter end and first `##`. Expect 2–4 paragraphs, each 1–3 sentences. Count internal links in the intro (links to another post on this blog, root-relative `{route_prefix}<slug>` — trailing slash iff `blog.trailing_slash: true`). Expect ≤2; ≥3 intro internal links (a "see also / check this and this" stack) is a `major` issue, fix: "distribute internal links into the body sections each is contextually relevant to per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Internal linking; keep ≤2 in the intro." Also grep the whole body for an absolute cross-post link (`https?://(www\.)?<blog.url host>{route_prefix}...`); any hit is `major`, fix: "internal blog links are root-relative `{route_prefix}<slug>` (trailing slash iff `blog.trailing_slash: true`), never absolute."
   Then two anatomy checks per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Intro structure: (a) take the first forty words of the body (after the frontmatter) and confirm the outline P1 "Direct answer" clause appears in them, else `major`, fix: "move the direct answer into the hook's first sentence"; (b) read `outline.md` §Intent: when it is `transactional`, `comparison`, `review`, `how_to`, `data_driven` or `informational_pillar`, the first `## ` heading of the body must be `Key takeaways` with 3–5 bullets, each carrying a number, a name or a recommendation, else `major`; when it is `problem_solution` the block is optional and its absence is not an issue.
5. **FAQ set + CTA placement.** Count `### ` under `## FAQ`. Compare to the outline FAQ items count. Must match exactly. For adapters that emit a JSON-LD `mainEntity` array (Starlight), diff its `.name` count against the `### ` count, must match; for adapters without one, skip that half of the check. The FAQ must be the LAST block: any prose after the final FAQ answer (e.g., a trailing CTA) is a `major` issue, fix: "move the conclusion/CTA to immediately before `## FAQ`; nothing follows the FAQ per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Conclusion / CTA." Also verify the closing CTA links this blog's CTA target from `{profile_dir}/blog.md` with an action anchor (not the bare homepage); a CTA missing the action anchor / link is a `minor` issue.

#### §3 Facts + sourcing

1. **Unsourced numeric claims.** Grep the draft body for `\b\d+\b` (numbers) that aren't part of a citation link or a code block. For each hit: check if the surrounding sentence either (a) links to a domain that appears in `facts.md`, or (b) has a `[VERIFY: ... | source: ...]` marker on the line, or (c) the number itself is in `facts.md` §Statistics. If none: flag as unsourced.

   <!-- module: competitors -->
2. **Competitor mentions.** Grep the draft for competitor names listed in `facts.md` §Competitor facts. For each mention: confirm the surrounding context has a "Best suited to" sentence or an "X does Y well" framing plus a stated trade-off, not a bare dismissal. Flag any bare dismissals.
   <!-- /module -->

2a. **Comparison anatomy** (intent `transactional`, `comparison` or `review` per `outline.md` §Intent, or any draft with a comparison table naming this blog's product; runs with or without the competitors module). Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Comparison posts:
   - Grep the draft for the "How we compared" H2 (`^## .*[Hh]ow we compared`, or the heading the outline's methodology block names; intent `review` may call it "How I tested"), before the first option H3 (transactional), the first criterion H2 (comparison) or "What works" (review). Missing or misplaced → `major`, fix: "add the methodology H2 from the outline in that place, opening with the disclosure line."
   - When `modules.product` is on, the methodology section's first sentence is the disclosure line (from `{profile_dir}/voice.md` §Disclosure line, else "I build [product], so weigh this accordingly."); for intent `review`, only when the draft names this blog's product. Missing when required → `major`; its absence is not an issue when `modules.product` is off.
   - "Best suited to" plus at least one downside: transactional, every option H3; comparison, every H3 under "Who should pick which"; review, the reviewed product under "Who it is for", and this blog's product when named. Each missing one → `major`.
   - Scan every markdown table cell (lines starting with `|`) for adjectives in place of facts: `most affordable`, `cheapest`, `powerful`, `best in class`, `robust`, `seamless`, `easy`. Each hit → `major`, fix: "replace with the number, plan name, yes/no or date from facts.md."
   - When `modules.product` is on, the product appears as an option in the table (row or column); missing → `major`. N/A for a review with no comparison table of options (for example in its alternatives section), or with the module off; a table of the reviewed product's own plans is not one.

   <!-- module: product -->
3. **Own-product mention audit.** Grep the draft for this blog's own product/brand name (from `{profile_dir}/product.md`), case-insensitive. Count hits. For each, test the "deletion rule" heuristically: is the sentence still readable if the product name is removed? If yes and there's no product-specific context tethering the mention, flag as likely stuffing. 3–5 mentions is normal; >8 is usually stuffing.
   <!-- /module -->

4. **Target keyword density.** Grep for the target keyword from `brief.md`. Count body hits. Flag if <2 (under-optimized) or >8 (stuffed).
5. **Forbidden external links to SERP competitors.** Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Forbidden external links, linking to a top-10 SERP URL passes equity to direct ranking competitors. Procedure:
   - Read `{drafts_dir}/<slug>/research/serp.md` §"Selected results analyzed". Extract every URL listed there. This is the forbidden set.
   - Read `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Authoritative-site allowlist AND `{profile_dir}/voice.md` §Additional allowlist domains. Extract every domain (or domain class) from BOTH. This is the allowlist.
   - Grep the draft for `https?://[^\s)"']+`. For each external link the draft renders:
     - If the host matches a forbidden URL AND the host is NOT on either allowlist → flag as `critical` (forces `request_revisions`). Fix instruction: "replace with the primary source the competitor cites (see `research/serp.md` §"Citations harvested from competitors" row N) OR mark `[EXTERNAL_LINK_NEEDED:]` with a primary-source class."
     - If the host matches a forbidden URL AND the host IS on either allowlist → no flag, allowlist exception is intentional.
   - Record the per-link verdict in §3 of the review. **This check runs regardless of which modules are on**, it is never module-gated.

   <!-- module: competitors -->
6. **Competitor pricing/feature freshness.** For every row in `facts.md` §Competitor facts cited in the draft, verify `Last verified` is ≤14 days from today (`date +%s` minus the row's epoch ≤ 14 × 86400). Stale rows the draft still cites = `critical`. Fix instruction: "refresh the corresponding profile in `{competitors_dir}/<slug>.md` per `{competitors_dir}/methodology.md`, then re-cite the fresh value here." Also grep the draft body + FAQ for a `verified`-date stamp (e.g. `verified 20`, `(verified <date>)`): the `Last verified` date must never appear in reader-facing prose, any hit = `minor`, fix: "delete the verified-date stamp; it belongs in facts.md only."
7. **Forbidden `[VERIFY:]` for competitor pricing/features.** Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Competitor pricing and feature claims, the writer may NEVER mark a competitor's price or feature as `[VERIFY:]`. Grep the draft for `[VERIFY:` lines. For each: if the claim references a competitor name from `facts.md` §Competitor facts AND the claim is about pricing or features, flag as `critical`. Fix instruction: "remove the `[VERIFY:]` marker; either cite a fresh `facts.md` Competitor facts row or escalate to refresh the competitor profile."
   <!-- /module -->

8. **Invented-number check.** Numeric ranges and "N+" patterns must trace to `facts.md` or carry a `[VERIFY:]` marker. Grep the draft body for:
   - Audience-size ranges: `\d+K to \d+K`, `\d+,?\d{3} to \d+,?\d{3}`, `\d+K-\d+K`
   - "N+" adoption claims: `\d+\+ ` followed by a domain noun
   - Migration / volume ranges: `moving \d+ to \d+ `, `cataloging \d+\+ `
   For each hit: cross-reference against `facts.md` §Statistics + §Product facts + §Competitor facts. If the bracket isn't sourced AND there's no `[VERIFY:]` marker on the line → flag as `critical`. Fix instruction: "replace with general phrasing OR cite a facts.md row OR add `[VERIFY:]` with a source clause. Fake precision is forbidden."

   <!-- module: product -->
9. **Own-product pricing claims.** Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Own-product pricing claims, blog posts must never state this blog's own specific price, dollar amount, usage cap, or feature-by-tier breakdown. Grep the draft for dollar-amount patterns (`\$\d`) and usage-cap phrasing ("free up to", "N units per month", "<tier> at \$") near this blog's product name. Any hit is `major`. Fix instruction: "remove the specific number, reword to a durable framing (`free plan` / `paid plan unlocks more`), and link to the pricing page from `{profile_dir}/product.md` if pricing must be discussed."
10. **Soon-to-ship feature gap check.** Read `brief.md` §"Soon-to-ship features". For each listed feature, grep the draft for language framing it as a current gap or absence (e.g., "we don't yet support X", "X is missing"). Any hit is `major`. Fix instruction: "remove the gap callout per brief.md soon-to-ship list; treat the feature as available or imminent, not missing."
    <!-- /module -->

11. **Information gain survived.** Read `outline.md` §Information gain placement. Grep the draft's named H2 for the element (the table, the quoted sentence, the screenshot placeholder description or the paragraph's key phrase). Missing or moved to a different section without reason → `major`, fix: "restore the information gain element from the outline into `<H2>` as `<form>`."

#### §4 Markers + placeholders

1. Grep for each marker shape:
   - `\[VERIFY:`, count
   - `\[EXTERNAL_LINK_NEEDED:`, count
   - `\[INTERNAL_LINK_NEEDED:`, count
   - `\[IMAGE:`, count
2. Count outline image slots (grep `outline.md` for `[IMAGE:` and "Image placement plan"). Compare to draft `[IMAGE:` count, must match.
2a. **Featured-image hygiene:** for each `[IMAGE:]` placeholder in the draft, check whether `Suggested filename: featured.<ext>` appears OR the concept matches the outline's featured-image concept. If yes → `major` issue. Fix instruction: "the featured image is rendered only via the post's frontmatter cover-image field (a banner above the title, per the publish adapter's convention); delete this inline `[IMAGE:]` placeholder so the post does not render the same asset twice."
2b. **Image-placement hygiene:** for each `[IMAGE:]` placeholder, check whether the line *immediately following* it is an H2/H3 heading (`^## ` or `^### `). If yes → the image sits *before* a heading, not *after* one. That is allowed only when the image closes evidence cited in the prior section's prose; otherwise → `minor` issue. Fix instruction: "move the placeholder to *after* the next heading + its first body paragraph, unless the image illustrates evidence cited in the paragraph above it."
2c. **Table-redundant chart:** for each `[IMAGE:]` placeholder whose `Type:` is `remotion` and whose description reads as a chart/data visualization, check whether a markdown table (lines starting with `|`) appears within ±20 lines of the placeholder. If yes → `minor` issue. Fix instruction: "the adjacent markdown table already renders as SERP-eligible HTML; drop this chart placeholder unless the chart adds something the table can't (color coding, callouts, computed totals, derivative chart shape)."
2d. **Values in text:** for each `[IMAGE:]` placeholder whose description names numbers, percentages, prices or labelled values, confirm those values appear as text in the same section: the paragraph before the placeholder, a caption line after it, or a markdown table within the same section counts. Alt text does not. Missing → `major`, fix: "state the values in the sentence before the image or add a one-line caption under it; crawlers read text, not pixels (`${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Data in images)."
3. Grep for off-shape markers the Phase 4 grep won't catch: `\[Verify:` (lowercase v), `\[EXTERNAL_NEEDED:`, stray `TODO:`, `[TBD]`, etc. Flag every non-canonical marker.
4. **`[VERIFY:]` source-clause validation** (per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Placeholder marker shapes). For every `[VERIFY:]` hit:
   - Verify it contains the literal ` | source:` separator. Missing → `major` issue. Fix instruction: "add `| source: <where you found this>` to this marker; honest values include raw file paths, research analysis sections, near-match facts.md rows, or 'writer's general knowledge, no source'."
   - Verify the text after `| source:` is non-trivial: not blank, not the literal string "TBD", not a repeat of the claim text, not a placeholder like "see context". Trivial source clauses → `major` issue with the same fix instruction.
   - Cross-reference the source clause if it names a file: if the source is `_raw/<file>.json` or `research/<file>.md §<section>`, optionally `Glob` to confirm the file exists. If it doesn't, flag `minor` (the source attribution may be wrong even if the marker shape is valid).

#### §5 Word count

```
Bash: wc -w <draft path>
```

Measure **body prose only**: everything after the closing frontmatter `---`, from the intro through the end of the closing CTA, **excluding the `## FAQ` block** (FAQ length is schema-driven, not prose, and the outline roll-up counts it separately). Do not count frontmatter or the FAQ. Compare to the outline roll-up "Total estimate" (which uses the same basis). Compute delta %.

Three bands (kept in sync with `templates/review.md` §5 and the Step 4 verdict tree below):
- **Within ±10%:** §5 passes cleanly. No issue logged.
- **Beyond ±10%, up to ±15%:** §5 still counts as a pass for the "all §s pass" verdict gate (Step 4). Log a `minor` issue in §7 with a trim/expand note: state the delta %, the outline roll-up target, and which sections (per the outline's per-section breakdown) run over/under. Being `minor`, this does NOT by itself block `approve` (Step 4 only requires 0 critical + 0 major issues) — use reviewer judgment to escalate the issue's severity if the overage compounds with another quality problem (padding, repetition, thin sections).
- **Beyond ±15%:** §5 fails outright and independently forces `request_revisions` per Step 4's forcing-condition list, regardless of any other section's outcome.

#### §6 Humanization floor

Derive from the §1 + §2 + §3 results, per `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` §Humanization floor:
- Forbidden phrases = 0? (§1.1)
- First person throughout? (§1.4)
- Rhythm marker in every H2? (§1.5 + bullet list / standalone question presence check)
- ≥1 bullet list per ~300 words? Count `^- ` bullets vs word count.
- ≥1 standalone-question paragraph per major section? Grep for `^<question sentence>?\n\n` pattern in each section.
- ≥1 concrete number or named example per major section? Derived from §3.1 pass locations.
- Em-dash overuse? Count `—` occurrences. Flag if >1 per ~300 words.

### Step 4, Compose verdict

Verdict decision tree:

- **Any critical issue** (missing frontmatter, >50% of H2 order wrong, unwritable sections, wrong topic) → `reject`.
- **Else any §2 structural delta** OR **forbidden-phrase hits** OR **unsourced numeric claims** OR **word count outside ±15%** (§5's three bands: within ±10% passes cleanly, beyond ±10% up to ±15% is logged as a `minor` issue only and does NOT land in this branch, beyond ±15% forces this branch regardless of other sections) OR **any forbidden-SERP-competitor external link** (§3.5, unconditional) <!-- module: competitors --> OR **stale competitor pricing/feature** (§3.6) OR **`[VERIFY:]` on competitor pricing/features** (§3.7) <!-- /module --> OR **missing `| source:` clause on any `[VERIFY:]`** (§4.4) → `request_revisions`.
- **Else all §s pass** AND **0 critical + 0 major issues** → `approve`.

Iteration counter: the caller passes `<iteration>` (1 for first review, 2 for review of draft-v2, 3 for review of draft-v3). If iteration > 2 AND verdict would be `request_revisions`: the editor should escalate to the human (this skill still writes the review; the escalation is the editor's responsibility).

### Step 5, Write `review.md`

1. Read the resolved template `review.md` for the exact heading structure.
2. Create `{drafts_dir}/<slug>/review.md` following the template. Fill every section. No remaining `<placeholders>`. Use `N/A` for sections that don't apply (e.g., §9 writer instructions when verdict is `approve`).
3. **§7 Specific Issues table** must cite a line number for every row. Severity ranking: critical > major > minor.
4. **§9 writer instructions** (only when verdict = `request_revisions`) must be a copy-paste-ready block, the editor feeds it verbatim to the blog-writer's `mode=revise` prompt.
5. **§8 strengths** must name three concrete things. Not "the intro is good", something like "the P2 expertise statement cites the specific data point from facts.md row 3, don't remove that."

### Step 6, Return handoff

Return to the editor (≤200 words):

- Verdict + 1-sentence reason
- Counts: critical issues, major, minor; forbidden phrases; unsourced claims; word-count delta %
- Top 3 issues (if any)
- Path to review file: `{drafts_dir}/<slug>/review.md`

Keep the draft content OUT of the return, the review.md is the full artifact.

## Failure handling

- **Missing draft:** stop, report clearly; do not write a review.md.
- **Draft has no body content (just frontmatter):** verdict = `reject`, reason "draft body is empty".
- **Outline status not `approved`:** stop, report "outline.md not approved, review requires an approved outline".
- **Forbidden-phrase list unreadable:** stop, report which of `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` or `{profile_dir}/voice.md` failed to parse.
- **Bash `wc` fails:** continue without the word count check; note `wc -w failed` in §5.

## What this skill does NOT do

- Does not edit the draft, that's the writer's job on `mode=revise`, or the humanize-text skill on final pass.
- Does not spawn subagents, runs inline.
- Does not update `checklist.md`, the editor does that after reading the verdict.
- Does not decide the revision loop, the editor routes on verdict.
- Does not fetch URLs to verify claims, it only checks that claims trace to `facts.md` or a `[VERIFY:]` marker. Human confirms the facts at Phase 4.
- Does not soften its verdict for the sake of progress. A bad draft gets `request_revisions` or `reject` even on iteration 3; escalation is a correct outcome.
