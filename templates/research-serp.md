# SERP Research: <target keyword>

Written by: blog-researcher agent, invoked with `source=serp`.
Read by: blog-editor (synthesis stage).
Source: Google SERP via the Pilcrino browser (mcp__plugin_pilcrino_pilcrino-browser__*). Never hallucinate, cite every claim.

## Query metadata

- Search engine: Google
- Query used: <exact query>
- Date searched: <YYYY-MM-DD>
- Top N results studied: <N>
- Browser session: <logged_in | incognito>
- Any SERP features observed: <featured snippet | AI Overview | People Also Ask | Google Shopping | None>

## SERP shape (inferred)

<one of: best-of-listicle | how-to-numbered | definitional | data-driven | mixed | google-shopping-dominant>

Reasoning: <one sentence on why>

If shape is `google-shopping-dominant`: flag to editor that this keyword may not support a blog post.

## Search intent

The OBSERVED dominant intent of the live SERP, derived from what the top results actually are (not the a priori post-type guess). The editor records a provisional read in `_serp_selection.md`; confirm or correct it here from the harvested raw files. Do not invent it.

- Dominant intent: <informational | commercial | comparison | transactional | navigational>
- Evidence: <result types + SERP features observed, e.g. "7 of 8 are best-of listicles, Google Shopping block present, no AI Overview">
- Secondary intent (if any): <intent>, <one-line why>
- Implication for our post structure: <one line, e.g. "comparison intent: lead with a comparison table and per-tool H3s">

## Selected results analyzed

The editor selected up to 8 results from the top-10 Google SERP for deep fetch (rationale lives in `{drafts_dir}/<slug>/research/_raw/_serp_selection.md`). Only those selected results are analyzed below.

### 1. <Exact title from SERP>
- URL: <full URL>
- Domain: <domain>
- SERP rank (1-10): <N>
- DR (if known from Ahrefs extension): <DR>
- Word count (approximate): <number>
- Title formula: <transactional | how_to | informational | data | problem>
- Hook style (opening angle): <summary>
- Top H2/section headings:
  - <H2 1>
  - <H2 2>
  - <H2 3>
- Key data points cited:
  - <stat / quote>
- Strengths (what they do well):
  - <strength>
- Gaps / weaknesses (what they miss):
  - <gap>

### 2. <Title>
(same structure)

(repeat for each selected result, up to 8)

## Title modifier tally

Words appearing across SERP titles, ranked by frequency. Used to infer what modifiers the user's search intent expects.

| Word / Modifier | Count | Notes |
|---|---|---|
| best | <N> | |
| 2026 | <N> | |
| review | <N> | |
| <other> | <N> | |

## Audience inferences

Based on the shape of the SERP and the angle competitors take:

- Primary audience: <segment per `{profile_dir}/audience.md`>, <why>
- Secondary audience: <who else>, <why>
- Reader knowledge level: <beginner | intermediate | advanced>
- Reader intent: <informational | commercial | navigational | mixed>

## Angle opportunities

Gaps competitors leave that this blog can exploit. Each should be an angle this post could take that existing SERP results do NOT.

- <angle opportunity 1>
- <angle opportunity 2>
- <angle opportunity 3>

## Avoid pitfalls

Things the SERP shows are already commoditized or done-to-death. Don't repeat.

- <pitfall 1>
- <pitfall 2>

## Use-in-post facts

Verbatim quotes, concrete numbers, and named examples extracted from the SERP. Editor will curate these into `facts.md`.

Every entry MUST include the source URL.

### Statistics
- <stat>, <exact claim>, source: <url>

### Quotes
- "<verbatim quote>", <attribution>, source: <url>

### Named examples
- <example / case study reference>, context: <one sentence>, source: <url>

## Competitor product mentions

Products / tools that appear across multiple SERP results. Relevant for listicle posts.

| Tool | Mentioned in (# of top results) | Typical positioning |
|---|---|---|
| <tool> | <N> | <best for X> |

## Citations harvested from competitors

Per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §"Forbidden external links", we don't link to top-10 SERP URLs (they're our ranking competitors). Instead, we harvest each competitor article's `externalLinks` field and surface those primary sources here. The editor uses this list when building the outline's external link plan.

Per row: which competitor cited it, the cited URL, the surrounding claim it backs, and whether the URL is on the **authoritative-site allowlist** (`${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §External linking). Mark allowlist matches with `auth_allowlist`; mark all other independently-credible primary sources with `primary_source`. Drop spammy / paywalled / low-credibility outbound links entirely.

| Cited URL | Cited by (competitor URL) | Claim it backs | Classification |
|---|---|---|---|
| <https://primary-source.example/study> | <https://serp-competitor.example/post> | <one-sentence claim from the surrounding text> | <primary_source \| auth_allowlist> |
| <url> | <competitor> | <claim> | <classification> |

If a competitor is the ONLY place a claim appears (no primary source cited), record it here with `Classification: claim_only_in_competitor` so the editor knows to either find a primary source independently OR mark `[EXTERNAL_LINK_NEEDED:]` in the draft. Do not link to the competitor.

## Open questions for editor

Things the researcher couldn't resolve from SERP alone. Editor decides if these need further research or can be ignored.

- <question>
