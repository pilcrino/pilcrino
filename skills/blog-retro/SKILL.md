---
name: blog-retro
description: Run a retrospective after a blog post is finished, analyze how the run actually went and suggest concrete improvements. Reads the working-session conversation (primary), the PR review + comment history via gh (the async-review friction record), and the slug's archived artifacts (review-iteration counts, verdicts, fallbacks, HARD-HALTs). Produces an in-chat, root-caused suggestion list (symptom, root-cause file + section, suggested edit) split into two buckets, shared-skill findings that target the plugin (benefiting every blog on the next update) and blog-local findings that target this blog's blog-ops/ overrides. Read-only, it suggests and never applies. Human-triggered only, never on a timer, standalone via /blog-retro <slug> in the working session after Gate 2. Not wired into blog-post-workflow.
argument-hint: "<slug>"
allowed-tools: Read, Glob, Grep, Bash
---

# blog-retro

Standalone retrospective. Run AFTER a blog post is finished, in the working session where the post was produced, to mine that run for improvements. Read-only: it suggests, it never edits a skill, persona, template, adapter, or blog-local profile/config/template override.

## When to invoke

- After Gate 2 approval + finalize for a post, in the SAME working session where the drafting happened (so the live conversation is available).
- Standalone: `/blog-retro <slug>`. No dependency on blog-post-workflow being mid-flight.
- Never on an automatic timer. This skill is only ever triggered by a person; see §Invocation for how.

## Invocation

There is exactly ONE way this skill runs, human-triggered: a human types `/blog-retro <slug>` in the working session where the post was produced. All three Step 2 sources are available, including the live conversation, the richest source of all.

## Why standalone (not a blog-post-workflow step)

On the default PR path, Gate 2 approval happens in the console. A human then triggers this skill deliberately in the working session where the post was produced; blog-post-workflow only nudges them to (Gate 2 banner + completion report).

## The two-bucket model (why it matters)

