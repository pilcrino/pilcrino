# X Short Take: <slug>

Written by: `repurpose-blog-post` skill (Phase 5).
Source post: `<path to published blog post .md>`
Author voice: `<author slug from {profile_dir}/authors.md, or "we" for co-authored/product-wide content>`
Read by: human (single tweet, copies into X).

**Purpose:** a single tweet, ≤280 chars, built on a DIFFERENT hook than the thread. If the thread is a step-by-step, this is a contrarian one-liner. If the thread is data-proof, this is a memorable observation. Pick whichever angle the thread didn't use.

## Hook type (must differ from thread)

`<contrarian | proof | data_surprise | story_hook | question_hook | vulnerability_hook | memorable_line | observation>`

Rationale: `<one sentence on why this angle is different from the thread, and why it stands alone>`

## Tweet

```
<text, ≤280 chars, lowercase default, no hashtags, no emojis>
```

Char count: `<N>` / 280

## Link treatment

`<include_in_body | standalone_no_link | link_in_self_reply>`

Rationale: `<one sentence on why, e.g., "tweet is the hook for the blog, link in body converts"; or "punchy take stands alone, link would dilute">`

### If `include_in_body`

The tweet above already contains: `https://yourblog.com{route_prefix}<slug>` (trailing `/` appended iff `blog.trailing_slash: true`)

### If `standalone_no_link`

No link. Assumes the bio/profile carries the blog's domain. The tweet is the take; curious readers find the post via the profile.

### If `link_in_self_reply`

Tweet itself has no link. Self-reply:

```
<brief nudge>

https://yourblog.com{route_prefix}<slug><trailing slash iff blog.trailing_slash: true>
```

Char count: `<N>` / 280

## Litmus notes

- Hook type used here: `<as declared above>`
- Different from thread? `<yes, thread uses <type>>`
- Different from LinkedIn? `<yes, LinkedIn uses <type>>`
- Different from newsletter? `<yes, newsletter uses <type>>`

If any answer is `no`, regenerate with a fresh angle.

## Editor notes

Alternatives considered:
- `<alternative short 1>`, `<why not>`
- `<alternative short 2>`, `<why not>`
