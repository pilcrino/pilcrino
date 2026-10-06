# Writing standards

Agent-read reference. Generic writing-craft rules every blog built on this
workflow follows. Structural and platform rules for posts (titles,
headings, linking, markers) live in `blog-craft.md`. Blog-specific
personality, credibility, lexicon, and additional forbidden phrases layer
on top via `{profile_dir}/voice.md`.

## Voice, tone, and positioning

Tone, credibility message, lexicon, product-positioning order, and
competitor posture: `{profile_dir}/voice.md`. Per-author voice notes (bio,
expertise, tone, sign-off): `{profile_dir}/authors.md`. If this blog
promotes its own product, mention discipline and positioning live in
`{profile_dir}/product.md` (product module).

## E-E-A-T baseline

Any niche bordering a purchase, health, financial, or safety decision (YMYL-
adjacent, not just classic YMYL topics) needs real trust signals, not just
polished prose. Treat this as the default posture for every post unless this
blog's niche is clearly exempt (confirm in `{profile_dir}/blog.md` if
unsure). Every post needs:

- **A real expertise statement in the intro** — already part of the standard
  intro shape (see `blog-craft.md` §Intro structure and the writer's intro
  paragraph 2).
- **At least one reputable external citation** — already required by
  `blog-craft.md` §External linking (3–5 external links per post, reputable
  sources only).
- **First-party data OR cited external data, never unverified stats
  presented as fact** — the fake-precision doctrine lives in
  `personas/writer.md` hard rule 2 and is checked by
  `skills/review-blog-post/SKILL.md`'s automated-checks step 8 (the
  Invented-number check).
- **A named human byline with a role** — frontmatter `authors` plus that
  author's entry in `{profile_dir}/authors.md` (bio, role, expertise).
- **Findable contact info for the blog** — a site-level requirement, not a
  per-post one: an email or social link reachable from the site (about page,
  footer, author bio). Confirm this exists once, during `blog-setup`, rather
  than re-checking it per post.

## Forbidden phrases

Never output any of these. If a generated draft contains one, rewrite:

- `in today's digital landscape`
- `in today's evolving world`
- `in the fast-paced realm`
- `we delve into`
- `navigate the complexities of`
- `unleash the power of`
- `revolutionize`
- `game-changing`
- `cutting-edge` (literal usage of cutting-edge products is an exception)
- `leverage` (as verb)
- `myriad of`
- `furthermore`
- `moreover`
- `in conclusion`
- `it's important to note that`
- `without further ado`
- `it goes without saying`
- `in essence`
- `pivotal`
- `holistic`
- `synergy`
- `circle back`
- `hardly scratches the surface`

Blogs add their own entries in `{profile_dir}/voice.md` §Additional forbidden phrases; the reviewer greps BOTH lists.

### Insider-jargon translation

Translate niche jargon for the audience defined in `{profile_dir}/audience.md`.
Default posture: readers are smart but not insiders, explain a term the
first time it appears. The examples below are from SEO/marketing jargon
(swap in your own niche's jargon as needed):

- `share a SERP` / `same SERP` → "show up together when you Google [keyword]" or "compete for the same query"
- `funnel` / `top of funnel` / `bottom of funnel` → describe the actual reader stage in plain language
- `featured snippet` / `rich snippets` → "the boxed answer at the top of Google" or similar reader-facing description
- `E-E-A-T` → never use the acronym in body copy; describe the underlying signal

Posts written for an expert or insider audience (per
`{profile_dir}/audience.md`) may keep niche jargon when the audience
already knows it.

## Forbidden characters

These are character-level rules, not phrases. Applies to every output the
workflow produces: blog posts, outlines, plans, drafts, reviews, images.md,
action-items.md, repurpose outputs, and any other document agents write.

- **Em-dash (`—`, U+2014). Zero tolerance.** The em-dash is the clearest AI
  tell in long-form text. Use one of these replacements:
  - A period and a new sentence (preferred when the break is strong).
  - A comma (when the aside is short).
  - A colon (when the second clause explains the first).
  - Parentheses (when the phrase is a nested aside).

  Wrong: `We shipped the feature — it works.`
  Right: `We shipped the feature. It works.`

- **En-dash (`–`, U+2013). Allowed only in numeric ranges.** Examples of
  legitimate en-dash use: `1–3 sentences`, `8th–9th grade`,
  `800–1,200 words`, `1200×630` (× is the multiplication sign, not an
  en-dash). Never as a sentence break. Never as a replacement for the
  em-dash rule above.

- **Hyphen (`-`, U+002D). Use freely** for compound words (`first-party`,
  `out-of-stock`), list bullets, and kebab-case identifiers.

Both em-dash and en-dash are invisible at a glance. Grep for `—` and `–`
before submitting any output:
```
grep -n '—' <file>    # must return nothing
grep -n '–' <file>    # every hit must be in a numeric range
```

## Required rhythm

Every body section must include at least one of:
- A bullet list (breaking walls of text)
- A standalone-question paragraph ("So what does this actually mean?")
- A concrete number or named example (not a generic claim)
- A short sentence (3–8 words) next to a longer sentence (20+ words)

This creates burstiness. Uniform sentence length is an AI-detection signal.

## Person and voice

- First person throughout: `I`, `we`, `you`
- Active voice: `we tested 50 products` not `50 products were tested`
- Second person addresses the reader: `you`. Never `users`, `stakeholders`, `one`

## Paragraph rules

- 1–3 sentences per paragraph (blog body, LinkedIn, newsletter)
- One thought per line for X
- 4-sentence paragraphs only when the argument genuinely needs them (rare)
- Standalone-question paragraphs allowed and encouraged

## Formatting

- `-` prefix for bullet points (not `*`, not `•`)
- Line breaks between ideas, never dense paragraphs
- Title case for headings on blog, LinkedIn, newsletter
- Sentence case for body copy
- Lowercase default for X body
- No hashtags (exception: max 3 at the very end of a LinkedIn post if topical)
- Emojis only as end-signoffs if at all; no emoji in blog body
- Code blocks for code, schemas, status enums, file paths

## Reading level

- Default target: 8th to 9th grade for body copy.
- Technical or deep-dive posts: match the technical content; write for
  readers who already know the domain.
- Pillar posts can go slightly higher (10th grade). Never academic.
- Per-author reading-level nuances live in `{profile_dir}/authors.md`.

## Humanization floor

Hard rules for every generated draft. A draft that fails any must be
rewritten before progressing a gate:

- No forbidden phrases from the list above
- Zero em-dashes (`—`); en-dashes (`–`) only in numeric ranges (per §Forbidden characters)
- First person throughout
- Burstiness (sentence-length variation in every section)
- At least one bullet list per 300 words
- At least one standalone-question paragraph per major section
- At least one concrete number or named example per major section
- Grammarly score 80–85 if measured (never 99. Perfection is an AI signal.)
- Plagiarism score <5% acceptable
