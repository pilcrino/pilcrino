# Blog craft

Agent-read reference. Structural rules for producing blog posts: post
types, titles, headings, linking discipline, and placeholder markers. Tone
and phrase-level rules live in `writing-standards.md`. Paths route through
the variables defined in
`skills/blog-post-workflow/references/config-schema.md` (`{profile_dir}`,
`{drafts_dir}`, `{content_dir}`, `{assets_dir}`).

## Post type matrix

| Intent | Title formula | Typical length | SERP shape |
|---|---|---|---|
| transactional | `[N] Best [X] Tested and Ranked [Year]` | 2000–3000 words | listicle |
| comparison | `[A] vs [B]: [Key Difference] ([Year])` | 1500 to 2500 words | verdict first, comparison table, one H2 per criterion, "Who should pick which", FAQ |
| review | `[Product] Review ([Year]): [One-line Verdict]` | 1500 to 2500 words | verdict first, how I tested, what it is, pricing, what works, what does not, who it is for, alternatives (links the `alternatives` post when one exists), FAQ |
| how_to | `How to [Verb] [Object]: [N] Simple Steps for Beginners` | 1500–2500 words | numbered steps |
| informational_pillar | `The Ultimate Guide to [Topic] ([Year])` | 3000–5000 words | deep guide |
| data_driven | `We Scanned [N] [Thing]. Here's What We Found.` | 1500–2000 words | data story |
| problem_solution | `Why [Problem] [Verbs] [Outcome] (and What to Do About It)` | 1000–1500 words | narrative |

## Title rules

- 50–60 characters strict. Validate at `https://moz.com/learn/seo/title-tag`
- Target keyword appears first
- Include `best` for any transactional intent. Without it, Google flips to e-commerce SERP. Comparison and review titles do not need `best`.
- Odd number prefix (5, 7, 11) for listicles and ideas posts; even rarely converts as well
- Title case
- No semicolons; no em-dashes in titles

## URL slug rules

- Target keyword only, lowercase, dashes
- No year, no trigger words (no "best", "ultimate", "tested", etc.)
- No stop words when they can be dropped (`and`, `the`, `of` often unnecessary)
- Never changes after publish
- Example: title `7 Best Trail Running Shoes Tested and Ranked 2026` → slug `best-trail-running-shoes`

## Meta description rules

- ≤160 characters
- Optimize for click, not keyword density
- Mirror the intro hook
- First-person voice consistent with body

## Intro structure

Strict 4-paragraph maximum:

1. **Hook** (1–2 sentences): startling stat, interesting question, short personal anecdote. Target keyword appears here. **The direct answer to the target query appears within the first forty words of the body**: for a transactional post, the top pick and the buyer it suits; for a how-to, the outcome and the number of steps; for a data post, the headline number; for a pillar, the one-sentence answer. The hook carries it; no run-up.
2. **Expertise statement** (1 sentence): the blog's authority line, drawn from the credibility message in `{profile_dir}/voice.md` (e.g., "After testing 50 pairs of trail shoes over 200 miles, here's what held up.").
3. **Internal links** (≤2, woven into a sentence, never a "see also / check this and this" list): only the 1–2 related posts that fit the intro's narrative. The rest go in the body section each is contextually relevant to (see §Internal linking).
4. **Preview** (1 sentence): "This guide covers X, Y, and Z."

Paragraph length: 1–3 sentences. Long intros kill bounce rate.

### Key takeaways block

A `## Key takeaways` H2 sits between the intro's preview paragraph and the
first body section for intents `transactional`, `comparison`, `review`, `how_to`,
`data_driven` and `informational_pillar`; `problem_solution` posts may skip it. Three to five
bullets, one sentence each. The first bullet restates the direct answer.
Every bullet carries a number, a name or a concrete recommendation; a bullet
that could open any post on the topic is cut. The block is an H2 in the
outline (`### H2 1: Key takeaways`), so the H2-order check covers it and the
FAQ schema is unaffected. Source: Rob Hoffman's "answer first" rule (bible
§4.3), adopted as a default.

## Heading structure

