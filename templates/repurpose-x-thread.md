# X Thread: <slug>

Written by: `repurpose-blog-post` skill (Phase 5).
Source post: `<path to published blog post .md>`
Canonical URL: `https://yourblog.com{route_prefix}<slug>` (append a trailing `/` iff `blog.trailing_slash: true`)
Author voice: `<author slug from {profile_dir}/authors.md, or "we" for co-authored/product-wide content>`
Read by: human (copies tweet-by-tweet into X, or into a scheduler like Typefully / Hypefury).

**Purpose:** 6–12 tweet thread. Rethinks the post for X's native format. Different hook from the blog intro. Link lives ONLY in reply #1, never in the main thread.

## Hook type

`<contrarian | proof | data_surprise | story_hook | question_hook | vulnerability_hook | memorable_line | observation>`

Rationale: `<one sentence on why this hook wins on X, not why the blog intro would>`

## Main thread

### Tweet 1, the hook

```
<text, ≤280 chars, lowercase default, no hashtags, no emojis>
```

Char count: `<N>` / 280

### Tweet 2

```
<text>
```

Char count: `<N>` / 280

### Tweet 3

```
<text>
```

Char count: `<N>` / 280

<!-- repeat for each tweet; typical thread length is 7–9 tweets total -->

### Tweet N, closer

```
<either a memorable one-liner that stands alone OR a soft pointer to reply #1, e.g. "full write-up below →">
```

Char count: `<N>` / 280

## Reply #1, the link

```
<one line, plain, no hashtags>

https://yourblog.com{route_prefix}<slug><trailing slash iff blog.trailing_slash: true>
```

Char count: `<N>` / 280

## Optional reply #2+ (rare, only when the thread naturally has a "P.S." worth telling)

```
<text>
```

## Editor notes

Total tweet count: `<N>`
Total thread char count (body only, excluding reply): `<N>`
Hook overlap risk vs other platforms: `<none | flagged, see litmus section>`

Alternatives considered (optional, for the human if they want to swap the hook):
- `<alternative hook 1>`
- `<alternative hook 2>`

## Litmus notes

- Hook type used here: `<as declared above>`
- Different from X short? `<yes, short uses <type>>`
- Different from LinkedIn? `<yes, LinkedIn uses <type>>`
- Different from newsletter? `<yes, newsletter uses <type>>`

If any answer is `no`, the skill must regenerate either this thread or the duplicate with a fresh angle.