This plugin is layered: a shared plugin repo (`${CLAUDE_PLUGIN_ROOT}`, the workflow, personas, subagents, standards, templates, adapters) versus a per-blog workspace (`blog-ops/`, this blog's profile docs, `config.yaml`, and any template overrides under `blog-ops/templates/`). A friction point's fix belongs to exactly one of those, and they have different blast radii:

- **Shared-skill finding.** Root cause is a plugin file, `${CLAUDE_PLUGIN_ROOT}/skills/*/SKILL.md` (or `references/*.md`), `${CLAUDE_PLUGIN_ROOT}/personas/*.md`, `${CLAUDE_PLUGIN_ROOT}/agents/*.md`, `${CLAUDE_PLUGIN_ROOT}/standards/*.md`, `${CLAUDE_PLUGIN_ROOT}/templates/*.md`, or `${CLAUDE_PLUGIN_ROOT}/adapters/**/*.md`. A candidate edit here improves every blog running this plugin on the next `git pull` / plugin update, not just this one.
- **Blog-local finding.** Root cause is this blog's own workspace: `blog-ops/profile/*.md` (blog, voice, authors, audience, image-style, product, competitors), `blog-ops/config.yaml`, or a `blog-ops/templates/<name>.md` override. A candidate edit here only affects this blog.

The same symptom can point to either bucket depending on the actual root cause, e.g. a reviewer flagging a tone drift might mean the writer persona's rhythm rule is genuinely broken (shared-skill), OR that this blog's `voice.md` under-specifies the author's tone (blog-local). Read the candidate file before naming it, and pick the bucket the evidence actually supports, don't default to one bucket out of habit.

## Procedure

### Step 1, Resolve the slug

- If `<slug>` is given, use it.
- If omitted, infer the most recently finished slug: prefer one named in the current conversation; else `Glob: {drafts_dir}/_archive/*/checklist.md`, read frontmatter, pick the most recent `last_updated` with `status: complete`. State which slug you picked.
- Locate artifacts at `{drafts_dir}/_archive/<slug>/`. If the dir is missing, check `{drafts_dir}/<slug>/` (post not yet archived) and use whichever exists. If neither exists, stop and report.

### Step 2, Gather signals

Pull all THREE sources; each may be empty depending on the path the run took.

1. **Live conversation** (the primary source, always available: this skill only ever runs in the working session where the post was produced). Review THIS session's history for: where the human corrected you, re-explained, or overrode a decision; gate rejections (plan-review, blog-review) and their reasons; anything the workflow did wrong and had to redo; repeated friction.

2. **PR review feedback** (primary for the default async PR path, where the corrections happened on GitHub via the cron, NOT in this conversation). Read `{drafts_dir}/_archive/<slug>/pr-monitor.json`. If it has `mode: pr` and a `pr_number`, fetch the human (non-bot) feedback bodies from all three channels (`<repo>` = the `repo` field):
   - Issue comments: `gh api repos/<repo>/issues/<pr_number>/comments --paginate`
   - Inline diff comments: `gh api repos/<repo>/pulls/<pr_number>/comments --paginate`
   - Review-summary bodies: `gh api repos/<repo>/pulls/<pr_number>/reviews --paginate`
   Use the full `/reviews` history, NOT `gh pr view --json latestReviews`: `latestReviews` keeps only each reviewer's latest review and would collapse away an earlier `CHANGES_REQUESTED` / `COMMENTED` summary the same reviewer later flipped to `APPROVED`, which is exactly the friction the retro wants. Filter out the bot's own replies and the CI preview comment (the marker configured in `publish.astro.preview_comment_marker`, when set, per `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md`). If there is no `pr-monitor.json`, skip this source.

3. **Durable artifacts** (reinforcement) under `{drafts_dir}/_archive/<slug>/`: the `checklist.md` Gate log + Stage transition log (timings, retries); `draft-v<N>` count (= blog-reviewer iterations); `plan-review-v<N>` count + verdicts; any logged residual concerns, HARD-HALTs, or failures (push/PR-create failures, `wp_upload: failed`) in checklist Notes; humanizer preservation flags.

### Step 3, Root-cause each friction point

For every distinct problem found, identify the one artifact that should change to prevent a recurrence, and classify it into exactly one bucket per §The two-bucket model:

**Shared-skill candidates** (read the candidate before naming it, so the cited file + section is real):
- `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/SKILL.md` (a stage, gate, or resume-routing rule)
- `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/{config-schema,quality-gates,pr-monitor}.md`
- a companion skill, `${CLAUDE_PLUGIN_ROOT}/skills/{review-blog-post,humanize-text,suggest-images,generate-images,repurpose-blog-post}/SKILL.md`
- `${CLAUDE_PLUGIN_ROOT}/personas/{editor,writer,repurposer}.md`
- a subagent definition, `${CLAUDE_PLUGIN_ROOT}/agents/{blog-researcher,blog-writer,blog-reviewer,blog-humanizer,image-planner,image-builder,plan-reviewer}.md`
- `${CLAUDE_PLUGIN_ROOT}/standards/{writing-standards,blog-craft}.md`
- a template, `${CLAUDE_PLUGIN_ROOT}/templates/<name>.md`
- a publish or image adapter, `${CLAUDE_PLUGIN_ROOT}/adapters/{publish,images}/*.md`

**Blog-local candidates:**
- a profile doc, `{profile_dir}/{blog,voice,authors,audience,image-style,product}.md` or `{competitors_dir}/*.md`
- `blog-ops/config.yaml` (a module toggle, an images/publish setting)
- a per-blog template override, `blog-ops/templates/<name>.md` (only exists if this blog overrode a shared template)

If a symptom traces to something neither list covers (e.g. a one-off human typo, an external API outage), don't force it into a bucket, note it as environmental in the wrap-up instead.

### Step 4, Present the retrospective in chat

Output only in chat, in exactly two sections, in this order. Within each section, one compact entry per finding:

```
## Shared-skill findings

1. **Symptom:** what went wrong this run (cite the conversation moment, PR comment, or artifact).
   **Root cause:** exact file + section, e.g. `${CLAUDE_PLUGIN_ROOT}/agents/blog-writer.md` §Hard rules.
   **Suggested edit:** one concrete change.

## Blog-local findings

1. **Symptom:** ...
   **Root cause:** exact file + section, e.g. `blog-ops/profile/voice.md` §Additional forbidden phrases.
   **Suggested edit:** one concrete change.
```

If a section has no findings, keep the heading and write "None this run." rather than omitting the section. If nothing notable surfaced in either bucket, say so plainly ("No changes suggested, the run was clean") rather than inventing nits. End by reminding the human that nothing was applied: they decide whether to act, and any shared-skill change they greenlight lands in the plugin repo (helping every blog on next update), while a blog-local change lands only in this blog's `blog-ops/`.

## Hard rules

- Read-only. Never `Write` or `Edit` a skill, persona, template, adapter, post, or any `blog-ops/` file. Suggestions are chat-only.
- Never invent friction that the signals do not support.
- Every finding lands in exactly one bucket. If genuinely ambiguous, pick the bucket the stronger piece of evidence supports and say why in the suggested edit, don't duplicate the same finding into both sections.
- No em-dash codepoint (U+2014) in any output.

## What this skill does NOT do

- Does not edit any file, it is suggestion-only.
- Does not run unattended on a timer. It runs when a human asks for it in the working session.
- Does not decide which bucket's suggestions to act on, that's the human's call.
- Does not spawn subagents, runs inline.
