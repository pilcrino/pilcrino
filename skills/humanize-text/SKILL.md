---
name: humanize-text
description: Run the mandatory final humanization pass on an approved blog post draft. Search-and-destroy forbidden phrases, enforce first-person + active voice, guarantee rhythm markers in every section, reduce em-dash overuse, and preserve every fact, citation, link, and placeholder marker exactly. Edits {drafts_dir}/<slug>/draft-v<N>.md in place, the approved version becomes the humanized version. Invoked by blog-post-workflow at Stage 3c after review approves, but also invokable standalone on any markdown draft.
argument-hint: "<slug> [draft-v<N>]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# humanize-text

Rewrites AI tells out of an approved draft while preserving every fact, citation, link, and placeholder marker exactly. The last pass before Phase 4 (images + action items + finalize). Mandatory, not optional.

## When to invoke

- **Stage 3c of `blog-post-workflow`**, after `review-blog-post` returns `approve` on the latest `draft-v<N>.md`. The editor calls this skill; the output is a draft that's ready for Phase 4.
- **Standalone**, on any markdown draft in `{drafts_dir}/<slug>/`. Useful if you manually edited a draft and want a humanization sweep before shipping.

## Arguments

- `<slug>`, required. Draft directory under `{drafts_dir}`.
- `[draft-v<N>]`, optional. Which draft version to humanize. Default: the highest-numbered `draft-v*.md`.

## Core contract: preserve, don't rewrite

This is the single most important rule. The humanize pass is allowed to change **phrasing, sentence structure, and paragraph breaks**, but it must preserve, byte-exact where possible:

- Every numeric claim (the number itself and the surrounding factual context)
- Every citation (external links, internal links, their URLs, their anchor text)
- Every frontmatter value (title, date, excerpt, tags, authors, cover/hero image path, JSON-LD schema where the configured frontmatter template emits one)
- Every placeholder marker: `[VERIFY: ...]`, `[EXTERNAL_LINK_NEEDED: ...]`, `[INTERNAL_LINK_NEEDED: ...]`, `[IMAGE: ...]`
- Every H2/H3 heading text (order + wording locked)
- Every FAQ question (the `### <Q>` lines) and its 1:1 mapping to the FAQ schema mechanism the frontmatter template defines
- The author voice (`author_voice` from `brief.md`, an author slug from `{profile_dir}/authors.md`, or `we`)

If a fact trace or link would break to achieve a "more human" phrasing, STOP. Preservation wins. A slightly AI-flavored sentence that cites correctly is better than a colloquial one that drops the citation.

## Tool access

- `Read`, draft, brief, `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`, `{profile_dir}/voice.md`, `{profile_dir}/authors.md`
- `Edit`, the in-place rewrites
- `Write`, backup copy before editing (see Step 4)
- `Glob`, find latest draft version
- `Grep`, forbidden phrases, em-dash count, passive markers
- `Bash`, `wc -w` pre/post word count check; `diff` for sanity

No MCP. No Chrome. No curl.

## Workflow

### Step 1, Resolve input

1. Verify `{drafts_dir}/<slug>/` exists.
2. If `<draft-vN>` was passed: verify the file exists. Else: `Glob` the latest `draft-v*.md`.
3. Read the file. Record initial word count (`wc -w`).

### Step 2, Read reference

- `{drafts_dir}/<slug>/brief.md`, confirm `author_voice`
- `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`, base forbidden-phrase list, humanization floor
- `{profile_dir}/voice.md`, §Additional forbidden phrases, per-blog tone notes
- `{profile_dir}/authors.md`, tone + sign-off pattern for the selected `author_voice` (or the co-signed notes for `we`)

### Step 3, Pre-flight inventory (so we can verify preservation at the end)

Extract and record (in a scratch note the skill keeps in memory, not a file):

- Every URL from `Grep` of `https?://[^\s)"']+`
- Every numeric literal from `Grep` of `\b\d+\b` (with surrounding 20-char context)
- Every `[VERIFY:` / `[EXTERNAL_LINK_NEEDED:` / `[INTERNAL_LINK_NEEDED:` / `[IMAGE:` marker, captured **byte-exact from the opening `[` to the closing `]`** (not just the prefix). For `[VERIFY:]` markers this means the full literal including the ` | source: <where>` clause must round-trip exactly, the source attribution is the only handle the human has into where the writer found the claim, dropping or rewording it breaks downstream verification at action-items.
- Every H2 heading (`## ` lines) and H3 heading (`### ` lines) in order
- Frontmatter block (everything between the first two `---` lines), byte-exact

This "pre-flight set" is the ground truth. Step 6 (post-flight check) re-extracts and compares.

### Step 4, Backup