- H1 = title, emitted by the publish adapter's frontmatter. Never duplicate H1 in body
- H2 = section dividers
  - The intent-specific patterns below apply to the first substantive H2 after the Key takeaways block (§Key takeaways block) and the sections that follow; the Key takeaways H2 and the "How we compared" methodology H2 (a review's "How I tested"; §Comparison posts) keep their fixed names
  - Transactional posts: the first substantive H2 frames the list as a question containing the target keyword (e.g., `What are the best [keyword]?`)
  - How-to posts: H2s are numbered steps
  - Pillars: H2s segment by question (what / why / how / who / when)
- H3 = (a) sub-steps in how-tos, OR (b) product names in comparison listicles
- H4 = rare; useful for LLM citation signals in pillar posts
- Bold text in body: only for epiphany statements or CTAs near buttons. Do not scatter-bold

## Body rules

- Word count matches the post-type matrix above. Longer is not better
- Match top-5 SERP competitor length; if they average 1,800 words, aim 1,800–2,200
- 1–3 sentences per paragraph
- Every H2 section includes at least one bullet list OR one standalone-question paragraph OR one concrete number
- Target keyword appears 2–8 times total (typically 2–5). Stuffing hurts
- Semantic keywords integrated naturally (agents get a semantic list from the research/outline stage)
- Every major numeric claim is either from `facts.md` OR marked `[VERIFY: <claim> | source: <where the writer found this>]` (see §Placeholder marker shapes below)

## Internal linking

- **Link to another blog post → root-relative, canonical form `{route_prefix}<slug>`, with a trailing slash appended iff `blog.trailing_slash: true`** (per `blog.route_prefix`, default `/blog/`, and `blog.trailing_slash`, default `true`, both from `config.yaml`; e.g. `[anchor]({route_prefix}<slug>/)` when `trailing_slash: true`, `[anchor]({route_prefix}<slug>)` when `false`; no domain either way). Never `https://yourblog.com{route_prefix}...`. Link to the app/marketing site (`/signup`, homepage, `/#pricing`) → absolute `https://yourblog.com/...`.
- 3–5 internal links total, each placed in the section where its topic is actually discussed, not stacked in the intro
- At most 1–2 internal links in the intro, woven into a sentence; a bare "see also / check this and this" list is wrong
- Anchor text near-exact-match to the target post's keyword but slightly varied
- Silo direction: secondary posts link UP to pillars more than DOWN
- The first internal link must appear before the first external link
- **Inbound links (existing posts → this one).** Internal linking is two-directional: also pick 1–4 already-published posts that should link TO the new post, each with the specific section + contextual anchor where the link genuinely fits (not a tacked-on "see also"). These are planned in the outline and become action items, since the existing post files are edited at publish time.

## External linking

- 3–5 external links per post
- Link only to highly reputable sources: gov sites, NLM, major publications, official docs
- Anchor text: literal claim being cited (e.g., `50% of readers use X`), not "click here"
- If no reputable source exists, mark `[EXTERNAL_LINK_NEEDED: <claim + suggested source type>]`

### Forbidden external links: top-10 SERP competitors

Do **NOT** link to any URL listed in the post's `research/serp.md` top-10 SERP results. Those pages compete with this blog for the same keyword; linking to them passes link equity to direct ranking competitors.

When a competitor article cites a stat or claim worth using, the workflow is:

1. Open the competitor article (already deep-fetched in `_raw/NN-*.json`).
2. Find the source they cite for the claim (their `externalLinks` field surfaces these).
3. Link to that **primary source** instead, never to the competitor.
4. Anchor text is still the literal claim.

The `blog-researcher` agent surfaces competitor citations in
`research/serp.md` §"Citations harvested from competitors" specifically so
the editor can route around the competitor URL.

If no primary source is available and the only place the claim appears is
the competitor's own article, mark `[EXTERNAL_LINK_NEEDED: <claim>, primary
source not yet found, suggested source type: <type>]` and let the human
resolve at action-items.

### Authoritative-site allowlist (link permitted even when in top SERP)

Linking to these is fine even if they show up in the top-10 SERP, because they're not realistic ranking competitors and they're the canonical source for many factual claims:

- **Government / academic:** any `.gov` or `.edu` domain, NLM, FTC, IRS, Eurostat, official EU/UK/CA/AU regulators
- **Major publications:** NYT, WSJ, Bloomberg, Reuters, BBC, The Guardian, The Economist, Forbes, HBR, The Verge, Wired, Ars Technica, TechCrunch
- **Official platform docs:** developers.google.com, support.google.com, youtube.com (creator/help docs), meta.com, developers.facebook.com, x.com (developer docs), linkedin.com (business/learning docs), stripe.com/docs, shopify.com/docs, aws.amazon.com/docs, cloudflare.com/learning, apple.com (developer docs), associates.amazon.com (Amazon Associates program docs)
- **Major research orgs:** pewresearch.org, statista.com, gartner.com, forrester.com, emarketer.com, nielsen.com, comscore.com, similarweb.com, IAB (iab.com)

Heuristic for sites not on the list: if the domain has a known editorial
brand recognized industry-wide AND its primary purpose isn't ranking for
the same keywords this blog targets, it's likely allowlist-class. When in
doubt, treat it as forbidden and find a primary source instead.

Blogs may extend the allowlist in `{profile_dir}/voice.md` §Additional allowlist domains.

<!-- module: competitors -->
### Competitor pricing and feature claims

Any pricing, feature comparison, or "Tool X does Y" claim about a named
competitor MUST trace to a row in `facts.md` "Competitor facts" where
`Last verified` is within 14 days of the post's planned publish date. The
source of truth for these facts is the competitor's profile in
`{competitors_dir}` on the base branch (synthesized profiles refreshed per
`methodology.md`); facts.md inherits each row's
`Last verified` from the source profile. Older rows are stale and not
citable; the human refreshes the source profile per `methodology.md` to
refresh the row.

**Writers may NEVER use `[VERIFY:]` for competitor pricing or features.**
Either the fact is fresh in facts.md (cite it) or the relevant profile has
to be refreshed (it lands on the base branch) before the writer touches
that section. This rule prevents shipping invented prices or features that
changed last quarter.
<!-- /module -->

<!-- module: product -->
### Own-product pricing claims

Never state your own pricing in a post; link to the pricing page instead.
Blog posts MUST NOT cite specific prices, tier names with dollar amounts,
usage thresholds, or per-feature pricing details for your own product
(e.g., never write "$9/mo flat", "Pro tier at $X", "first 1,000 units
free"). Pricing and packaging change as the product evolves; specific
numbers in blog posts go stale and force a content sweep across every post
that named them.

Use durable framings instead:
- "free plan" / "paid plan" / "upgrade to a paid plan": fine
- "the paid plan unlocks more features": fine
- "starts free; paid plans unlock more": fine
- "Pro tier at $9/mo flat": forbidden
- "free up to 1,000 units per month": forbidden

Reviewers flag any specific price, dollar amount, usage cap, or
feature-by-tier breakdown as a `major` issue. The fix is to remove the
number and reword to a durable framing. If a post genuinely needs to
discuss pricing (e.g., a pricing-comparison piece against competitors),
link to the pricing page from `{profile_dir}/product.md` and let the live
page carry the current numbers.
<!-- /module -->

## Comparison posts

Applies to every post whose intent is `transactional`, `comparison` or `review`,
and to any post whose outline has a comparison table naming this blog's
product beside other options. Not module-gated: it holds whether or not `modules.competitors` is
on. Source: Rob Hoffman's page anatomy (bible §4.3), adopted as a default
because it is cheap and matches what the pipeline already half does.

1. **A methodology H2** before the first per-option H3 (transactional), the
   first criterion H2 (comparison) or "What works" (review), titled
   "How we compared" (or the blog's own wording); a review titles it
   "How I tested" or the blog's wording. It names the criteria (price,
   delivery model, who each option is for, plus the product-specific ones
   from `{profile_dir}/product.md` §"Unique-in-category differentiators"),
   how each option was checked (profile date, hands-on test, public docs),
   and the order the criteria were applied in. Three to six sentences, or a
   short bullet list.
2. **A disclosure line** opens the methodology section when the author
   works on the product. In a review, the disclosure applies only when the post
   names this blog's product. Use the line in `{profile_dir}/voice.md`
   §Disclosure line when that section exists; otherwise the default:
   "I build [product], so weigh this accordingly." (a `we` voice writes
   "We build [product], so weigh this accordingly."). One sentence, not a
   boxed disclaimer.
3. **Per option, one "Best suited to" sentence and one trade-off.** In a
   comparison, under "Who should pick which", one H3 per option; in a review,
   under "Who it is for", for the reviewed product, and for this blog's
   product when the post names it. Each
   option's H3 carries a single sentence naming the buyer it fits and at
   least one stated downside. When `modules.product` is on, this blog's
   own product gets the same treatment, downside included. These replace
   the old pros, cons and "best for [segment]" trio.
4. **Table cells carry facts, not adjectives.** Prices, limits, plan names,
   yes or no, dates. "Most affordable", "powerful" and "best in class" in a
   table cell are reviewer `major` issues. Own-product pricing stays out
   per §Own-product pricing claims: the product's price cell links to the
   pricing page.
5. **When `modules.product` is on, the product appears as an option in the table**,
   as a row or a column depending on the table's orientation, never
   implied. A rival vs rival page adds it as a third column. A review needs no
   table. If it has a comparison table of options (for example in its
   alternatives section), this rule applies; a table of the reviewed product's
   own plans is not one. A blog without a product compares
   third-party options only, and items 2, the product half of 3, and this item
   do not apply.

## Information gain

Every plan names the one element on the page that no competing page can
publish, its type, its source and where it lands. Allowed types:

- first-party data marked `derivable` in `{profile_dir}/product.md`
- a screenshot of the product or a competitor in real use
- the owner's own test, with its date and numbers
- a verbatim buyer quote with a link, from `research/reddit.md` or `research/x.md`
- a named expert quote with attribution
- a founder anecdote with specifics from `brief.md`
- the methodology and comparison table built from verified profiles (transactional, comparison and review posts)

**Format alone is not gain.** A video, a testimonial or an infographic that
restates what the SERP already says does not qualify. The test: the element
adds specific, checkable or usable information beyond the competing pages.
Firsthand types (own test, real-use screenshot, founder anecdote) must also
show firsthand experience of what it describes: a test the author ran, a
screen the author captured, an event the author lived through per
`brief.md` §Founder anecdote. Sourced quotes and profile-built comparisons
are judged on their source, not on firsthand experience. Source: Rob Hoffman's information-gain list (bible
§4.4) and the commenters' "format is not information gain" caveat.

## Conclusion / CTA

The closing section sits immediately before `## FAQ`. Rules:

