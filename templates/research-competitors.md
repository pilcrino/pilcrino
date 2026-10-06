# Competitor Research: <target keyword>

Written by: blog-researcher agent, invoked with `source=competitors`.
Read by: blog-editor at Stage 1c (plan synthesis); rows from "Ready for facts.md" copied into `facts.md` "Competitor facts" verbatim.
Source: per-competitor profiles from the base branch, snapshotted at Stage 1.5c into `{drafts_dir}/<slug>/research/profiles/`. The blog-post-workflow skill validates each profile's `**Last verified:**` is ≤14 days from today at Stage 0 intake AND again at Stage 1.5c (defense-in-depth re-check); the workflow halts if either gate fails. The blog-researcher does NOT browse, does NOT fetch live pricing pages, and does NOT consult any `_raw/` artifacts for competitors: those don't exist in the new flow.

**Freshness contract:** every `Last verified` value in this document is inherited verbatim from the source profile's `**Last verified:**` line. Because Stage 1.5c hard-halted on any profile >14 days old, every row arriving here is by definition within the writer's 14-day-freshness window (per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md`).

This entire template only exists when `modules.competitors` is enabled.

<!-- module: competitors -->
## Competitors covered

The editor named these competitors at Stage 0 intake; the workflow validated each one's base-branch profile is fresh.

| Competitor | Profile path | Last verified | Status |
|---|---|---|---|
| <name> | {competitors_dir}/<slug>.md | <YYYY-MM-DD, from profile> | <ok \| profile_missing \| profile_stale> |

`Status` values:
- `ok`, profile exists and is fresh; pricing/feature facts were extracted from the profile
- `profile_missing`, the brief.md row names a profile missing from the snapshot; the workflow should have halted at Stage 1.5c, surface the gap loudly so the editor doesn't proceed
- `profile_stale`, the profile is older than 14 days; the workflow should have halted at Stage 1.5c, surface the gap loudly

---

## Per-competitor analysis

One block per competitor. Order = order from `brief.md` "Competitors to mention".

### <Competitor name>

**Profile source:** research/profiles/<file> (base branch, commit from the Stage 1.5c log)
**Profile last verified:** <YYYY-MM-DD, copied from the profile's `**Last verified:**` line>
**Status:** <ok | profile_missing | profile_stale>

#### Pricing tiers

If the pricing page lists tiers, capture each one. Numbers are exact, not rounded.

| Tier name | Monthly price | Annual price | Limits / quotas | Key features bundled |
|---|---|---|---|---|
| <e.g. Starter> | <$X/mo> | <$Y/yr> | <e.g. 1,000 units/mo, 1 user> | <bullet list of headline features in this tier> |
| <Pro> | <$X/mo> | <$Y/yr> | <limits> | <features> |

**Free tier?** <yes/no, terms>
**Trial?** <yes/no, length>
**Discounts mentioned on the page?** <yearly discount % | volume discount | none>

#### Headline features (from the profile's "Differentiators they actively market" + "Features" sections)

What the competitor markets as their differentiators. Verbatim where possible (quote in fact rows). Lift these from the profile's per-section content; do not invent.

- <feature 1, with one-sentence framing the competitor uses>
- <feature 2>
- <feature 3>

#### Comparison to our product (no opinion, just facts)

Side-by-side facts that show overlap or gap. Do NOT editorialize ("better", "worse"); just list. This subsection only applies if `modules.product` is also enabled; omit it entirely for competitor-aware blogs with no product of their own.

| Capability | This competitor | Our product (per `{profile_dir}/product.md`) |
|---|---|---|
| <capability 1> | <yes/no, details> | <yes/no, details> |
| <capability 2> | <yes/no, details> | <yes/no, details> |
| <capability 3> | <yes/no, details> | <yes/no, details> |

#### Quotes (for the writer to potentially repurpose)

Verbatim sentences captured in the profile (typically inside the profile's "Headline value prop", "Differentiators they actively market", or "Self-reported metrics" sections) that the writer might want to quote. Each with the source URL the profile recorded for the quote.

- "<verbatim quote>", source: <url, from the profile>

---

(repeat for each competitor)

---

## Ready for facts.md

The editor copies these rows verbatim into `facts.md` "Competitor facts" at Stage 1c. Every row uses **the source profile's `Last verified` date** (NOT "today"). The freshness was already enforced at Stage 1.5c, so any row reaching this section is within the writer's 14-day window.

| Competitor | Fact | Source URL | Last verified |
|---|---|---|---|
| <name> | <one-line fact, e.g. "Pro tier $49/mo, 5,000 units, priority support included"> | <url, lifted from the profile's source citation for that fact> | <YYYY-MM-DD, copied from the profile's `**Last verified:**` line> |
| <name> | <fact 2> | <url> | <YYYY-MM-DD> |

If a competitor's status is `profile_missing` or `profile_stale`, the workflow should have halted at Stage 1.5c and never reached this stage. If a row of this kind is somehow present, mark it explicitly so the editor sees the failure:

| <name> | NO_PRICING_DATA, profile missing or stale; the Stage 1.5c gate failed and the editor must halt before drafting | <profile path or "n/a"> | <YYYY-MM-DD> |

## Open questions for editor

Things the researcher couldn't resolve from the profile alone. Editor decides if a follow-up profile refresh (per `methodology.md`) is warranted before plan review.

- <e.g., "The profile lists pricing tiers but doesn't break down annual-vs-monthly for the Studio tier; the writer can't make a per-month claim without that detail. Refresh the profile or skip the per-month framing.">
- <e.g., "The profile flags one feature as 'NEW!' as of <date>; verify it's still labeled NEW! before quoting the framing in the draft.">
<!-- /module -->
