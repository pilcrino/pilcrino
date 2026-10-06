# Brief: <slug>

Written by: blog-editor (Stage 0 intake).
Sourced from: human conversation during intake.
Read by: all subsequent agents (researcher, editor in later stages, writer).

## Topic / Target Keyword

<the exact keyword this post targets>

## Category

<the category this post ships under, resolved against `{profile_dir}/site-conventions.md` §Categories when that file exists — the per-cluster mapping table there (cross-referenced against `{profile_dir}/blog.md` §Content pillars) proposes a match, the human confirms or overrides with an existing taxonomy name or an explicit "create new: `<name>`". Free-text (whatever the human states, or "none") when `site-conventions.md` doesn't exist yet for this blog. Carried unchanged through `plan.md` and `outline.md`; resolved/created as a WordPress term and set on the post at `adapters/publish/wordpress-rest.md` §Staging so the post never ships as "Uncategorized" when a category was planned here.>

## Intent

<one of: transactional | comparison | review | how_to | informational_pillar | data_driven | problem_solution>

## Audience emphasis

<segment per `{profile_dir}/audience.md`>

## Research sources enabled

<editor sets at intake based on human's choice; default `serp` only>
- serp: yes (always)
- reddit: <yes | no> (only offered if `modules.reddit_research` is true)
- x: <yes | no> (only offered if `modules.x_research` is true)

## Author voice

<author slug from `{profile_dir}/authors.md`, or "we" for co-authored/product-wide content>

Reasoning: <one sentence on why this author fits, per the selection rubric in `{profile_dir}/authors.md`>

## What the human wants to convey

<free-form list of the human's core ideas, angles, gut instincts, what they've noticed, what they believe the post needs to say>
- 

<!-- module: product -->
## Product features to mention

<features the human said should appear in this post; empty if human didn't specify. See `{profile_dir}/product.md` for the full feature inventory.>
- 

## Soon-to-ship features (do NOT flag as gaps)

<features that are actively shipping or imminent that the writer should NOT call out as honest gaps. Empty if none. The writer treats these as "available or imminent," not missing; the reviewer enforces. Example: "dark mode, shipping next sprint, don't list it as a gap.">
- 

## First-party data points to include

<concrete first-party data the human wants cited, e.g., "we tested X products and found Y%". Match against `{profile_dir}/product.md` "First-party data availability" table, only `derivable` data is safe to cite without further verification.>
- 
<!-- /module -->

<!-- module: competitors -->
## Competitors to mention (honestly)

<competitor tools that must be discussed in the post; empty if not a comparison post.
Every competitor named here must already exist as a profile in
`{competitors_dir}/` (the source of truth for competitor pricing and
features) and must have `**Last verified:**` within 14 days of today.

The editor validates these constraints at Stage 0 intake and HARD-HALTS if a
named competitor is missing a profile or its profile is stale. Profiles are
refreshed per `{competitors_dir}/methodology.md`; this workflow does
NOT fetch pricing pages live, that's the methodology's job.>

| Name | Profile path |
|---|---|
| <e.g. Acme Tool> | {competitors_dir}/acme-tool.md |
| <competitor 2> | {competitors_dir}/<slug>.md |

If the human names a competitor that has no profile yet, the editor halts
intake and asks them to add a profile per `methodology.md` (template at the
bottom of that file) before the post can move forward. If a profile exists
but is older than 14 days, the editor halts and asks them to refresh it
in-place per `methodology.md`. Either way, the workflow does not paper
over a missing or stale profile.
<!-- /module -->

## Avoid list

<things the human said the post should NOT include>
- 

## Founder anecdote / story

<any personal story from the selected author (per `{profile_dir}/authors.md`) the human wants woven in; empty if none>

## Internal link targets

<existing published blog posts this new one should link to; slug + topic each>
- 

## Source URLs for researcher to study

<specific competitor URLs / articles the human wants the researcher to study; empty to let researcher find their own>
- 

## Other notes

<anything else from the intake conversation that affects how the post should be written>

---

## Metadata

- Created by: blog-editor
- Created at: <YYYY-MM-DD HH:MM>
- Human operator: <name of the human running this workflow>