```
Bash: cp {drafts_dir}/<slug>/draft-v<N>.md {drafts_dir}/<slug>/.draft-v<N>.pre-humanize.md
```

The backup is a safety net for rollback if Step 6 detects preservation failure. Dotfile-prefixed so it doesn't surface in normal `Glob` of drafts.

### Step 5, Run the rewrite passes, in order

Each pass is narrow and targeted. Do them in this order, some create work for later passes.

#### Pass 5.1, Forbidden phrase sweep

Dual-sourced: for every phrase in `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` §Forbidden phrases AND every phrase in `{profile_dir}/voice.md` §Additional forbidden phrases:
1. `Grep` the phrase (case-insensitive) in the draft.
2. For each hit: `Edit` the phrase to a natural rephrasing that preserves meaning.

Examples of correct substitutions:
- `in today's digital landscape` → delete the phrase entirely; the sentence usually reads fine without it
- `leverage` (as verb) → `use` / `apply` / `put to work`
- `in conclusion` → delete or → specific closing statement
- `it's important to note that` → delete
- `furthermore`, `moreover` → delete or → use a fresh sentence
- `pivotal` → `important` / `key` / specific word
- `holistic` → concrete alternative or delete
- `synergy` → specific concrete word
- `navigate the complexities of` → specific verb

Do NOT substitute with another AI-flavored phrase. If no good rephrasing exists, cut the sentence.

#### Pass 5.2, Em-dash elimination (zero tolerance)

Per `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` §Forbidden characters, em-dashes (`—`, U+2014) are a character-level forbidden mark. Zero is the only acceptable count.

```
Bash: grep -n '—' <draft path>
```

For every hit, replace with one of:
- A period and a new sentence (preferred when the break is strong).
- A comma (when the aside is short).
- A colon (when the second clause explains the first).
- Parentheses (when the phrase is a nested aside).

Never convert an em-dash inside:
- The `[IMAGE: ...]` placeholder literal text (but the placeholder syntax should not contain em-dashes; flag any as a writer bug).
- A verbatim block quote from an external source. Flag these to the editor; often the quote can be paraphrased or trimmed to avoid the em-dash while preserving meaning. Never silently alter a verbatim quote.

After rewriting, re-grep. Zero em-dashes must remain. If any hit survives after two rewrite attempts on the same line, STOP and flag the surviving hits in the handoff. Do not ship a draft with em-dashes.

Also grep for the en-dash (`–`, U+2013):
```
Bash: grep -n '–' <draft path>
```

Each hit must sit inside a numeric range (`1–3`, `8th–9th`, `800–1,200`). Mid-sentence en-dashes acting as a break are treated exactly like em-dashes: replace with the same four options.

#### Pass 5.3, Passive voice → active

Grep for passive markers:
- `was (scanned|checked|monitored|built|found|measured|created)`
- `(is|are|were|been) (being )?<past participle>`

For each hit: rewrite to active voice. Know who the actor is (usually `we`, this blog's product, or the reader). Example:
- `50,000 links were scanned` → `We scanned 50,000 links`

Exception: passive voice is allowed when the actor genuinely doesn't matter ("The link was flagged as broken" if which scanner flagged it isn't the point).

#### Pass 5.4, Third-person drift → second person

Grep for: `\b(one|users|stakeholders|creators who want to|those who)\b`

For each drift: rewrite to `you`. Example:
- `Users who want to monitor their links should ...` → `If you want to monitor your links, ...`

Exception: `the user` in a technical context where it's a role (e.g., a schema definition) is fine.

#### Pass 5.5, Burstiness injection (per-section)

For each H2 section:

1. Extract the section body text.
2. Split into sentences. Compute sentence-length stddev.
3. If stddev < 4 words (= uniform):
   - Find the longest sentence. Can it be broken into two without losing meaning?
   - Or: add a short (3–8 word) sentence as emphasis, e.g., `"It works. Most of the time."`
4. Check for at least one rhythm marker:
   - Bullet list
   - Standalone-question paragraph (a single sentence ending in `?` on its own line, with a blank line before and after)
   - Concrete number
   - Short/long adjacency
5. If none present: inject a standalone-question that flows (do NOT add a generic "So what does this mean?" at every section, vary). Use one per section maximum.

Do NOT add a new paragraph in a section where word count is already at target, cut an existing weak sentence first, then add the short one.

#### Pass 5.6, Per-voice polish