- Link this blog's primary call-to-action (newsletter signup, product
  trial, app download) with an action anchor ("Subscribe for the
  newsletter" / "Start your free trial"), not the bare homepage. The
  specific CTA target and hook live in `{profile_dir}/blog.md`.
- Do NOT re-list features the body already covered. One crisp value line at most.
- ≤2 short paragraphs. Durable framing only, no invented prices, tiers, or usage caps.

## FAQ block

The FAQ is the LAST block of the post. The conclusion / CTA comes
immediately before `## FAQ`; nothing follows the FAQ.

Required at the bottom of every post:
- `## FAQ` heading
- 3–5 Q/A pairs
- Questions in the form readers actually ask (not keyword-stuffed)
- JSON-LD FAQ schema, emitted per the publish adapter's frontmatter template

## Image count

Every post targets **1 featured image** plus **3–5 in-post images**. Stage 2
(Outline) plans slots against this target in its "Image placement plan"; Stage
4a (`${CLAUDE_PLUGIN_ROOT}/skills/suggest-images/SKILL.md`) fills in the
per-slot type, concept, and production spec. See that skill for type
selection and alt text, `${CLAUDE_PLUGIN_ROOT}/adapters/images/<type>.md` for
per-type production specs.

### Data in images

Any number, label or data value an image shows
must also appear as text in the same section: in the paragraph before the
image, in a markdown table in that section, or in a caption line under it. Alt text does not count.
Crawlers and assistants read the text, not the pixels. This complements the
table-redundancy rule: a chart that repeats a table is still banned; a chart
that carries numbers the prose does not state is incomplete.

## Placeholder marker shapes

Phase 4 (action-items compile) greps for these literal shapes. Use them
exactly. Any deviation (lowercase, missing colon, extra space) makes the
marker invisible to the grep.

| Marker | Shape | When to use |
|---|---|---|
| `[VERIFY:]` | `[VERIFY: <claim> \| source: <where the writer found this>]` | Numeric or factual claim the writer couldn't trace to a `facts.md` entry. Writer must always include the `\| source:` clause. |
| `[EXTERNAL_LINK_NEEDED:]` | `[EXTERNAL_LINK_NEEDED: <claim + suggested source type>]` | Claim that needs a reputable external link when no `facts.md` row covers it. |
| `[INTERNAL_LINK_NEEDED:]` | `[INTERNAL_LINK_NEEDED: <topic>]` | Internal-link slot where the existing-posts research didn't offer a fit. |
| `[IMAGE:]` | `[IMAGE: <description of what to capture>. Type: <type>. Suggested filename: <name>.png]` | Image slot the outline earmarked; the production spec required for each type is defined by that image type's adapter. |

### `[VERIFY:]` source clause: what to put after `| source:`

The point of the `| source:` clause is so the human reviewing
`action-items.md` knows where the claim originated and how easy it is to
verify. Be honest. Acceptable values:

- A specific raw research file: `_raw/02-example-com.json` (then the human can grep for the surrounding context)
- A specific section of an analysis file: `research/serp.md §"Use-in-post facts" row 4`
- A near-match `facts.md` entry the writer didn't want to cite verbatim: `facts.md Statistics row 3 (related but not exact)`
- A voice-of-customer source: `research/reddit.md thread r/foo "/r/foo/comments/abc123"`
- An honest disclaimer: `writer's general industry knowledge, no external source` or `outline implied this number, no source attached`

If the writer puts `source: <claim text again>` or leaves the source
blank, the reviewer flags it as a `major` issue. The clause is
non-optional.

### Why the source clause exists

Without it, the human at action-items spends 10 minutes per `[VERIFY:]`
figuring out where the writer might have found the claim before they can
verify it. With the source clause, verification is 30 seconds: open the
file, find the line, check it. If the source is "writer's general
knowledge", the human can decide quickly to either find a real source or
kill the sentence.

## Frontmatter

Frontmatter: per the publish adapter's frontmatter template named in
`config.yaml publish.<adapter>.frontmatter_template`.

## Quality gates (self-check before submitting to human)

- [ ] Title 50–60 chars
- [ ] `best` appears in title if transactional
- [ ] Slug is target keyword only, no year, no trigger words
- [ ] Meta description ≤160 chars
- [ ] Intro is 2–4 paragraphs, 1–3 sentences each
- [ ] Intro: hook + target keyword (first 1–2 paras) + expertise statement + ≤2 contextual internal links + preview; remaining internal links distributed into relevant body sections
- [ ] Direct answer to the target query within the first forty words of the body
- [ ] `## Key takeaways` block after the intro with 3–5 concrete bullets (transactional, comparison, review, how_to, data_driven, informational_pillar; optional for problem_solution)
- [ ] comparison and review posts follow their shape in the post type matrix
- [ ] Conclusion/CTA sits immediately before `## FAQ` (nothing after FAQ); links the CTA target from `{profile_dir}/blog.md`, no feature re-list
- [ ] Body word count matches post-type matrix
- [ ] Target keyword appears 2–8 times
- [ ] 3–5 external links, anchor = literal claim, first body link is internal
- [ ] No external link points to a URL in `research/serp.md` top-10 (unless on the authoritative-site allowlist)
- [ ] Every major numeric claim has a source or `[VERIFY: <claim> | source: <where>]` marker (the `| source:` clause is mandatory)
<!-- module: competitors -->
- [ ] Every competitor pricing/feature claim traces to a `facts.md` "Competitor facts" row with `Last verified` ≤14 days from the post date
<!-- /module -->
- [ ] No forbidden phrases from `writing-standards.md` or `{profile_dir}/voice.md`
- [ ] First person, active voice
- [ ] Burstiness present in every section
- [ ] Image placeholders use the standard format
- [ ] FAQ block present; JSON-LD schema per the publish adapter's frontmatter template
- [ ] Competitor mentions honest, framed per `{profile_dir}/voice.md`
