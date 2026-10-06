# Newsletter: <slug>

Written by: `repurpose-blog-post` skill (Phase 5).
Source post: `<path to published blog post .md>`
Canonical URL: `https://yourblog.com{route_prefix}<slug>` (append a trailing `/` iff `blog.trailing_slash: true`)
Author voice: `<author slug from {profile_dir}/authors.md, or "we" for co-authored/product-wide content>` (copied from source post's `authors:` field)
Read by: human (pastes subject + preview + body into Beehiiv / Kit / Loops / ConvertKit).

**Purpose:** newsletter-format rework. Hook-driven subject (never `"Newsletter #N"`). Preview reinforces subject without repeating. Body follows the format class below. Personal opener + ONE core topic + ONE clear CTA. Plain text dominant.

## Format class

`<insight_letter | build_log | deep_dive | case_study | contrarian_essay>`

| Class | Target length | Shape |
|---|---|---|
| `insight_letter` | 800–1,200 words | Short argument + one takeaway |
| `build_log` | 600–1,200 words | "This week we shipped X", changelog + lesson |
| `deep_dive` | 1,500–2,500 words | Full essay treatment; matches a pillar blog post |
| `case_study` | 1,000–1,500 words | "Here's what happened when <situation>"; data-driven |
| `contrarian_essay` | 1,500–2,500 words | "Everyone thinks X. We found Y. Evidence below." |

Rationale: `<one sentence on why this class fits the source post>`

## Hook type

`<contrarian | proof | data_surprise | story_hook | question_hook | vulnerability_hook | memorable_line | observation>`

## Subject line

```
<≤70 chars, hook-driven, specific>
```

Char count: `<N>` / 70

## Preview text

```
<≤120 chars; reinforces subject without restating>
```

Char count: `<N>` / 120

## Body

### Opener (2–4 sentences)

```
<personal opener, why you're writing this now, what prompted it>
```

### Core

```
<one core topic; no kitchen-sink roundups>

<short paragraphs; 1–3 sentences each; plain text dominant>

<one bullet list maximum, only if the shape genuinely calls for it>

<one **bold** epiphany statement maximum, used sparingly for the key takeaway>
```

### CTA (the ONE ask)

```
<one clear action, "read the full write-up at <URL>" / "reply with your take" /
"try it yourself, free tier covers the first 100 links">
```

If the CTA is the blog link, use the canonical URL:

```
https://yourblog.com{route_prefix}<slug><trailing slash iff blog.trailing_slash: true>
```

Plain URL. No tracking params.

### Sign-off

For product-wide / co-signed content (`authors: [<author-1>, <author-2>]` on source):

```
<Author 1> and <Author 2>, <role from {profile_dir}/authors.md, e.g. "Co-founders of <blog/product name>">
```

For single-voice content:

```
<author name, from {profile_dir}/authors.md>
```

Match the source post's `authors:` field exactly.

## Total word count

`<N>` (target range per §Format class)

## Editor notes

- Format class chosen: `<as declared>`
- Word count vs target: `<within | over | under>`
- Number of bullet lists used: `<count, aim for 0 or 1>`
- Number of bold statements used: `<count, aim for 0 or 1>`
- CTA type: `<link | reply | product-try | other>`

## Litmus notes

- Hook type used here: `<as declared above>`
- Different from thread? `<yes, thread uses <type>>`
- Different from X short? `<yes, short uses <type>>`
- Different from LinkedIn? `<yes, LinkedIn uses <type>>`

If any answer is `no`, regenerate with a fresh angle.

## Send-time note (for the human)

Newsletter timing rhythm (not enforced by this skill, just context):
- Insight letter / contrarian essay: mid-week, Tuesday–Thursday 10am–2pm sender timezone
- Build log: Friday or Monday (bookends the work week)
- Case study: mid-week
- Deep dive: avoid Monday + Friday; readers skim heavily on those days

Subject line A/B testing: if your ESP supports it, test two subject variants on 10–20% of the list before full send.