Read the selected `author_voice`'s entry in `{profile_dir}/authors.md` and apply whatever polish notes it specifies (tone, sentence-length preference, sign-off pattern). Typical shapes, follow the author entry's actual guidance rather than assuming these apply verbatim:
- **A personal-voice author:** if the intro or a body section starts flat, consider re-opening with a one-sentence scene or personal note, only if a `brief.md` anecdote exists to draw from. Never invent an anecdote.
- **A technical-voice author:** if the draft mentions a feature generically, upgrade to the specific reference `{profile_dir}/product.md` (module: product) or `{profile_dir}/authors.md` names for that author's depth.
- **`we` voice:** smooth any accidental single-narrator phrasings into plural ("I shipped..." → "We shipped...").

#### Pass 5.7, Grammarly-80 sanity

- Target Grammarly 80–85, not 99. Perfection is an AI signal.
- If the draft reads too clean: leave one intentional mild informality (a 4-sentence paragraph, a colloquial connector, a contraction like `don't` you already use).
- Do NOT introduce grammar errors for the sake of "humanness."

### Step 6, Post-flight preservation check

Re-extract the pre-flight inventory from the edited draft. Verify, one by one:

1. **URL set.** Compare `Grep https?://[^\s)"']+` before-set vs after-set. Any URL missing? → STOP, restore from backup (Step 4), report the violation.
2. **Numeric literals.** Compare number-with-context before-set vs after-set. Any number missing or changed? → STOP, restore, report.
3. **Placeholder markers.** Count before vs after. Any marker dropped or shape-altered? → STOP, restore, report. The full marker literal must match (for `[VERIFY:]`, that includes the ` | source: <where>` clause); a marker whose source clause was truncated, paraphrased, or rewritten counts as shape-altered.
4. **H2/H3 headings.** Compare before vs after, in order. Any change? → STOP, restore, report.
5. **Frontmatter block.** Compare first-two-`---`-block byte-exact. Any change? → STOP, restore, report. The only exception: trailing whitespace normalization.
6. **Word count delta.** `wc -w` before vs after. Humanization usually reduces by 5–15%. If it changed by >20% (up or down), flag as suspicious, the editor should review before accepting.

Rollback on failure:
```
Bash: mv {drafts_dir}/<slug>/.draft-v<N>.pre-humanize.md {drafts_dir}/<slug>/draft-v<N>.md
```

### Step 7, Second-pass forbidden scan

After the rewrite, grep again for both forbidden-phrase lists (`${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md` + `{profile_dir}/voice.md`). If any survived: second pass, then re-do Step 6 preservation check. If they survive a second time, flag to editor with verbatim `Grep` output, do NOT silently leave them.

### Step 8, Clean up

If Step 6 passed (preservation verified):
```
Bash: rm {drafts_dir}/<slug>/.draft-v<N>.pre-humanize.md
```

The humanized draft remains at the original path. The editor (Stage 3c) picks up from there and moves the workflow into Phase 4.

### Step 9, Return handoff

Return to the editor (≤200 words):

- File edited: `{drafts_dir}/<slug>/draft-v<N>.md`
- Preservation check: `PASSED` / `FAILED and restored`
- Forbidden phrase hits: before `<N>` → after `<M>`
- Em-dash count: before `<N>` → after `<M>`
- Passive → active conversions: `<N>`
- Burstiness injections: `<N> (one per section that needed it)`
- Word count delta: `<before>` → `<after>` (`<Δ%>`)
- Anything the editor should review (e.g., "section 5 needed a rhythm marker but had no slack to cut, I left as-is; consider manual tweak")

## Failure handling

- **Draft file missing:** stop, report, no backup, no edits.
- **Backup write fails (`cp`):** stop, do not edit without a rollback point. Report disk / permission issue.
- **Preservation check fails at Step 6:** restore from backup, report verbatim which invariant broke. The editor decides next action (manual edit, skip humanization, escalate to human).
- **Second-pass forbidden scan still shows hits (Step 7):** leave the draft as-is after Step 6 preservation check passed, and report the surviving phrases to the editor with line numbers. Better to ship a flagged draft than to damage preservation with aggressive rewrites.

## What this skill does NOT do

- Does not fetch anything, no MCP, no Chrome, no curl.
- Does not fact-check, `[VERIFY:]` markers are left exactly as the writer placed them.
- Does not change H2/H3 structure, outline is locked all the way to finalize.
- Does not add new product mentions (module: product), product-mention discipline is the writer's responsibility; the humanize pass only rephrases existing mentions if they violate `{profile_dir}/voice.md`.
- Does not spawn subagents, runs inline.
- Does not update `checklist.md`, the editor does that after Step 9 returns.
- Does not re-write the title, slug, or meta description.
- Does not adjust structured schema content (the FAQ answer text in a JSON-LD or `<!-- schema:faq -->`-marked schema stays exact; body answer text may be rephrased separately, but then they'll diverge from the 1:1 mapping rule; prefer rephrasing neither to avoid drift).
