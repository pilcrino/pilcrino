# LinkedIn Post: <slug>

Written by: `repurpose-blog-post` skill (Phase 5).
Source post: `<path to published blog post .md>`
Canonical URL: `https://yourblog.com{route_prefix}<slug>` (append a trailing `/` iff `blog.trailing_slash: true`)
Author voice: `<author slug from {profile_dir}/authors.md, or "we" for co-authored/product-wide content>` (copied from source post's `authors:` field)
Read by: human (pastes into LinkedIn + posts the §First comment separately).

**Purpose:** 1,300–1,800 char personal-narrative post (sweet spot ~1,400). Founder voice per `author_voice`. First line must hook within 210 chars (LinkedIn's "see more" cutoff on feed), inside 5–10 words for highest see-more click rate. Body must end with a specific CTA question that invites a 15+ word reply. Link goes in the FIRST COMMENT, not the body, LinkedIn's algorithm penalizes body external links by ~42% reach. The body itself must also be domain-free, not just URL-free, a bare domain (`acme.com`, `acme.io`) auto-links on LinkedIn and attaches the same unwanted preview card as a full URL.

## Hook type

`<contrarian | proof | data_surprise | story_hook | question_hook | vulnerability_hook | memorable_line | observation>`

Engagement multipliers (pick with this in mind): `contrarian` 2.3x baseline · `data_surprise` 1.67x · `story_hook` / `vulnerability_hook` medium-high · direct-list openings only 3rd best.

Rationale: `<one sentence on why this hook fits LinkedIn's founder/builder audience>`

## First-line hook (≤210 chars, 5–10 words preferred, critical)

```
<one opening sentence or two>
```

Char count: `<N>` / 210 (must be ≤210 or the hook gets truncated behind "...see more")
Word count: `<N>` (aim 5–10 words; under 10 words outperforms longer hooks by 40%)
Banned openers: "I'm excited to announce", "Thrilled to share", anything congratulatory-corporate.

## Body

```
<3–7 short paragraphs, 1–3 sentences each, sentences under 20 words>

<paragraph breaks matter on LinkedIn. If posts have been collapsing recently,
insert a standalone dot or dash line between paragraphs.>
```

Rules:
- **Body must be domain-free, not just URL-free.** A bare domain (`acme.com`, `acme.io`) auto-links on LinkedIn and attaches the same unwanted preview card as a full URL. Write around it with non-domain wording instead (`Acme`, "the platform", "their checkout flow"), never the domain string.

Total char count: `<N>` (target 1,300–1,800, sweet spot ~1,400, hard cap 2,500; above 2,000 engagement drops ~35%)

## CTA (closing question, mandatory)

```
<specific question on the last line of the body>
```

Rules:
- Must invite a 15+ word reply (15-word comments carry 2.5x algorithmic weight).
- Specific to the post's claim. Banned: "thoughts?", "agree?", anything resolvable in one word.
- Good shape: "What's one <X> you've seen in your <ICP situation>?" / "If you've shipped <Y>, where did it actually break for you?"

## Optional closing hashtags

`<max 3 if topical, otherwise none>`

Examples of topical hashtags (swap in your own niche's):
- `#buildinpublic`
- `#indiehackers`
- `<niche-specific-tag>`
- `<niche-specific-tag>`

## First comment, the link

```
<one short teaser line>

https://yourblog.com{route_prefix}<slug><trailing slash iff blog.trailing_slash: true>
```

Char count: `<N>`

Post this as the first comment on your own post, right after publishing. Do NOT include this text or URL in the post body.

## Editor notes

- Total body char count: `<N>` (target 1,300–1,800)
- First-line hook char count: `<N>` / 210
- First-line hook word count: `<N>` (target 5–10)
- Paragraph count: `<N>`
- CTA: `<paste the closing question here>` (must invite 15+ word reply)
- Author voice applied: `<author slug from {profile_dir}/authors.md, or "we">`, `<one sentence on what that meant for this piece>`

## Litmus notes

- Hook type used here: `<as declared above>`
- Different from thread? `<yes, thread uses <type>>`
- Different from X short? `<yes, short uses <type>>`
- Different from newsletter? `<yes, newsletter uses <type>>`

If any answer is `no`, regenerate with a fresh angle.
