# Output templates

Three files plus posts added through the console API. Keep each under its
line target. Raw notes go to `research/`, never into these.

## strategy.md (under 180 lines)

```markdown
# <Blog>: content strategy

<date>. Goal: <one sentence: rank on Google and get cited or recommended by AI
assistants for the queries <buyer> runs when <job>>.

Companion files: `<plan file>` (the queue), `competitors.md`. Raw research in
`research/`.

## Method

- <N> Google searches through the logged-in browser: who ranks, People Also Ask,
  related searches, AI Overview presence.
- <N> Reddit threads read in full for pain points in buyers' words.
- <N> competitor homepages and pricing pages.
- No keyword-volume tool. Search scores are judgments from SERP shape.

## Findings

**<Claim>.** <What the SERPs or threads showed, one or two sentences.> <What it
means for this blog, one sentence.>

(at most ten)

## Pillars

| # | Pillar | Owns | Product tie |
|---|---|---|---|
| P1 | <name> | <query themes> | <what the product does here> |

Split: <n> searchable, <n> shareable, <n> experimental. Cadence: <owner's number>.

## Posts, in plan order

All runs. Score = customer impact 30%, product fit 25%, buying intent 25%, ease 20%.
Angles and keywords are in `<plan file>` under the same numbers.

| # | Slug | Pillar | Type | Score |
|---|---|---|---|---|

<Posts that need the owner's own data, one line.>
<Posts that need fresh competitor profiles, one line.>

### Cluster map

P1  <hub slug> (hub) -> <spoke>, <spoke>
P2  ...

Every spoke links to its hub and to one spoke in another pillar.

## Rules for every post

- First paragraph: a 40 to 60 word direct answer to the title query.
- One dated statistic in the first screen. Sources on hand: <list from research>.
- Every post names its buyer or situation in the slug or angle.
- One target query per post; its fan-out sub-questions are H2s.
- Headings, schema and page anatomy: per `standards/blog-craft.md`.
- Forum quotes with links.
- Natural-language slugs that match the query. Alternatives posts at
  `/blog/<x>-alternatives`.
- No "what is X" posts.
- <Wording rules this research found.>
- <Claims the product cannot make yet.>

## Query log

### <date of run 1>
<one query per line>

### <date of run 2>
<one query per line>
```

## competitors.md (under 80 lines)

```markdown
# <Product> competitors

Rewritten <date>. Each price carries the date it was read from the vendor's
pricing page; "unverified" means the page could not be read.

<Product> for reference: <one sentence of price, delivery model, differentiators>.

## Tier 1: closest (write comparison posts against these)

| Competitor | Headline (verbatim) | Price (date) | Why it is close | Evidence | Chosen |
|---|---|---|---|---|---|

## Tier 2: <volume / adjacent>

| Competitor | Headline | Price (date) | Evidence | Chosen |
|---|---|---|---|---|

## Tier 3: <platforms, context only, not visited>

| Competitor | What it is |
|---|---|

## Tier 4: the do-it-yourself alternative

<What buyers say they use instead, one paragraph.>

## Takeaways

- Price range and what the product's price means against it.
- The claim everyone makes.
- What nobody offers.
- <two more>

## Skipped

<competitor: reason (no evidence, below the cap, already has a comparison post), one per line>

## Profiles to run

<names in any post's `competitors` list that have no profile yet, in post order>
```

## Posts (the batch body)

```json
{ "posts": [
  { "title": "<target query>", "slug": "<slug>", "angle": "<Argument. Source to quote. Mechanism the post shows.>", "author": "", "requirements": "Mention: <Competitor A>, <Competitor B>", "pageType": "<alternatives | vs | review | best-for | for-role | export | how-to | other>" }
] }
```

## Chat report (under 25 lines)

- Pillars, one line each.
- Posts added: <n>, slugs.
- First ten posts, slug and one clause.
- Competitors: chosen and skipped with evidence and reason, at most eight lines.
- What the owner must supply.
