# Reddit Research: <target keyword>

Written by: blog-researcher subagent during Stage 1.5a analysis.
Sources: editor pre-selected up to 5 Reddit threads from `{drafts_dir}/<slug>/research/_raw/_reddit_search.json` and `{drafts_dir}/<slug>/research/_raw/_reddit_selection.md`. Per-thread deep fetches at `{drafts_dir}/<slug>/research/_raw/reddit-NN-<short>.json`.
Read by: blog-editor (synthesis stage, plan + facts curation).

**Raw shape note:** Reddit raw files are Reddit's native public `.json` API responses, not normalized to our schema. Search response: `data.children[].data` array of post objects. Thread response: 2-element array `[postListing, commentListing]`; post at `[0].data.children[0].data` (kind `t3`); top-level comments at `[1].data.children[].data` (kind `t1`; entries with `kind: "more"` are "load more" placeholders, skip them). Field names are Reddit's: `selftext`, `num_comments`, `permalink`, `created_utc`, etc.

## Search metadata

- Source: Reddit
- Query: <exact query used>
- Search URL: <e.g., https://www.reddit.com/search/?q=...&sort=relevance&t=year>
- Date searched: <YYYY-MM-DD>
- Threads selected for deep fetch: <N>
- Threads fetched successfully: <N>

## Selected threads (per editor's `_reddit_selection.md`)

### 1. <Thread title>
- URL: <url>
- Subreddit: r/<subreddit>
- Author: u/<author>
- Score: <N> | Comments: <N> | Posted: <date>
- Why selected: <one sentence, relevance to topic + signal quality>

#### Post body (verbatim, trimmed if needed)
> <quote>

#### Top comment patterns
- Most upvoted POV: <one-sentence summary>, score <N>
- Most contrarian POV: <summary>, score <N>
- Common concern raised: <summary>, appeared in <N> comments

### 2. <Thread title>
(same structure)

(repeat for each selected thread, up to 5)

## Voice-of-customer themes

Aggregate patterns across all selected threads. Each theme should reference at least one source URL.

- **Theme:** <one-sentence theme>
  - Evidence: <verbatim quote>, <source URL>
  - Evidence: <verbatim quote>, <source URL>
  - Frequency: appeared in <N>/<total> threads

(repeat for 3-5 themes)

## Use-in-post quotes

Verbatim quotes the writer can cite (with attribution). Each MUST include source URL.

- "<verbatim quote>", u/<author>, r/<subreddit>, source: <url>

## Angle opportunities for this blog

What pain points / language patterns suggest angles for this blog?

- <opportunity 1>
- <opportunity 2>

## Open questions

Things the researcher couldn't resolve.

- <question or "(none)">
