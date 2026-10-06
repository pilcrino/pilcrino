# Facts: <target keyword>

Curated by: blog-editor (synthesis stage).
Sources: research/serp.md + {profile_dir}/product.md.
Read by: blog-editor during plan creation; blog-writer (Phase 3) during drafting.

**Purpose:** this is the ONLY pool of concrete data the writer is allowed to cite without additional verification. Every fact here has a source. Writer's rule: if a claim they want to make isn't in this file, it gets marked `[VERIFY:]` for the human.

## Statistics

Verified numeric claims. Each line: value + claim + source URL.

- <value>, <claim context>, source: <url>, status: <verified | needs_verification>

## Quotes

Verbatim statements from reputable sources.

- "<quote>", <attribution>, source: <url>

## Named examples

Real case studies or named examples that can be referenced without further verification.

- <example name>, <one-sentence summary>, source: <url>

<!-- module: product -->
## Product facts

Facts about this blog's own product, architecture, or aggregated first-party data. Safe to use without external citation (source is the product's own repo or data).

### Feature facts
- <fact>, source: <repo file path>

### First-party data claims
- <claim>, availability: <derivable | needs_scan | hypothetical>, context: <one sentence>

**Writer note:** only use `derivable` or `needs_scan` facts with explicit grounding in the product's own data. Never use `hypothetical` facts in a published post, those are for brainstorming only.
<!-- /module -->

<!-- module: competitors -->
## Competitor facts

Verified facts about competitor tools (pricing, features, positioning). **Every row's `Last verified` date must be ≤14 days from the post's planned publish date.** Older entries are stale and not citable. The 14-day freshness gate is enforced upstream in two places: Stage 0 intake (when the editor names the competitor) and Stage 1.5c (defense-in-depth re-check before research analysis). If a row's date has aged past 14 days during a paused workflow, the human refreshes the corresponding profile in `{competitors_dir}/<slug>.md` per `{competitors_dir}/methodology.md`, which automatically refreshes the source for these rows.

The canonical source for these rows is `research/competitors.md` §"Ready for facts.md", which the blog-researcher agent populates from `{competitors_dir}/<slug>.md` profiles. Each row's `Last verified` is the profile's `**Last verified:**` value, NOT "today". The editor copies the rows into the table below verbatim and preserves the `Last verified` date.

Writers may **NEVER** use a `[VERIFY:]` marker for competitor pricing or features; per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §"Competitor pricing and feature claims", the only acceptable source is a fresh row in this table. If facts.md doesn't have what the writer needs, the human refreshes the relevant profile in `{competitors_dir}/` before the writer touches that section.

| Competitor | Fact | Source URL | Last verified |
|---|---|---|---|
| <tool> | <fact (e.g., "Pro tier $49/mo, supports 3 team seats")> | <https://competitor.com/pricing> | <YYYY-MM-DD, must be ≤14 days from post date> |
<!-- /module -->

## Rejected / not verifiable

Claims that surfaced during research but couldn't be verified. Writer does NOT cite these. Editor may flag to human for fact-check.

- <claim>, reason rejected: <why>, if ever verified, promote to Statistics section

## Verification key

- ✅ Verified (independent source found)
- ⚠️ Needs verification (surfaced during research but single source)
- ❌ Rejected (couldn't verify; do not cite)
