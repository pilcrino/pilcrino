---
name: blog-post-workflow
description: "Produce a publish-ready blog post through a gated multi-stage workflow. The skill loads the editor persona and plays the editor role in the main session, conducting intake Q&A, browser research (SERP + optionally Reddit + X), plan synthesis, and gates directly. Heavy file-reading stages delegate to subagents, blog-researcher (Stage 1b analysis), blog-writer (Stage 3a draft + 3b revise), blog-reviewer (Stage 3b review), blog-humanizer (Stage 3c), image-planner (Stage 4a). Each research source uses a select-then-fetch pattern: cheap search-results capture → editor selects the most relevant → deep-fetch only those. Research runs in the Pilcrino browser (its own signed-in Chrome profile, driven by the bundled pilcrino-browser MCP server); Playwright is explicitly forbidden."
argument-hint: "[resume <slug> | new]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, WebSearch, WebFetch, CronCreate, CronDelete, mcp__plugin_pilcrino_pilcrino-browser__tabs, mcp__plugin_pilcrino_pilcrino-browser__navigate, mcp__plugin_pilcrino_pilcrino-browser__capture, mcp__plugin_pilcrino_pilcrino-browser__run, mcp__plugin_pilcrino_pilcrino-browser__screenshot, mcp__plugin_pilcrino_pilcrino-browser__wait, mcp__plugin_pilcrino_pilcrino-browser__login_status, mcp__plugin_pilcrino_pilcrino-browser__open_login
---

# blog-post-workflow

Main workflow for this blog's post production. Runs in the main session. Loads the editor persona from `${CLAUDE_PLUGIN_ROOT}/personas/editor.md` and plays that role directly, the skill IS the editor.

Heavy file-reading stages are delegated to subagents so the editor's context stays lean:

| Stage | Subagent | Context-heavy work it owns |
|---|---|---|
| 1b research analysis | `blog-researcher` | reading raw SERP/Reddit/X JSON, writing per-source analysis |
| 3a drafting (+ 3b revise) | `blog-writer` | 8+ reference reads, 1,500–3,000-word single-pass draft |
| 3b review | `blog-reviewer` | full draft grep sweep, template-driven critique |
| 3c humanize | `blog-humanizer` | rewrite passes + post-flight preservation check |
| 4a image plan | `image-planner` | per-slot production spec for every `[IMAGE:]` placeholder |

Everything else (intake, browser research fetching, plan synthesis, outline drafting, gates, action-items compile, finalize) runs in the main session where the editor can converse with the human.

## How to invoke

- `$ARGUMENTS` empty → auto-detect in-progress drafts; offer resume/new choice
- `$ARGUMENTS` = `new` → skip detection; start a new workflow
- `$ARGUMENTS` = `new <slug>` → as `new`; on a standalone blog it takes the row from `blog-ops/content-plan.md` (Step 2.5)
- `$ARGUMENTS` = `published <slug>` → standalone blogs only (Step 2.5). Confirms the post is live with the adapter's check (`astro-git-pr`: the PR is merged and the post URL answers 200; `wordpress-rest`: the post's status is `publish`; `markdown`: the PR is merged), then sets the row's Status column in `blog-ops/content-plan.md` to `published`, changes nothing else in the file, and commits it on the base branch. If the post is not live yet it says so and changes nothing. A registered blog's file is never edited: the console rewrites it from its post list.
- `$ARGUMENTS` = `resume <slug>` → jump directly to the next unchecked stage of `<slug>`
- `$ARGUMENTS` = `autopilot <slug>` / `autopilot-cont <slug>` / `autopilot-revise <slug>` / `autopilot-fix <slug>` → headless console-driven modes — see ## Autopilot

**Go-live guard (overrides the general "user standing instruction > defaults" precedence, for this gate only):** Gate 2 is a mandatory human stop. No invocation argument and no standing instruction ever constitutes Gate 2 approval or authorizes `status=publish` / a PR merge. A launch-arg phrase like "update the post's status to published" or "mark published" refers to the **content-calendar Status column**, never the live post; the workflow leaves the post `draft` and stops at the Gate 2 preview.

## Step 0, Config preamble (always, before any orchestration)

Before the workflow does any orchestration, load and validate the blog's config, then adopt the editor persona. Nothing below runs until this passes.

1. **Locate the config.** `blog-ops/config.yaml` at the workspace repo root is a fixed convention, the bootstrap anchor (see `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §Bootstrap rule); all other paths derive from its values. If it is missing or does not parse as YAML → **HARD-STOP**: "No valid blog-ops/config.yaml — run /blog-setup first." Do not proceed.

2. **Validate invariants 1-13** from `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §Validation invariants. These are cheap checks only (no network: this preamble never probes any adapter's auth; see the auth-probe note under step 4 below); resolve env-var presence with `[ -n "${!VAR}" ]`. Any failure → **HARD-STOP** naming the specific invariant and "run /blog-setup first."
   1. File parses; `blog.name`, `blog.url`, `modules`, `images.enabled` (non-empty), `publish.adapter` present.
   2. `images.featured_default`, if set, ∈ `images.enabled`.
   3. `remotion` ∈ `images.enabled` → `images.remotion.project_dir` set and exists on disk.
   4. `publish.adapter` ∈ {`astro-git-pr`, `wordpress-rest`, `markdown`} and its config block present.
   5. Module-conditional profile docs exist iff module on: `modules.product: true` → `{profile_dir}/product.md`; `modules.competitors: true` → `methodology.md` in `{competitors_dir}` on the base branch, checked at intake from the `competitor-profiles.mjs` list run (`references/competitor-profiles.md` rule 5), not here.
   6. Required profile docs always present: `{profile_dir}/blog.md`, `voice.md`, `authors.md`, `audience.md`, `image-style.md`.
   7. `blog.route_prefix` present, starts and ends with `/`.
   8. `browser.executable`, if present, is an absolute path.
   9. `blog.trailing_slash` present and a boolean.
   10. If `console.publish_policy` is `auto`, `publish.adapter` must be `astro-git-pr` (WordPress go-live is always manual; every `markdown` post waits for the owner's approval).
   11. If a `console` block is present, it contains only the documented keys with the documented types.
   12. `competitors.profile_dir`, if set, is a repo-relative path (syntax only here; its existence on the base branch is checked at intake by `competitor-profiles.mjs`, `references/competitor-profiles.md` rule 5).
   13. `social.linkedin`, if present, has a non-empty string `company_id`.

   Invariants 10 and 11 are checked only when a `console:` block is present; interactive-only blogs (no `console:` block) satisfy them vacuously. Both are cheap, no-network structural checks (config-schema.md §Validation invariants), consistent with this preamble's "cheap checks only" rule.

3. **Resolve path variables, then check the GitHub precondition.** Resolve `{ops_dir}`, `{profile_dir}`, `{drafts_dir}`, `{content_dir}`, `{assets_dir}`, `{remotion_dir}`, `{route_prefix}`, `{competitors_dir}` (`competitors.profile_dir`, default `blog-ops/profile/competitors`; relevant only when `modules.competitors` is true) (and `{templates}` via the layered rule) from config per §Path variables. Then check the GitHub precondition, per `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §GitHub precondition: `git remote get-url origin` resolves AND `gh repo view "$(git remote get-url origin)" --json name` succeeds. **If either fails, HARD-STOP here** with the failing command's output — the PR path is the only publish path, so there is nothing to fall back to. Do not stage, do not write to `{content_dir}`, do not open a worktree.

4. **Load the editor persona.** Read `${CLAUDE_PLUGIN_ROOT}/personas/editor.md` and adopt every rule in it, **skipping any `<!-- module: X -->` block whose module is off in config**. When the rest of this skill refers to "editor behavior" or "the editor role", it means the rules from that persona doc. Skill logic below is the workflow plumbing; the persona file supplies the editorial judgment.

   **Auth-probe note (applies for the rest of the run):** when `publish.adapter: wordpress-rest`, this preamble never probes the WordPress application-password credential — that probe runs exactly once, at Stage 4b.5 staging, per `${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` §Staging step 2. Never retried, never polled; on failure, follow that section's lockout guidance verbatim rather than re-deriving it here.

5. **Load custom instructions, when present.** After the persona (step 4), check `{profile_dir}/custom-instructions.md`. If it exists, read it and adopt its contents as standing per-blog instructions for the rest of the run. This doc is always optional (`config-schema.md` §Validation invariants, the paragraph following invariant 9); its absence is not a failure. **Precedence when instructions conflict (highest wins): the user's own live instructions in this conversation > `{profile_dir}/custom-instructions.md` > persona/standards defaults** (editor persona, `standards/*.md`, template defaults). Every stage below and every subagent spawned honors this file when it exists and this ranking when instructions collide.

   **Standing rules (autopilot only).** When `$CONSOLE_RULES` is set, read that
   file too. It is a generated list of standing rules the operator built from
   feedback on earlier posts; treat every line as an instruction for this post.
   It is read-only: never edit it, never copy it into the repo, and never write
   a rules file yourself. Its absence is not a failure (a blog with no rules yet
   gets no file). **Updated precedence, highest wins: the user's own live
   instructions in this conversation > the requirements in `$CONSOLE_POST` >
   `$CONSOLE_RULES` > `{profile_dir}/custom-instructions.md` >
   persona/standards defaults.**
   Rules outrank custom instructions because they are the more recent and more
   specific statement of the same intent.

   **Requirements for this post (autopilot only).** The requirements in
   `$CONSOLE_POST` are the `requirements` value of that JSON file. It is the
   owner's free text for this one post, written on the post in the console:
   competitors to mention, pages to link, things to avoid. Treat every line as
   an instruction for this post. Read-only, never copied into the repo except
   as `brief.md`'s `## Requirements` section (intake below). An empty value
   means the owner wrote none.
   **Precedence, highest wins: the user's own live instructions in this
   conversation > the requirements in `$CONSOLE_POST` > `$CONSOLE_RULES` >
   `{profile_dir}/custom-instructions.md` > persona/standards defaults.**
   Requirements outrank rules because they are the more specific statement
   for this post.

## Path convention (read before any file op)

**Every repo-relative path in this skill resolves from the repository root, which is the current working directory.** The cwd may be the main checkout OR a git worktree (e.g. `.../worktrees/<branch>/`). The skill must work identically in both.

Rules:

- **Never hardcode an absolute repo path** (no `/Users/...`, no `~/repo/...`). Config-derived paths like `blog-ops/...`, `{content_dir}/...`, `{assets_dir}/...` and plugin paths like `${CLAUDE_PLUGIN_ROOT}/skills/...` resolve correctly from the cwd in either tree.
- The one exception is the `outFile` of a browser `capture` (and `screenshot`): the pilcrino-browser server refuses relative paths, so `outFile` must be absolute. In the blocks below, an `outFile` written as `{drafts_dir}/...` means `$(git rev-parse --show-toplevel)/{drafts_dir}/...`, derived at that moment, never pasted as a literal machine path.
- When you need the absolute repo root in a Bash block (e.g. the Gate 2 finalize sequence), derive it: `REPO=$(git rev-parse --show-toplevel)`. Do not write the path literally.
- Subagents spawned via the Agent tool inherit this same cwd, so repo-root-relative paths in spawn prompts resolve for them too. Pass relative paths (`{drafts_dir}/<slug>/review.md`), not absolute ones.
- If a step needs an absolute path for clarity in a subagent prompt, construct it from `git rev-parse --show-toplevel` at that moment; never paste a machine-specific path into the skill or a prompt.

This section exists because hardcoded absolute paths silently write into the wrong tree when the workflow runs inside a worktree (draft files, and worse, the finalized post + assets, land in the main checkout instead of the isolated branch).

## Browser: the Pilcrino browser (pilcrino-browser MCP)

All browser research runs in the Pilcrino browser: Pilcrino's own Chrome profile, driven by the plugin's `pilcrino-browser` MCP server (`mcp__plugin_pilcrino_pilcrino-browser__*`). The server starts Chrome on the first call if it is not running. Never use `mcp__playwright__*`. There is no page-text dump and no download: **the only way to read a page is `capture` (runs a script in the tab and writes its JSON result to a file), then `Read` the file.** Page content never passes through a tool result. Tabs you open with `tabs open` are yours alone; always close them with `tabs close` when the stage ends.

Preflight before Step 4 (the sign-in gate): call

```
mcp__plugin_pilcrino_pilcrino-browser__login_status
  sites: ["google"<, "reddit" if modules.reddit_research><, "x" if modules.x_research>]
```

Every site must return `signed_in`. Otherwise:
- `signed_out`: call `mcp__plugin_pilcrino_pilcrino-browser__open_login` with those sites, then STOP: "Sign in to <site> in the Pilcrino window that just opened, then quit it with Cmd+Q and rerun." (`open_login` quits the Pilcrino browser and opens a window without remote control, because Google refuses sign-in under remote control; until the owner quits it, every browser tool fails with `signin_window_open`.) In autopilot this cannot happen at the start (the console gates before spawning); if it happens mid-run, park `captcha_or_login` with the site in detail.
- `blocked`: STOP: "<site> is challenging the Pilcrino browser; open it, pass the check, then rerun." Autopilot: park `captcha_or_login`.
- `error`: STOP: "The Pilcrino browser could not reach <site>; check the connection and rerun." Autopilot: park `chrome_unavailable`.
- The tool fails with `signin_window_open`: STOP: "The Pilcrino sign-in window is still open. Quit it with Cmd+Q, then rerun." Autopilot: park `chrome_unavailable` with that sentence in detail.
- The tool itself fails (Chrome not found, did not start): STOP with the tool's message. Autopilot: park `chrome_unavailable`.

Never fall back to curl or Playwright.

## ═══════════════════════════════════════════════════════════
## WORKFLOW
## ═══════════════════════════════════════════════════════════

### Step 1, Entry routing

1. If `$ARGUMENTS` is `new` or `new <slug>`: go to Step 2.5 (it falls through to Step 3)
2. If `$ARGUMENTS` is `published <slug>`: go to Step 16.5, no intake
3. If `$ARGUMENTS` is `resume <slug>`: skip to Step 2 with that slug
4. Otherwise: detect in-progress drafts

To detect in-progress drafts, Glob both the active drafts dir AND the archive (archived drafts normally have `status=complete`, but if the finalize bash ran and Step 15.4 crashed before closing out the checklist, the archived slug will still be `active` and needs to surface here for recovery):

```
Glob: {drafts_dir}/*/checklist.md
Glob: {drafts_dir}/_archive/*/checklist.md
```

For each match, read the YAML frontmatter. Extract: `slug`, `target_keyword`, `current_stage`, `last_updated`, `status`, `gate_pending`. Skip any with `status: complete` or `status: abandoned`. For archived entries that are still `active`, annotate the listing as "(finalize incomplete, recovery)".

Present the user:
```
Found N in-progress draft(s):

1. <slug>, "<keyword>", stage: <stage>, <last_updated>, <gate_pending>
...

Resume one by number, or reply "new" to start a new post.
```

Wait. Picked one → Step 2 with slug. "new" → Step 2.5.

### Step 2, Resolve resume slug

For `resume <slug>`:
1. Locate the checklist. Check in order:
   - `{drafts_dir}/<slug>/checklist.md` — the normal case (pre-finalize).
   - `{drafts_dir}/_archive/<slug>/checklist.md` — fallback. After the Gate 2 bash runs, the draft directory is moved to `_archive`. If Step 15.4 (post-finalize checklist update) crashed, the archived checklist is still `active` and needs recovery. If found here, set `CHECKLIST_PATH` to the archived location; all subsequent reads/writes use that path.
   - Neither → stop and report "no draft found for slug `<slug>`; check `{drafts_dir}/` and `{drafts_dir}/_archive/`".
2. Read + parse YAML frontmatter.
3. Route on `current_stage` first, then on `gate_pending`, then on on-disk artifacts as tiebreakers. `current_stage` is the authoritative resume signal; file-existence only disambiguates mid-stage crashes.

| `current_stage` | `gate_pending` | Additional condition | Resume to |
|---|---|---|---|
| `intake` | any | — | Step 3 (Intake) |
| `chrome_fetch` / `serp_select` / `serp_deep_fetch` | — | — | Step 4 (SERP fetch) |
| `reddit_fetch` / `reddit_select` / `reddit_deep_fetch` | — | — | Step 4.7 (Reddit) (skip if module off — stage never entered). Re-entry point is always the top of Step 4.7 (open a fresh tab per Step 4.1 if the earlier one is gone). |
| `x_fetch` / `x_select` / `x_deep_fetch` | — | — | Step 4.8 (X) (skip if module off — stage never entered). Re-entry point is always the top of Step 4.8: open a tab per Step 4.1; rerun the Browser gate (the sign-in preflight in the Browser section; X must be `signed_in`). |
| `competitor_check` | — | — | Step 4.85 (Competitor profile freshness re-check) (skip if module off — stage never entered) |
| `analyze_research` | — | — | Step 5 (Research analysis) |
| `synthesize_plan` | `none` | — | Step 6 (Plan synthesis) |
| `plan_review` | `none` | `plan-review.md` missing | Step 7 (dispatch plan-reviewer) |
| `plan_review` | `none` | `plan-review.md` verdict = approve (advance crashed before `current_stage=outline`) | Step 8 (Outline) |
| `plan_review` | `none` | `plan-review.md` verdict = request_revisions OR reject AND iteration ≤ 1 | Step 7 (apply fixes, re-dispatch) |
| `plan_review` | `none` | `plan-review.md` verdict = request_revisions OR reject AND iteration > 1 | Step 8 (proceed, concerns logged) |
| `outline` | `none` | `outline.md` missing | Step 8 (Outline) |
| `outline` | `none` | `outline.md` exists (Stage 2 finished but stage-advance crash before `current_stage=draft` was written) | Step 10 (Stage 3a draft) |
| `draft` | — | no `draft-v*.md` exists | Step 10 (Stage 3a draft) |
| `draft` | — | latest `draft-v<N>.md` exists AND `review-v<N>.md` archive exists AND NO `draft-v<N+1>.md` (revise-spawn crashed between archive and writer-finish) | Step 11.3 (retry revise from step 2; `cp` archive is idempotent) |
| `draft` | — | latest `draft-v<N>.md` exists, `review.md` missing OR a later `review-v<M>.md` archive exists with M < N (review.md is stale) | Step 11.1 (dispatch review on latest draft) |
| `review` | — | `review.md` verdict = `approve` | Step 12 (Stage 3c humanize) |
| `review` | — | `review.md` verdict = `request_revisions` AND iteration ≤ 2 | Step 11.3 (revise pass) |
| `review` | — | `review.md` verdict = `request_revisions` AND iteration > 2 | Step 11.2 escalate-to-human branch |
| `review` | — | `review.md` verdict = `reject` | Step 11.2 reject branch |
| `humanize` | — | — | Step 12 (Stage 3c humanize) |
| `resolve_markers` | — | latest draft still has `[VERIFY:]` or `[EXTERNAL_LINK_NEEDED:]` markers | Step 12.5 (Stage 3d auto-resolve) |
| `resolve_markers` | — | latest draft has no `[VERIFY:]`/`[EXTERNAL_LINK_NEEDED:]` left (stage finished, advance crashed before `current_stage=images`) | Step 13 (Stage 4a image plan) |
| `images` | — | `images.md` missing | Step 13 (Stage 4a image plan) |
| `images` | — | `images.md` exists (stage write crashed before advance) | Step 13.5 (Stage 4a.5 generate images) |
| `generate_images` | — | none of the expected file-producing image filenames present | Step 13.5 (run builder, all slots) |
| `generate_images` | — | SOME but not all expected file-producing image filenames present (partial render crash) | Step 13.5 (re-spawn; builder re-renders only the missing subset) |
| `generate_images` | — | ALL expected file-producing image filenames present (render done, advance crashed) AND (featured slot is file-producing OR the featured file exists on disk in `{assets_dir}/<slug>/`) | Step 14 (Stage 4b) |
| `generate_images` | — | ALL expected file-producing image filenames present, BUT featured slot is NOT file-producing (`screenshot`) AND the featured file does NOT exist on disk in `{assets_dir}/<slug>/` | Step 13.5 step 6 (featured-slot completion gate; pause, report manual-creation instructions to the human) |
| `action_items` | — | `action-items.md` missing | Step 14 (Stage 4b) |
| `action_items` | — | `action-items.md` exists (stage write crashed before advance) | Step 14.5 (Stage 4b.5 stage + open PR) |
| `preview` | `none` | staged `<slug>.md` missing in `{content_dir}` | Step 14.5 (stage + open PR) |
| `preview` | `none` | live `pr-monitor.json` with `mode: pr` (PR opened; the staged post may already be moved to `$BRANCH` and cleaned from the main tree at 7h, advance to `finalize` crashed) | Step 15 (present the PR Gate 2 banner + start the monitor cron) |
| `preview` | `none` | staged `<slug>.md` present, no live `pr-monitor.json` (PR-path crash mid-Stage-4b.5 before the state file was written) | Step 14.5 (re-enter; sub-steps are idempotent: collision guard 6a, worktree reuse 6b + its MANDATORY rebase onto `origin/{git.base_branch}` 6b2, inbound-link skip-if-present 5b, Remotion-source + archive-snapshot re-copy 6c, `pr-monitor.json` rewrite 6g) |
| `finalize` | `gate_2_final` | `{drafts_dir}/<slug>/pr-monitor.json` has `mode: pr` + `status` NON-terminal, BUT the PR is already **MERGED** on origin (`gh pr view <pr_number> --json state -q .state` == `MERGED`) AND (`{drafts_dir}/<slug>/approval.json` exists OR `pr-monitor.json` already has `status: approved`) | Step 15.3 finalize DIRECTLY (console-merge / already-merged-with-approval path): archive/bookkeeping/`mv` → `_archive`, complete the checklist, report. NO monitor, NO cron. (The console already merged the PR out-of-band, or a GitHub review approval was recorded and held before the merge; either way do NOT re-create a monitor.) |
| `finalize` | `gate_2_final` | `{drafts_dir}/<slug>/pr-monitor.json` exists with `mode: pr` and `status` not terminal | Step 16 (resume the PR monitor; re-create the cron if it is gone) |
| `finalize` | `gate_2_final` | `{drafts_dir}/<slug>/` still exists AND its `pr-monitor.json` has `mode: pr` + `status: done` (crash between `status=done` and the `mv`) | Step 15.3 PR finish from the `mv`: `mv {drafts_dir}/<slug>/` -> `_archive`, then Step 15.4 (complete the archived checklist), then Step 15.5 report |
| `finalize` | `gate_2_final` | `{drafts_dir}/<slug>/` missing AND `{drafts_dir}/_archive/<slug>/pr-monitor.json` has `mode: pr` + `status: done` (PR finalize crashed after archive push + mv) | Step 15.4 (complete the local archived checklist), then Step 15.5 report |
| `finalize` | `gate_2_final` | `{drafts_dir}/<slug>/` missing AND `{drafts_dir}/_archive/<slug>/` exists AND live post + asset folder exist on disk (bash ran, checklist update crashed) | Step 15.4 (finish post-finalize checklist update, then Step 15.5 report) |
| `complete` | any | — | skip; report draft is done |

**Key invariant:** once a stage completes, update `current_stage` to the NEXT stage before anything else. This is what keeps resume deterministic:

- Stage 3b approve: set `current_stage=humanize` before invoking humanizer
- Stage 3c success: set `current_stage=resolve_markers` before starting marker auto-resolution
- Stage 3d success: set `current_stage=images` before invoking image-planner
- Stage 4a success: set `current_stage=generate_images` before invoking the image-builder
- Stage 4a.5 success: set `current_stage=action_items`
- Stage 4b success: set `current_stage=preview`
- Stage 4b.5 success: set `current_stage=finalize`, `gate_pending=gate_2_final`
- Stage 1c success (plan synthesized): set `current_stage=plan_review` immediately (no human gate)
- Stage 1c.5 approve (plan review): set `current_stage=outline` immediately (no human gate)
- Stage 2 success (outline written): set `current_stage=draft` immediately (no human gate; the workflow flows straight into Stage 3a)

If `current_stage` hasn't advanced, resume treats the stage as incomplete and re-dispatches.

`iteration` is derivable as `max N where draft-v<N>.md exists`. Plan-review iteration is derivable as `(number of archived plan-review-v<N>.md files) + 1`.

Expected file-producing image filenames = every file-producing slot's `Suggested filename` in `images.md`: every entry whose `Type` is `remotion` or `ai-prompt` (codex-generated since v0.4.0). Only `Type: screenshot` slots never produce a file through the pipeline (the builder records them as `screenshot_pending`) and are excluded from the comparison.

4. Brief the user: "Resuming <slug>, next step is <description>."

### Step 2.5, From the plan (standalone blogs)

Decide the blog's mode as `/pilcrino:plan-content` Step 0 (Mode) does:
registered when `~/.pilcrino/console/blogs.json` lists this repository's main
checkout (`git rev-parse --git-common-dir`, parent directory, real paths
compared), else standalone (not a git repo, no file or no entry also mean
standalone). Registered blogs, and standalone blogs with no
`blog-ops/content-plan.md`, continue to Step 3 unchanged. This step writes
nothing.

Standalone, when `blog-ops/content-plan.md` exists:
1. `new <slug>`: find the row with that slug. `new` with no slug: list the
   `planned` rows (number, slug, title) and ask which one, or "none, start
   from scratch". No row for the slug, or a row whose Status is not
   `planned`: say so and ask whether to start from scratch. "None" or
   "from scratch" continues to Step 3 unchanged.
   Rows whose `{drafts_dir}/<slug>/checklist.md` exists are in progress:
   leave them out of the `new` list, and for `new <slug>` say "in progress,
   run `resume <slug>`" and stop. Rows whose `{drafts_dir}/_archive/<slug>/`
   exists are already written: leave them out, and for `new <slug>` say
   "already written, run `published <slug>` once it is live" and stop.
   When the file has no `planned` row to offer (for example the wizard's
   empty scaffold), say so in one line and continue to Step 3 as a plain
   `new`.
2. Take the row's Title / keyword as the target keyword, Angle as the angle,
   Author as `author_voice` when non-empty, and from its `## Details` block
   the `Page type:` (it sets the brief's intent default, same table as the
   Intent default in Autopilot's intake) and the `Requirements:` list (a bare
   `-` item is an empty line), to be copied verbatim into `brief.md` as a
   `## Requirements` section. When the requirements contain a `Mention:`
   line, those names prefill the persona's competitors question (module on)
   and are validated there as usual.
3. Hold these as the intake defaults. Step 3 then runs the persona's Stage 0
   with them: step 2's questions are shown prefilled for confirmation or
   change, step 5 proposes the row's author, step 6 proposes the row's slug.
   A rename edits the row's Slug cell and its `### <slug>` heading. Before
   changing anything, the new slug must be valid (lowercase letters, digits,
   single hyphens, at most 80 characters), must not equal any other row's
   slug in the table whatever its status (planned, published, dropped), and
   must not have an existing `{drafts_dir}/<slug>/` or
   `{drafts_dir}/_archive/<slug>/`. On a clash, say which row or folder it
   clashes with and ask for another slug. The brief is written once, at
   Stage 0 step 8, as for any post.

A row's Status column stays `planned` through writing, approval and the
merge; `published <slug>` (Step 16.5) sets it to `published`.

### Step 3, Intake (Stage 0, main session, conversational)

Follow editor persona §Stage 0, Intake. Three skill-specific requirements on top of the persona contract:

- During Q&A, explicitly ask whether to enable each **config-enabled** research source. Reddit is offered ONLY if `modules.reddit_research` is on; X is offered ONLY if `modules.x_research` is on; a module that is off is never surfaced to the human. `serp` is always on. Save the choices to `brief.md` under a "Research sources enabled" section: `serp` (always), `reddit` (yes/no — only if the module is on), `x` (yes/no — only if the module is on).
- **Category (conditional on `{profile_dir}/site-conventions.md` existing).** If that file exists, read its §Categories (taxonomy list + per-cluster mapping table, cross-referenced against `{profile_dir}/blog.md` §Content pillars): propose the category the mapping table assigns to this post's pillar, confirm it with the human (their override must be either an existing taxonomy name or an explicit "create new: `<name>`"), and save the resolved name to `brief.md`'s Category field. If `site-conventions.md` doesn't exist yet for this blog (no adapter site-inspection has run, or the blog has no existing categories to inspect), ask free-text and save whatever the human gives, or "none" if they have no preference — the wordpress-rest adapter's §Staging category-resolution step only runs when a category was actually planned here, so "none" is safe (WordPress falls back to its own "Uncategorized" default, which is only a bug when a category WAS planned and didn't make it through).
<!-- module: competitors -->
- **Per competitor named, validate against the base branch's profiles.** Profiles in `{competitors_dir}` are the source of truth for competitor pricing and features, and they live on `origin/{git.base_branch}`, not in this post's working tree. Follow `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/competitor-profiles.md`:
  1. Run `competitor-profiles.mjs` in list mode (always, while `modules.competitors` is on, even if the human names no competitor) and apply reference rule 5 first. Show the human the listed profiles (`name`, `lastVerified`) so they pick from profiled competitors.
  2. Match and date-check every named competitor per the reference's rules 1, 2 and 5. A hard stop → **HARD-HALT**: say which rule failed, that the profile must be added or refreshed (per `methodology.md`, or with Refresh on the console's Competitors screen) and that refreshing lands on the base branch so a resume sees it. Set checklist `status: paused`; do NOT proceed.
  3. Save matched competitors to `brief.md` "Competitors to mention" per the resolved template `brief.md`: `Name | Profile path`, where the path is the identity `{competitors_dir}/<slug>.md` (reference rule 7). The table triggers Step 4.85 (Stage 1.5c).
<!-- /module -->
- If the human says "pause" / "stop" / "nevermind" during intake: set checklist `status: paused`, acknowledge, end gracefully.

When intake is complete, continue to Step 4.

### Step 4, Browser SERP fetch (Stage 1a, main session, MCP)

**Preflight:** run the sign-in gate in §Browser above (`login_status`). Any site not `signed_in` → stop (or park) per that section.

#### Step 4.1, Create a dedicated tab

```
mcp__plugin_pilcrino_pilcrino-browser__tabs
  action: open
  url: about:blank
```

Note the returned `tabId`. Use this tab for all navigation below and close it at Step 4.9.

#### Step 4.2, Capture the SERP

```
mcp__plugin_pilcrino_pilcrino-browser__navigate
  tabId: <tabId>
  url: https://www.google.com/search?q=<URL-encoded target keyword>

mcp__plugin_pilcrino_pilcrino-browser__wait
  tabId: <tabId>
  ms: 2000

mcp__plugin_pilcrino_pilcrino-browser__capture
  tabId: <tabId>
  outFile: {drafts_dir}/<slug>/research/_raw/_serp.json
  script: |
    if (/unusual traffic/i.test(document.body.innerText) || location.pathname.startsWith('/sorry')) return { blocked: 'unusual_traffic', query: new URLSearchParams(location.search).get('q') };
    const results = Array.from(document.querySelectorAll('a[jsname][href^="http"]'))
      .map(a => ({ url: a.href, title: a.querySelector('h3')?.innerText || '' }))
      .filter(r => r.title && !r.url.includes('google.com') && !r.url.includes('youtube.com/watch'))
      .slice(0, 10);
    const features = [];
    if (document.querySelector('[data-attrid*="generative"]')) features.push('ai_overview');
    if (document.querySelector('[data-attrid*="answer"]')) features.push('featured_snippet');
    if (document.body.innerText.includes('People also ask')) features.push('people_also_ask');
    if (document.querySelector('[data-sgsc]')) features.push('shopping');
    return {
      query: new URLSearchParams(location.search).get('q'),
      searchedAt: new Date().toISOString(),
      serpFeatures: features,
      topResults: results.map((r, i) => ({ rank: i + 1, url: r.url, title: r.title }))
    };
```

The tool returns only `{path, bytes, items}`. `Read` the file. If it holds `{"blocked": ...}` or `topResults` is empty: stop, report to the user, pause the workflow (autopilot: park `serp_blocked`). Do not try curl or Playwright.

#### Step 4.3, Editor selects 5–8 results to deep-fetch

Read `_serp.json` (small, safe to ingest into skill context). Read `{drafts_dir}/<slug>/brief.md` for angle context.

Apply editorial judgment: select the results needed to understand the dominant search intent, **aim for 5–8, hard cap 8**, stopping when additional results stop adding new angles or formats. The 5–8 figure is a target, not a floor: when the SERP has fewer than 5 genuine relevant articles after skipping homepages / paywalled / spam, selecting fewer is correct and not a failure. Selection criteria (from editor persona Stage 1a):
- Genuine articles, not homepages / category pages / pure product pages / Pinterest pins
- Relevance to the post's intent + angle
- Mix of ranks if useful (don't always pick top-ranked sequentially, sometimes rank 7 has a sharper angle than rank 2)
- Skip paywalled / auth-required pages
- Skip pages already known to be SEO-spam

Write `{drafts_dir}/<slug>/research/_raw/_serp_selection.md` with the rationale:

```
# SERP selection: <target keyword>

Observed intent: <informational | commercial | comparison | transactional | navigational> (one line: what the live top results actually are)

Reviewed top N results from `_serp.json`. Selected M (target 5–8, hard cap 8; fewer allowed when the SERP warrants it) for deep fetch:

1. (rank X) <url> , <one-sentence why>
2. (rank Y) <url> , <one-sentence why>
...

Skipped:
- rank A (<one-line reason>)
- rank B (<one-line reason>)
...
```

This selection rationale is auditable, humans can see why specific results were prioritized.

#### Step 4.4, Per-result deep fetch (iterate ONLY the selected URLs)

For each of the selected URLs (up to 8), loop. Use the original SERP rank in the filename so the order is preserved:

```
mcp__plugin_pilcrino_pilcrino-browser__navigate
  tabId: <tabId>
  url: <result URL>

mcp__plugin_pilcrino_pilcrino-browser__wait
  tabId: <tabId>
  ms: 3000

mcp__plugin_pilcrino_pilcrino-browser__capture
  tabId: <tabId>
  outFile: {drafts_dir}/<slug>/research/_raw/<NN>-<host>.json
  script: |
    const getLinks = (filter) => Array.from(document.querySelectorAll('a[href]'))
      .filter(filter)
      .map(a => ({ href: a.href, text: (a.innerText || '').trim().substring(0, 200), rel: a.rel || '' }))
      .slice(0, 50);
    return {
      rank: <rank>,
      url: window.location.href,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || '',
      h1: document.querySelector('h1')?.innerText || '',
      h2s: Array.from(document.querySelectorAll('h2')).map(h => h.innerText).slice(0, 30),
      h3s: Array.from(document.querySelectorAll('h3')).map(h => h.innerText).slice(0, 50),
      wordCount: (document.body.innerText || '').split(/\s+/).filter(Boolean).length,
      bodyText: (document.body.innerText || '').substring(0, 20000),
      externalLinks: getLinks(a => /^https?:\/\//.test(a.href) && !a.href.includes(location.hostname)),
      internalLinks: getLinks(a => a.getAttribute('href')?.startsWith('/')),
      fetchedAt: new Date().toISOString(),
      fetchStatus: 'ok'
    };
```

Fill `<rank>` and `<NN>-<host>` per iteration (e.g., `01-example-com.json`). The tool result is only `{path, bytes, items}`; do not `Read` these files here (Stage 1b's `blog-researcher` reads them).

#### Step 4.5, Handle fetch failures

If navigation or extract fails (captcha, bot block, timeout; a `navigate` error or a `capture` `script_error` counts as a failed fetch):
- Write a minimal failure JSON via `Write` to the same `<NN>-<host>.json` path:
  ```json
  {"rank": <N>, "url": "<url>", "fetchStatus": "failed", "error": "<reason>"}
  ```
- Continue with the next URL; don't abort on a single failure
- If >50% of selected URLs fail: stop; report to user; offer retry / proceed-partial / abandon
- Do NOT fall back to Playwright or curl

#### Step 4.6, Update checklist

Update `{drafts_dir}/<slug>/checklist.md`:
- Frontmatter: `current_stage=serp_deep_fetch`, `current_owner=blog-post-workflow`
- Tick Stage 1a items: `_serp.json written`, `_serp_selection.md written`, `NN-*.json written`
- Append stage log: `SERP fetch completed: <ts>, N selected, M failed`

Continue sequentially through Steps 4.7 (Reddit), 4.8 (X), and 4.85 (Competitor freshness re-check). Each stage self-gates on its own module + brief.md signal (`reddit: yes`, `x: yes`, "Competitors to mention" non-empty), so it's safe to step through them in order; disabled stages no-op.

### Step 4.7, Reddit research (Stage 1.5a, optional)

Run only if `modules.reddit_research` is on AND `brief.md` "Research sources enabled" includes `reddit`. Skip otherwise (a module that is off is never offered at intake, so the brief can't say yes; both conditions must hold).

Reddit has exactly one path: the Pilcrino browser. Step 4.7.4 passes Reddit's JS challenge once, then the tab `fetch()`es Reddit's `.json` URLs same-origin and `capture` writes the responses to disk. Never DOM-scrape Reddit, and never fall back to curl or Playwright.

Same select-then-fetch pattern as SERP.

#### Step 4.7.1, Capture Reddit search results (raw JSON)

Run Step 4.7.4's challenge pass and Search capture to produce `_reddit_search.json`, then `Read` it.

If the file holds `{"blocked": ...}`: Reddit is challenging the Pilcrino browser. Interactive: ask the user to open reddit.com in the Pilcrino browser window and pass the check, then retry once; if it still fails, mark Stage 1.5a skipped and continue. Autopilot: park `captcha_or_login` with `reddit` in detail.

If it holds `fetchStatus: failed` (non-JSON response: a block or login page), or the `capture` itself errors: mark Stage 1.5a skipped and continue to the next stage.

#### Step 4.7.2, Editor selects up to 5 threads

Read `_reddit_search.json` (Reddit's native search response, as Step 4.7.1 captured it). The native Reddit shape is:

```json
{
  "data": {
    "children": [
      {"kind": "t3", "data": {
        "title", "subreddit", "author", "score",
        "num_comments", "permalink", "selftext",
        "url", "created_utc", "id"
      }},
      ...
    ]
  }
}
```

Apply selection criteria from editor persona Stage 1.5a:
- Real discussions (`num_comments` ≥ 10 typically)
- Recent (`created_utc` within last 12–24 months ideal)
- On-topic title (Reddit's relevance ranking is fuzzy on short queries, many top results may be unrelated; this filter matters)
- `score` ≥ 5
- Mix of subreddits if interesting

Write `{drafts_dir}/<slug>/research/_raw/_reddit_selection.md` with rationale (same shape as `_serp_selection.md`). Include each selected thread's `permalink` so Step 4.7.3 knows which to fetch.

#### Step 4.7.3, Per-thread deep fetch (raw JSON)

For each selected thread (max 5), construct the `.json` path by stripping the trailing slash from `permalink` and appending `.json` (the slug stays, only the trailing slash is removed):

- `permalink`: `/r/Sub/comments/abc123/some_slug/`
- Fetch path: `/r/Sub/comments/abc123/some_slug.json?limit=20&sort=top`

`<NN>` = rank in `_reddit_search.json` (preserves selection order).
`<short>` = abbreviated subreddit or post id (e.g., `shopeeph` or `1leaahu`).

Run Step 4.7.4's Threads capture with ALL selected threads in ONE call, then split on disk into `reddit-<NN>-<short>.json` files. Every thread the capture could not fetch gets a minimal failure JSON via `Write` to `{drafts_dir}/<slug>/research/_raw/reddit-<NN>-<short>.json` (this thread's own `<NN>-<short>`, the SAME path the split would have written to):
```json
{"rank": <N>, "permalink": "<permalink>", "fetchStatus": "failed", "error": "<reason>"}
```
Then proceed to Step 4.7.5's aggregate failure check.

The native Reddit thread JSON is a 2-element array: `[postListing, commentListing]`. The post is at `[0].data.children[0].data` (kind `t3`); top-level comments at `[1].data.children[].data` (kind `t1`, may have `kind: more` for "load more" entries which are skipped). The researcher subagent knows this shape.

#### Step 4.7.4, Browser mechanics for Reddit

- **Pass the JS challenge first.** `navigate` to `https://www.reddit.com/` and `wait` 3000 ms; Reddit serves a one-time interstitial. After it resolves the tab is on the reddit.com origin and can `fetch()` its `.json` URLs same-origin.
- **One capture per step.** Selection happens between search and threads, so this is two captures total.

```
mcp__plugin_pilcrino_pilcrino-browser__navigate
  tabId: <tabId>
  url: https://www.reddit.com/

mcp__plugin_pilcrino_pilcrino-browser__wait
  tabId: <tabId>
  ms: 3000
```

Search (Step 4.7.1):
```
mcp__plugin_pilcrino_pilcrino-browser__capture
  tabId: <tabId>
  outFile: {drafts_dir}/<slug>/research/_raw/_reddit_search.json
  script: |
    if (/prove your humanity/i.test(document.body.innerText)) return { blocked: 'captcha' };
    const r = await fetch('https://www.reddit.com/search.json?q=<URL-encoded keyword>&sort=relevance&t=year&limit=25', { headers: { Accept: 'application/json' } });
    const t = await r.text();
    try { return JSON.parse(t); } catch (e) { return { fetchStatus: 'failed', status: r.status, error: 'not JSON (block or login page)' }; }
```
`Read` the file. `{"blocked": ...}` or `fetchStatus: failed`: a fetch failure (autopilot: `captcha_or_login` when blocked, otherwise skip at 4.7.1).

Threads (Step 4.7.3), all selected threads in ONE capture to a combined file, then split on disk. Per-thread retry stays: Reddit intermittently returns 503 on one thread. **`nn` must carry the `<NN>-<short>` shape declared in Step 4.7.3** (e.g. `00-shopeeph`), not a bare rank: the split writes `reddit-<nn>.json` verbatim, which is the `reddit-NN-*.json` shape the `blog-researcher` agent globs.
```
mcp__plugin_pilcrino_pilcrino-browser__capture
  tabId: <tabId>
  outFile: {drafts_dir}/<slug>/research/_raw/_reddit_threads.json
  script: |
    const T = [{ nn: '00-shopeeph', u: '/r/Sub/comments/abc123/some_slug.json?limit=20&sort=top' } /*, one per selected thread; nn is '<NN>-<short>' as Step 4.7.3 declares */];
    const getJSON = async (u) => { for (let i = 0; i < 3; i++) { try { const r = await fetch('https://www.reddit.com' + u, { headers: { Accept: 'application/json' } }); if (r.ok) return JSON.parse(await r.text()); } catch (e) {} await new Promise(s => setTimeout(s, 1500)); } return null; };
    const out = {}, missed = [];
    for (const x of T) { const j = await getJSON(x.u); if (j) out[x.nn] = j; else missed.push(x.nn); await new Promise(s => setTimeout(s, 800)); }
    return { out, missed };
```
Split:
```
Bash: python3 -c "import json;d=json.load(open('{drafts_dir}/<slug>/research/_raw/_reddit_threads.json'));[json.dump(v,open('{drafts_dir}/<slug>/research/_raw/reddit-'+k+'.json','w')) for k,v in d['out'].items()];print('missed',d['missed'])"; rm -f {drafts_dir}/<slug>/research/_raw/_reddit_threads.json
```
Every `nn` in `missed` gets the Step 4.7.3 failure JSON via `Write`. If the Threads `capture` itself errors (no combined file written), every selected thread gets that failure JSON and the split is skipped. Then Step 4.7.5's aggregate check.

Do NOT return fetched JSON through a tool result or `Read` the thread files here: they are for the `blog-researcher` agent.

#### Step 4.7.5, Aggregate failure check

Reached once Step 4.7.3's thread capture, split and failure writes are done. Count failed threads against the number selected in Step 4.7.2: a thread counts as failed if EITHER (a) `research/_raw/` has no `reddit-<NN>-*.json` for it at all, OR (b) the `reddit-<NN>-*.json` that IS there is itself a failure JSON (`"fetchStatus": "failed"`, per 4.7.3's shape). **(b) matters because the failure JSON deliberately uses the SAME filename the success path would have used**: file presence alone is NOT proof of success. If more than 50% of selected threads failed (by this a-or-b count): stop, report to user, offer retry / proceed-partial / skip-reddit (the same three options as the SERP aggregate check in Step 4.5, with "skip-reddit" standing in for "abandon"). This is the single authoritative failure threshold for Step 4.7's thread fetch.

Update checklist: tick Stage 1.5a items.

### Step 4.8, X research (Stage 1.5b, optional)

Run only if `modules.x_research` is on AND `brief.md` "Research sources enabled" includes `x`. Skip otherwise (both conditions must hold).

Same select-then-fetch pattern. **Requires X sign-in** in the Pilcrino browser; the §Browser sign-in gate already confirmed `x` is `signed_in`. If X shows a login wall mid-run, stop X research and report to the user (autopilot: park `captcha_or_login` with `x` in detail).

#### Step 4.8.1, Capture X search results

X's SPA needs longer to load:

```
mcp__plugin_pilcrino_pilcrino-browser__navigate
  tabId: <tabId>
  url: https://x.com/search?q=<URL-encoded keyword>&f=top

mcp__plugin_pilcrino_pilcrino-browser__wait
  tabId: <tabId>
  ms: 4000

mcp__plugin_pilcrino_pilcrino-browser__capture
  tabId: <tabId>
  outFile: {drafts_dir}/<slug>/research/_raw/_x_search.json
  script: |
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, 25);
    const posts = articles.map((el, i) => {
      const linkEl = el.querySelector('a[href*="/status/"]');
      const url = linkEl ? new URL(linkEl.getAttribute('href'), 'https://x.com').href : '';
      const handle = el.querySelector('a[href^="/"][tabindex="-1"]')?.getAttribute('href')?.replace('/', '') || '';
      const author = el.querySelector('div[data-testid="User-Name"] a span')?.innerText || '';
      const text = el.querySelector('div[data-testid="tweetText"]')?.innerText || '';
      const getStat = (testid) => parseInt(el.querySelector(`[data-testid="${testid}"]`)?.innerText.replace(/[^\d]/g, '') || '0');
      return {
        rank: i + 1, url, author, handle,
        text: text.substring(0, 800),
        replies: getStat('reply'),
        reposts: getStat('retweet'),
        likes: getStat('like')
      };
    }).filter(p => p.url && p.text);
    return {
      query: new URLSearchParams(location.search).get('q'),
      searchUrl: location.href,
      searchedAt: new Date().toISOString(),
      results: posts
    };
```

The tool returns only `{path, bytes, items}`. `Read` the file. If `results` is empty: stop X research; mark Stage 1.5b as skipped; continue.

**If `f=top` is off-topic, re-pull `f=live`.** On niche queries the "Top" tab often returns popular-but-unrelated posts (engagement-ranked, not relevance-ranked). Skim the captured results; if most are off-topic, re-run the navigate, wait and capture with `&f=live` (Latest) and keep whichever tab is on-topic. `_x_search.json` must end up holding the kept set (the second capture overwrites it; re-capture `f=top` if that was the better tab). Note in `_x_selection.md` which tab you used and why.

#### Step 4.8.2, Editor selects up to 5 posts

Read `_x_search.json`. Apply editor persona Stage 1.5b criteria:
- Likes >50 OR meaningful reply count
- Real takes (not pure self-promotion / affiliate-link spam)
- Mix of perspectives (not 5 takes that all agree)
- Skip retweet-of-retweet chains

Write `{drafts_dir}/<slug>/research/_raw/_x_selection.md` with rationale.

#### Step 4.8.3, Per-post deep fetch

For each selected post URL (max 5). A selected URL may be an X Article (long-form) rather than a post; the script below handles both and records `kind`:

```
mcp__plugin_pilcrino_pilcrino-browser__navigate
  tabId: <tabId>
  url: <post URL>

mcp__plugin_pilcrino_pilcrino-browser__wait
  tabId: <tabId>
  ms: 4000

mcp__plugin_pilcrino_pilcrino-browser__capture
  tabId: <tabId>
  outFile: {drafts_dir}/<slug>/research/_raw/x-<NN>-<handle>.json
  script: |
    const article = document.querySelector('[data-testid="twitterArticleReadView"]');
    if (article) {
      return {
        rank: <rank>, url: location.href, kind: 'article',
        title: article.querySelector('h1, [data-testid="twitterArticleTitle"]')?.innerText || document.title,
        author: document.querySelector('div[data-testid="User-Name"] a span')?.innerText || '',
        handle: document.querySelector('a[href^="/"][tabindex="-1"]')?.getAttribute('href')?.replace('/', '') || '',
        text: Array.from(article.querySelectorAll('p, h2, h3, li')).map(e => e.innerText.trim()).filter(Boolean).join('\n\n').substring(0, 20000),
        date: document.querySelector('time')?.getAttribute('datetime') || '',
        topReplies: [], fetchedAt: new Date().toISOString(), fetchStatus: 'ok'
      };
    }
    const main = document.querySelector('article[data-testid="tweet"]');
    const text = main?.querySelector('div[data-testid="tweetText"]')?.innerText || '';
    const author = main?.querySelector('div[data-testid="User-Name"] a span')?.innerText || '';
    const handle = main?.querySelector('a[href^="/"][tabindex="-1"]')?.getAttribute('href')?.replace('/', '') || '';
    const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const replies = allArticles.slice(1, 11).map(el => ({
      author: el.querySelector('div[data-testid="User-Name"] a span')?.innerText || '',
      handle: el.querySelector('a[href^="/"][tabindex="-1"]')?.getAttribute('href')?.replace('/', '') || '',
      text: (el.querySelector('div[data-testid="tweetText"]')?.innerText || '').substring(0, 600),
      likes: parseInt(el.querySelector('[data-testid="like"]')?.innerText.replace(/[^\d]/g, '') || '0')
    })).filter(r => r.text);
    return {
      rank: <rank>,
      url: location.href,
      kind: 'post',
      author, handle,
      text,
      topReplies: replies,
      fetchedAt: new Date().toISOString(),
      fetchStatus: 'ok'
    };
```

X is aggressive on rate-limits, wait 5 seconds between navigates.

Apply same failure handling. Update checklist: tick Stage 1.5b items.

<!-- module: competitors -->
### Step 4.85, Competitor profile freshness re-check (Stage 1.5c, mandatory when brief.md lists competitors, file-read only, no Chrome)

Run only if `modules.competitors` is on AND `brief.md` "Competitors to mention" has at least one row. Skip otherwise (empty table = no competitors = no check).

**Why this stage exists:** competitor pricing and features come from the base branch's profiles (`references/competitor-profiles.md`). Stage 0 intake already validated each named competitor has a profile and that the profile is fresh. This stage is a **defense-in-depth re-check** that catches the case where a workflow was paused for >14 days between intake and Stage 1b, during which a profile aged past the freshness window. No Chrome and no `_raw/` artifacts: a `git fetch`, a snapshot and date arithmetic.

The writer is forbidden from using `[VERIFY:]` for competitor pricing or features (`${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §"Competitor pricing and feature claims"). The freshness gate is what gives that rule teeth: if a profile is stale, the workflow halts and the human refreshes the profile (it lands on the base branch) before any draft is written.

#### Step 4.85.1, Snapshot and re-validate every named competitor

Always run this step from the top, including on a resume: a retry after a refresh lands here, and the snapshot is what makes the refresh visible.

1. Run `competitor-profiles.mjs` in snapshot mode with `--out {drafts_dir}/<slug>/research/profiles` (`references/competitor-profiles.md`). A non-zero exit is a hard stop (reference rule 4).
2. For each row in `brief.md` "Competitors to mention", find its profile in the JSON by comparing the row's identity path file name (last segment) with the file name (last segment) of the JSON `file`. Not listed → **HARD-HALT** per reference rule 1; `lastVerified` null or more than 14 days old → **HARD-HALT** per rule 2. Use the reference's message, set checklist `status: paused`.

Halt on the FIRST failure. The human refreshes the offending profile on the Competitors screen, then resumes; the resume re-runs this step from the top.

#### Step 4.85.2, Update checklist on pass

If every competitor's profile passes, the snapshot in `{drafts_dir}/<slug>/research/profiles/` is the artifact. Update `{drafts_dir}/<slug>/checklist.md`:

- Frontmatter: `current_stage=competitor_check`, `current_owner=blog-post-workflow`
- Tick Stage 1.5c items: `competitor profile freshness re-check passed`
- Append stage log: `Stage 1.5c profile freshness re-check passed: <ts>, N competitors validated against <source> at <commit>`
<!-- /module -->

### Step 4.9, Hand off to research analysis

Close the research tab: `mcp__plugin_pilcrino_pilcrino-browser__tabs action: close tabId: <tabId>`.

When all enabled research stages (SERP + optionally Reddit + X + optionally competitors) have completed, continue to Step 5 (research analysis).

### Step 5, Research analysis (Stage 1b, delegate to `blog-researcher` subagent)

Update checklist frontmatter before spawning: `current_stage=analyze_research`, `current_owner=blog-researcher`, `last_updated=<now>`. Append stage log: `Stage 1b started: <ts>, sources=<list>`.

Determine which sources to analyze by checking `brief.md` "Research sources enabled" + `brief.md` "Competitors to mention" + verifying the source's `_raw/` sentinel file exists:

| Source | Sentinel file (must exist) | Trigger |
|---|---|---|
| `serp` | `_raw/_serp.json` | always |
| `reddit` | `_raw/_reddit_search.json` | brief.md "Research sources enabled, reddit: yes" |
| `x` | `_raw/_x_search.json` | brief.md "Research sources enabled, x: yes" |
| `competitors` | n/a (no `_raw/` artifact; reads the Stage 1.5c snapshot in `research/profiles/`) | brief.md "Competitors to mention" non-empty (Stage 1.5c freshness re-check passed) |

Pass the list of confirmed-enabled sources as `sources=...` (e.g., `sources=serp,reddit,competitors`).

```
Agent tool call:
  subagent_type: blog-researcher
  prompt:
    """
    slug=<slug>
    target_keyword=<keyword>
    sources=<comma-separated list, e.g., "serp" or "serp,reddit" or "serp,reddit,x">
    brief_excerpt=<relevant portions of {drafts_dir}/<slug>/brief.md>
    profile_paths=<only when sources includes competitors: comma-separated `path` value from the Stage 1.5c snapshot run's JSON, for each brief row>
    """
```

Wait for return. Verify each expected `{drafts_dir}/<slug>/research/<source>.md` exists.

If any missing/empty: re-spawn ONCE for the failing sources. Second failure → stop and report.

Update checklist: tick Stage 1b items for each completed source; `current_owner=blog-post-workflow`.

### Step 6, Plan synthesis (Stage 1c, main session)

Follow editor persona §Stage 1c. On completion, set `plan.md` status `awaiting_plan_review`, and the checklist must reflect `current_stage=plan_review`, `gate_pending=none`, and Stage 1c items ticked. Continue to Step 7 (Stage 1c.5, Plan review).

### Step 7, Plan review (Stage 1c.5, delegate to `plan-reviewer`)

Gate 1 is replaced by an independent automated review (same loop shape as Stage 3b). Checklist already has `current_stage=plan_review`, `gate_pending=none`, plan `awaiting_plan_review` (from Step 6).

1. Dispatch `plan-reviewer` (mid-tier model) with paths: `plan.md`, `brief.md`, `facts.md`, `research/serp.md`, `research/reddit.md` and `research/x.md` when present, `{profile_dir}/product.md` when `modules.product` is on, `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md`. It writes `plan-review.md` per the resolved template `plan-review.md`.
2. On verdict:
   - **approve** → plan status `approved`, `current_stage=outline`; continue to Step 8. Do NOT archive `plan-review.md` (the gate needs it on disk).
   - **request_revisions / reject, iteration ≤ 1** → archive review as `plan-review-v<N>.md`, apply the reviewer's revision instruction to `plan.md`, re-dispatch. Cap 1 revision pass (max two reviewer dispatches total — a plan still contested after one revision proceeds anyway, so a third dispatch buys nothing).
   - **request_revisions / reject, iteration > 1** → proceed: plan `approved`, `current_stage=outline`, log residual concerns to checklist Notes (Stage 3b is the backstop).

Every non-`approve` verdict must hit the loop or ceiling so a crash can't strand `current_stage=plan_review`.

### Step 8, Outline (Stage 2, main session)

Runs immediately after Stage 1c.5 plan review approves, or on resume when `plan.md` status = `approved` and `outline.md` is missing.

Follow editor persona §Stage 2 for inputs, rules, and the outline shape. The outline has **no human gate**, the editor's editorial judgment closes Stage 2 and the workflow continues straight to Step 10 (Stage 3a draft). Any structural problem with the outline surfaces later as a Stage 3b reviewer issue, which forces a writer revise pass.

On completion:

- Set outline status to `approved` directly (no `awaiting_gate_2` intermediate state)
- Checklist frontmatter: `current_stage=draft`, `current_owner=blog-post-workflow`, `last_updated=<now>`, `gate_pending=none`
- Tick Stage 2 items; append stage log `outline completed: <ts>, auto-progressing to Stage 3a (no human gate)`

Continue immediately to Step 10 (Stage 3a draft).

### Step 10, Draft (Stage 3a, delegate to blog-writer subagent)

Runs immediately after Step 8 (Outline) finishes, or on resume when `outline.md` status = `approved` and no `draft-v*.md` exists.

The editor persona's "Stage 3a, Writing" section is the dispatch contract. The blog-writer persona at `${CLAUDE_PLUGIN_ROOT}/personas/writer.md` is the full drafting contract, the writer subagent reads it at start and follows it.

#### Step 10.1, Verify inputs before spawning

Required:
- `{drafts_dir}/<slug>/outline.md` status `approved`
- `{drafts_dir}/<slug>/facts.md`
- `{drafts_dir}/<slug>/brief.md`
- `{drafts_dir}/<slug>/research/serp.md`

Optional (read by writer if present):
- `{drafts_dir}/<slug>/research/reddit.md`
- `{drafts_dir}/<slug>/research/x.md`

If any required input is missing: do NOT spawn. Report to human and pause.

#### Step 10.2, Update checklist frontmatter

- `current_stage=draft`, `current_owner=blog-writer`, `last_updated=<now>`
- Append stage log: `Stage 3a started: <ts>`

#### Step 10.3, Spawn blog-writer subagent

```
Agent tool call:
  subagent_type: blog-writer
  prompt:
    """
    slug=<slug>
    mode=draft
    author_voice=<from brief.md>
    """
```

#### Step 10.4, Verify output

After the subagent returns:

1. Verify `{drafts_dir}/<slug>/draft-v1.md` exists.
2. Check word count (via `wc -w`) is ≥ 500. If not, treat as truncated failure.
3. Quick frontmatter sanity check: the file starts with `---` and a `title:` line appears within the first 5 lines.
4. Quick forbidden-phrase grep against `{profile_dir}/voice.md` forbidden list. A handful of hits is tolerable (writer will flag); mass hits (>5 distinct forbidden phrases) is a quality failure.

#### Step 10.5, Failure handling

- **Missing file:** re-spawn ONCE with prompt supplemented: "the previous run did not produce {drafts_dir}/<slug>/draft-v1.md; ensure you call the Write tool with that exact path". Second failure → stop; report to human.
- **Truncated (<500 words):** re-spawn ONCE with: "the previous draft was truncated at <actual> words; the outline target is <target> words, write the full post through all H2 sections". Second failure → stop; report to human.
- **Missing frontmatter:** re-spawn ONCE with: "the draft must start with the exact frontmatter block per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Frontmatter". Second failure → stop.
- **Mass forbidden-phrase hits:** do NOT re-spawn. Flag to human with the grep output; human decides between manual edits, proceeding to Stage 3b/c for the review-and-humanize loop to catch residual issues, or abandon.

#### Step 10.6, Finalize Stage 3a

- Update checklist frontmatter: `current_owner=blog-post-workflow`
- Tick Stage 3a items
- Append the writer's handoff summary to the checklist's "Notes" section (Stage 3b reads it to contextualize the review)
- Append stage log: `Stage 3a completed: <ts>, word count <N>, draft-v1.md written`

Report completion to the human briefly, then continue to Step 11 (Stage 3b review) unless the human has paused:

```
Stage 3a complete, draft-v1.md written for <slug>.

- Word count: <N> (outline target: <M>)
- [VERIFY:] / [EXTERNAL_LINK_NEEDED:] / [INTERNAL_LINK_NEEDED:] / [IMAGE:] marker counts: <...>

Writer's surprises: <the ≤200-word handoff>

Proceeding to Stage 3b (editor review).
```

### Step 11, Review + Revise loop (Stage 3b, delegate to `blog-reviewer` subagent)

The editor persona's "Stage 3b, Review + Revise loop" section is the full contract. The reviewer's full procedure lives in `${CLAUDE_PLUGIN_ROOT}/skills/review-blog-post/SKILL.md` (the subagent reads it at spawn).

Runs after Step 10 completes, or on resume when `draft-v<N>.md` exists and `review.md` is missing.

#### Step 11.1, Dispatch review

1. Determine current iteration: highest N in `{drafts_dir}/<slug>/draft-v<N>.md`. Iteration 1 = draft-v1, 2 = draft-v2, 3 = draft-v3.
2. Pre-review length check (don't spend a reviewer cycle on a length-only failure): `wc -w` the body prose only (after frontmatter, intro through the end of the CTA, excluding the `## FAQ` block). If it is >+15% over the outline roll-up target, skip dispatching the reviewer subagent: instead, write a synthetic `review.md` yourself (Step 11.3 step 0 below), then continue through the normal Step 11.3 revise pass unchanged.
3. Update checklist frontmatter: `current_stage=review`, `current_owner=blog-reviewer`, `last_updated=<now>`. Append stage log: `Stage 3b review iteration <iter> started: <ts>`.
4. Spawn the reviewer subagent:
   ```
   Agent tool call:
     subagent_type: blog-reviewer
     prompt:
       """
       slug=<slug>
       iteration=<iter>
       draft_version=draft-v<N>   # optional; default is latest
       """
   ```
   (The agent stub specifies its own operating contract, tool access, and output shape; the spawn payload is just parameters.)
5. Wait for return. Verify `{drafts_dir}/<slug>/review.md` exists and contains a Verdict.

#### Step 11.2, Route on verdict

Read `{drafts_dir}/<slug>/review.md` §Verdict. Follow the routing rules from the editor persona's §Stage 3b verdict routing:

- **`approve`** → tick Stage 3b; `current_owner=blog-post-workflow`; continue to Step 12 (Stage 3c humanize).
- **`request_revisions` AND iteration ≤ 2** → go to Step 11.3 (revise pass).
- **`request_revisions` AND iteration > 2** → stop the loop; present the escalation message from the persona; wait for the human's choice (manual edits / retry from outline / abandon).
- **`reject`** → stop the loop; present the reject reason; ask the human to choose among retry from outline / manual edit / abandon.

#### Step 11.3, Revise pass (only if routing said revise)

0. **Only when arriving here via the Step 11.1 item 2 length shortcut** (the reviewer subagent was never dispatched this iteration): before doing anything else, fill the resolved template `review.md` yourself and `Write` it to `{drafts_dir}/<slug>/review.md`. This is the current iteration's review (it correctly overwrites any stale `review.md` left over from a prior iteration), so steps 1–2 below then operate on real, current-iteration content:
   - Verdict: `request_revisions`.
   - §9 "Instructions for writer": the trim-only instruction, verbatim and copy-paste-ready like any other §9 — state the target word count (the outline roll-up target ± tolerance) and which sections are over per the outline roll-up's per-section breakdown.
   - Header note, clearly marked: "**Synthetic length-gate review** — reviewer not dispatched (pre-review length check, Step 11.1 item 2)."
   - Every other section: `N/A` (no reviewer sweep ran).
   Then proceed to step 1; steps 1–6 are identical whether `review.md` came from the reviewer subagent or from this synthetic path.
1. Read `review.md` §9 "Instructions for writer" verbatim.
2. Archive the current `review.md` as `{drafts_dir}/<slug>/review-v<N>.md` (the iteration's review, preserved for history):
   ```
   Bash: cp {drafts_dir}/<slug>/review.md {drafts_dir}/<slug>/review-v<N>.md
   ```
   (The next review iteration will overwrite `review.md`; the archived copy stays.)
3. Update checklist: `current_stage=draft`, `current_owner=blog-writer`; append stage log: `Stage 3b revise iteration <iter+1> started: <ts>`. Setting `current_stage=draft` is load-bearing for two crash windows:
   - Between archive (step 2) and writer-finish: resume sees `current_stage=draft` + `review-v<N>.md` archive + no `draft-v<N+1>.md` → retry this step (Step 11.3) from step 2. The `cp` archive is idempotent.
   - Between writer-finish and next review dispatch: resume sees `current_stage=draft` + new `draft-v<N+1>.md` + stale `review.md` → Step 11.1 for a fresh review on the new draft.
4. Spawn `blog-writer` with `mode=revise`:
   ```
   Agent tool call:
     subagent_type: blog-writer
     prompt:
       """
       slug=<slug>
       mode=revise
       review_path={drafts_dir}/<slug>/review.md
       prior_draft_path={drafts_dir}/<slug>/draft-v<N>.md
       author_voice=<from brief.md>
       """
   ```
5. After the writer returns: verify `{drafts_dir}/<slug>/draft-v<N+1>.md` exists with ≥ 500 words and valid frontmatter (Stage 3a post-spawn sanity check). Failure handling: same as Step 10.5, re-spawn ONCE, second failure → stop and report.
6. Go back to Step 11.1 with the new draft (iteration incremented).

### Step 12, Humanize (Stage 3c, delegate to `blog-humanizer` subagent)

Triggered after Step 11 routes verdict = `approve`. The humanizer's full procedure lives in `${CLAUDE_PLUGIN_ROOT}/skills/humanize-text/SKILL.md` (the subagent reads it at spawn).

1. Update checklist frontmatter: `current_stage=humanize`, `current_owner=blog-humanizer`, `last_updated=<now>`. Append stage log: `Stage 3c started: <ts>`.
2. Spawn the humanizer subagent:
   ```
   Agent tool call:
     subagent_type: blog-humanizer
     prompt:
       """
       slug=<slug>
       draft_version=draft-v<N>   # optional; default is latest
       """
   ```
3. Wait for return.
4. Verify:
   - `{drafts_dir}/<slug>/draft-v<N>.md` still exists (agent edits in place)
   - Handoff reports `Preservation check: PASSED`
   - `{drafts_dir}/<slug>/.draft-v<N>.pre-humanize.md` no longer exists (agent deletes on success)
5. **Failure handling:**
   - **Preservation failed (`FAILED and restored`):** the draft is untouched; flag to human. Do NOT re-spawn, the failure means an invariant broke. Human decides between manual humanization, targeted `Edit`s, or shipping the non-humanized approved draft.
   - **Surviving forbidden-phrase hits:** report to human with line numbers from the handoff; the draft was preserved correctly but some phrases resisted the sweep. Human edits manually.
6. On success: update checklist: `current_owner=blog-post-workflow`, `current_stage=resolve_markers`. Append stage log: `Stage 3c completed: <ts>`. Record the humanize handoff summary in Notes.
7. Report completion to the human:

```
Stage 3c complete, draft-v<N>.md humanized for <slug>.

- Preservation check: PASSED
- Forbidden phrases: <before> → <after>
- Em-dash count: <before> → <after>
- Passive → active conversions: <N>
- Burstiness injections: <N>
- Word count delta: <before> → <after> (<Δ%>)

Proceeding to Stage 3d (marker auto-resolution).
```

### Step 12.5, Marker auto-resolution (Stage 3d, main session / editor role, web tools)

The editor persona's "Stage 3d, Marker auto-resolution" section is the full contract. This stage runs in the MAIN session (not a subagent) because the editor already holds the standards + profile docs in context and has the web tools (`WebSearch`, `WebFetch`, and the Pilcrino browser as a fallback) that the writer and the other subagents lack.

**Goal:** resolve every `[VERIFY:]` and `[EXTERNAL_LINK_NEEDED:]` marker automatically so the human never hand-resolves them. Always TRY; the fallback when a claim can't be verified is to delete the claim (see step 5), not to punt to the human.

Runs after Step 12 (humanize) completes, or on resume when `current_stage=resolve_markers` and the latest draft still contains `[VERIFY:]` or `[EXTERNAL_LINK_NEEDED:]` markers.

**Scope:** ONLY `[VERIFY:]` and `[EXTERNAL_LINK_NEEDED:]`. Leave `[INTERNAL_LINK_NEEDED:]` (resolved against our own published posts at action-items) and `[IMAGE:]` (Stage 4a) untouched.

#### Step 12.5.1, Grep the markers

```
Bash: grep -nE '\[(VERIFY|EXTERNAL_LINK_NEEDED):' \
  {drafts_dir}/<slug>/draft-v<N>.md
```

If zero hits: nothing to resolve. Skip to step 6 (advance to Stage 4a). Otherwise, process each hit.

<!-- module: competitors -->
#### Step 12.5.2, Competitor-claim guard (do this FIRST, per marker)

If a `[VERIFY:]` marker is about a competitor's pricing or features, do NOT web-resolve it and do NOT delete it. The writer is forbidden from using `[VERIFY:]` for competitor pricing/features (`${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §"Competitor pricing and feature claims"); its presence means the reviewer missed it. Halt this marker, flag to the human, and route to a Stage 1.5c profile refresh (the source of truth is the base branch's profile, snapshotted in `research/profiles/`, never a live web guess). This is the one exception to "always resolve."
<!-- /module -->

#### Step 12.5.3, Research with allowlist discipline

For each remaining marker, attempt resolution via `WebSearch` → identify a candidate **primary or allowlist-class** source → `WebFetch` that source to CONFIRM the exact claim (wording, date, scope). If `WebFetch` fails (auth, render), use the Pilcrino browser: `tabs open`, `navigate`, then `capture` of `{url: location.href, title: document.title, text: document.body.innerText.substring(0, 20000)}` to `{drafts_dir}/<slug>/research/_raw/verify-<NN>.json`, `Read` it, and `tabs close`. Hard source rules (inherited from `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §External linking):

- Cite ONLY `primary_source` or `authoritative_allowlist` domains (the allowlist lives in `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §"Authoritative-site allowlist", extended per `{profile_dir}/voice.md` §Additional allowlist domains). NEVER a URL in `research/serp.md` top-10 (cross-check it), even if the claim appears there.
- NEVER fabricate a number, a fact, or a citation. A search-snippet is not confirmation; the cited URL must actually load AND actually contain the claim (the `WebFetch` confirmation is mandatory).
- Scope the claim to exactly what the source supports. Do NOT overclaim. (Example: a browser's tracking-protection feature strips known ad-click trackers; citing it for "software strips tracking parameters" is fine, but claiming it strips a specific vendor's affiliate tag is overclaiming. Name the limit in the prose.)

#### Step 12.5.4, Resolve (verified)

When confirmed, edit the draft in place:
- `[EXTERNAL_LINK_NEEDED:]` → replace the marker with the literal-claim anchor linked to the confirmed allowlist URL (root-relative rules don't apply, this is external).
- `[VERIFY:]` → replace the marker with the confirmed claim, adding an inline allowlist citation when the claim warrants a source.
- Mirror the resolution into `facts.md` (move the item out of "Rejected / not verifiable" into a sourced entry; add any new allowlist citation), so the record stays the source of truth.

#### Step 12.5.5, Fallback: delete the claim (decided behavior)

If a marker's claim cannot be confirmed from an allowlist/primary source (no source exists, or the source contradicts it), DELETE the claim:
- Remove the minimal span that carries the unverifiable claim (the sentence, or the clause if the rest of the sentence stands), then re-read the surrounding paragraph so it still flows. Prefer the smallest cut that removes the unsupported assertion.
- If the claim is only generally true (true in spirit, just not citable as stated), you MAY instead keep a defensible general version of the sentence and drop the marker, rather than delete the whole thing. General-but-true beats a hole.
- NEVER invent a citation to avoid deleting. NEVER leave a bare `[VERIFY:]`/`[EXTERNAL_LINK_NEEDED:]` marker in the shipped draft.
- Every deletion is logged (step 5b), so nothing disappears without an audit trail.

#### Step 12.5.5b, Log every action

Append a per-marker log to the checklist "Notes" (and it flows to `action-items.md` §2/§3): for each marker record `resolved (cite: <url>)`, `kept general (marker dropped)`, `deleted claim: "<the removed text>"`, or `competitor-claim → routed to Stage 1.5c (human)`.

#### Step 12.5.6, Re-lint after edits

The draft was humanized at Stage 3c; your edits must not regress it. Re-run the floor checks on the edited draft:
```
Bash: F={drafts_dir}/<slug>/draft-v<N>.md
grep -c '—' "$F"        # em-dashes, must be 0
grep -nE '\[(VERIFY|EXTERNAL_LINK_NEEDED):' "$F"   # must be empty (all resolved/deleted)
```
Also confirm: no forbidden phrases introduced, no new link to a `research/serp.md` top-10 URL, and every external URL you added returns HTTP 200.

#### Step 12.5.7, Finalize Stage 3d

- Update checklist: `current_owner=blog-post-workflow`, `current_stage=images`. Append stage log: `Stage 3d completed: <ts>, resolved <R>, kept-general <G>, deleted <D>, competitor-routed <C>`.
- Report a one-screen summary to the human (per-marker outcome + any deletions). Then continue to Step 13.

### Step 13, Image plan (Stage 4a, delegate to `image-planner` subagent)

The editor persona's "Stage 4a, Image plan" section is the contract. The planner's full procedure lives in `${CLAUDE_PLUGIN_ROOT}/skills/suggest-images/SKILL.md` (the subagent reads it at spawn).

Runs after Step 12.5 completes, or on resume when `current_stage=images` and `images.md` is missing.

1. Verify the latest `draft-v<N>.md` exists (humanized per Stage 3c).
2. Update checklist frontmatter: `current_stage=images`, `current_owner=image-planner`, `last_updated=<now>`. Append stage log: `Stage 4a started: <ts>`.
3. Spawn the planner subagent:
   ```
   Agent tool call:
     subagent_type: image-planner
     prompt:
       """
       slug=<slug>
       """
   ```
   The planner assigns each slot's `Type` from this blog's `images.enabled` (config); the featured slot defaults to `images.featured_default` when it is set, otherwise the planner picks from `images.enabled`. A slot whose `Type` is not in `images.enabled` is a planner bug and is sent back.
4. Wait for return. Verify `{drafts_dir}/<slug>/images.md` exists.
5. Sanity-check:
   - `draft_placeholders` = count of `[IMAGE:` in the draft
   - `in_post_entries` = count of `### Image ` entries under `## In-post images` in `images.md` (featured image lives in the separate `## Featured image` block, so it's excluded from this count)
   - Confirm `in_post_entries == draft_placeholders`. Mismatch → flag in handoff.
6. Failure handling:
   - **Missing output:** re-spawn ONCE. Second failure → stop, report to human.
   - **Count mismatch:** flag to human; proceed (the agent writes `Editor notes` explaining the delta). Human decides if it matters.
7. On success: tick Stage 4a items; `current_owner=blog-post-workflow`, `current_stage=generate_images`. Append stage log: `Stage 4a completed: <ts>, <N> images (1 featured + <N-1> in-post)`. Continue to Step 13.5.

### Step 13.5, Generate images (Stage 4a.5, delegate to image-builder)

Runs after Step 13 (image plan) completes, or on resume when `current_stage=generate_images`. Only file-producing slots are generated: `Type: remotion` and `Type: ai-prompt` (codex, `${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md`) slots render to a file. `Type: screenshot` slots stay manual (the builder records them as `screenshot_pending`; a human executes the spec already written in `images.md`). A pending or failed slot is later left as a build-safe 'Image pending' note in the preview (never a local embed to a non-existent file, which would fail the build) and stays an action-item.

1. Update checklist frontmatter: `current_stage=generate_images`, `current_owner=image-builder`, `last_updated=<now>`. Append stage log: `Stage 4a.5 started: <ts>`.
2. Compute the expected file-producing filename set from `images.md`: every `Type: remotion` or `Type: ai-prompt` entry's `Suggested filename` (featured = `featured.png` when the featured slot is file-producing, + each in-post file-producing slot's filename). `screenshot` slots are never expected files.
3. Spawn the builder:
   ```
   Agent tool call:
     subagent_type: image-builder
     prompt:
       """
       slug=<slug>
       """
   ```
4. On return, parse the manifest (shape: `{slug, rendered, prompt_pending, screenshot_pending, failed, halt}`). Verify the asset dir `{assets_dir}/<slug>/` exists with the `.staged-by-blog-workflow` sentinel, and that every expected file-producing filename is present on disk.
5. **Failure handling:**
   - `halt` set (asset dir not owned) -> STOP, report to the human (a non-workflow folder exists at that path), do not proceed.
   - Some expected file-producing PNGs missing or listed under `failed` -> re-spawn the builder ONCE (it is idempotent; the ownership sentinel already exists, so it re-renders the missing subset). After the second run, any still-missing file-producing slot is reported to the human and proceeds (that slot is left as a build-safe 'Image pending' note in preview (no local embed to a missing file) + an action-item).
6. **Featured-slot completion gate (before advancing).** Check the featured slot's `Type:` in `images.md` §Featured image. File-producing (`remotion` or `ai-prompt`) -> Stage 4a.5 already rendered it, or it is `failed` and step 5 above handled the re-spawn/report — a still-missing featured file after that pauses here with the recorded failure reason (staging cannot recover from a missing featured file; it can only halt again); the slot's `Prompt:` block in `images.md` is the manual fallback the human can execute before resuming. NOT file-producing (`screenshot`) -> the builder never produces a `featured.<ext>` file for this type by design, so do NOT advance to Stage 4b automatically. Report to the human: "The featured slot's strategy (`<type>`) is manual: create the featured image per `images.md` §Featured image, save it as `{assets_dir}/<slug>/<featured filename>`, then resume — staging halts without it." In both pause cases leave `current_stage=generate_images` so resume re-enters this step; proceed to step 7 only once `{assets_dir}/<slug>/<featured filename>` exists on disk.
7. On success: tick Stage 4a.5 items; `current_owner=blog-post-workflow`, `current_stage=action_items`. Append stage log: `Stage 4a.5 completed: <ts>, <R> rendered, <P> prompt-pending, <S> screenshot-pending, <F> failed`.
8. Continue to Step 14 (Stage 4b).

### Step 14, Action items compile (Stage 4b, grep-based)

Purely mechanical, no subagent, no delegate subskill. The main skill greps the draft + reads `images.md` + fills the resolved `action-items.md` template.

1. Update checklist frontmatter: `current_stage=action_items`, `current_owner=blog-post-workflow`. Append stage log: `Stage 4b started: <ts>`.
2. Grep for markers:
   ```
   Bash: grep -nE '\[(VERIFY|EXTERNAL_LINK_NEEDED|INTERNAL_LINK_NEEDED|IMAGE):' \
     {drafts_dir}/<slug>/draft-v<N>.md
   ```
3. Parse output into marker lists. Keep line numbers.
   - **`[VERIFY:]` and `[EXTERNAL_LINK_NEEDED:]` are normally GONE by now.** Stage 3d (Step 12.5) auto-resolved or deleted them, so the grep usually returns zero of each. For §2 and §3, pull the per-marker outcome log Stage 3d wrote to the checklist Notes (resolved-with-cite / kept-general / deleted / competitor-routed) instead of writing a human to-do. Any RESIDUAL `[VERIFY:]`/`[EXTERNAL_LINK_NEEDED:]` hit still gets a checkbox: split a residual `[VERIFY:]` on the literal ` | source:` separator (claim before the pipe, source clause after) for the §2 table; a residual with no ` | source:` clause records source `MISSING (writer omitted source clause; please flag)`.
   <!-- module: competitors -->
   - A residual `[VERIFY:]` is normally a competitor-claim that Stage 3d routed to the human (the one class Stage 3d never web-resolves); mark its §2 row `competitor-routed` and keep its checkbox.
   <!-- /module -->
   - `[INTERNAL_LINK_NEEDED:]` and `[IMAGE:]` are parsed as before (Stage 3d does not touch them).
4. **Determine authors-map status (adapter-conditional).** Only when `publish.adapter: astro-git-pr` AND `publish.astro.authors_map_check` is set: grep the configured file for the author map and compare against the draft's `authors:` frontmatter slug (case-sensitive):
   ```
   Bash: grep -A 20 'authors:' {publish.astro.authors_map_check}
   ```
   The frontmatter slug must match the map's exact casing (most sites capitalize keys, e.g. `Alex`, not `alex`). If the draft's slug is lowercase (`alex`) where the map key is capitalized (`Alex`), record "needs casing fix" — the writer's frontmatter generator violated the convention. Otherwise record "yes" or "needs adding". This status feeds the astro adapter's §6. For any other adapter, or when `authors_map_check` is unset, skip this step (the adapter's §6 writes an N/A line).
5. Read the resolved template `action-items.md` for the structure.
6. Read the draft's frontmatter (per the configured `publish.<adapter>.frontmatter_template`): title, excerpt, author. Also read `{drafts_dir}/<slug>/brief.md` "Topic / Target Keyword" (or `plan.md`, same value) for `<target keyword>` — needed to fill the wordpress-rest adapter's conditional focus-keyword action item at §7, when present.
7. Write `{drafts_dir}/<slug>/action-items.md` per the template. Every section filled. No remaining `<placeholders>`.
   - Fill `<YYYY-MM-DD>` with today's date (`date +%Y-%m-%d`; this is the post date at Gate 2 finalize).
   - Fill `<slug>`, `<title>` verbatim.
   - Fill marker lists with line numbers.
   - **§1 Create images:** read `images.md`, tag each entry with its `Type:`, and fill the template's §1 blocks. File-producing slots (`Type: remotion`, `Type: ai-prompt`) were already rendered at Stage 4a.5, so frame those as verify-the-render records (a `failed` slot instead becomes a human build TODO with its manual `Prompt:` fallback); `Type: screenshot` slots stay human build TODOs per their spec (`${CLAUDE_PLUGIN_ROOT}/adapters/images/<type>.md`). For every `remotion` slot emit a `Remotion: <id> → <filename>` line (composition ID + render command from that slot's images.md production spec) under the §1 Remotion sub-block, or "none". For every `ai-prompt` slot emit an `AI: <filename>` line under the §1 AI sub-block, or "none".
   - **§4b Inbound links:** copy each row from the outline's "Inbound internal links" section. These are APPLIED automatically at Stage 4b.5 (astro-git-pr.md and wordpress-rest.md §Staging step 5; markdown.md §Staging step 3), not left as a human TODO, so frame each row as a record + publish reminder: `applied at Stage 4b.5 to {content_dir}/<existing-slug>.md (anchor "<anchor>" → {route_prefix}<slug>, trailing slash per blog.trailing_slash); include this edited file in your publish diff and confirm it rendered in the Gate 2 preview`. If the outline planned none, write "None." The row wording follows the active adapter's `§Action-items sections` §4b branch when the adapter defines one (the astro-flavored "include this edited file in your publish diff" above is the `astro-git-pr` wording; e.g. `wordpress-rest` branches to "hand-apply to the live WP post in wp-admin").
   - **§6/§7:** fill verbatim from the active adapter's §Action-items sections (`${CLAUDE_PLUGIN_ROOT}/adapters/publish/<publish.adapter>.md`) — this INCLUDES any adapter-supplied conditional items, not just the fixed checklist rows — substituting `<pr_url>`, `<slug>`, `<title>`, `<target keyword>` (read at step 6 above) and — for the astro adapter's conditional §6 — the authors-map status computed at step 4; for the wordpress-rest adapter's conditional §7 focus-keyword item, also substitute the SEO plugin name and REST-settability note straight from `{profile_dir}/site-conventions.md` §SEO plugin (or omit the item entirely per that item's own skip condition).
   - Fill §10 Archive cleanup paths with the actual slug.
8. Verify the written file has no remaining `<placeholders>` by grep:
   ```
   Bash: grep -c '<[a-zA-Z_-]*>' {drafts_dir}/<slug>/action-items.md
   ```
   Zero remaining is ideal; a handful (in heredoc code blocks, raw template hints) is acceptable, but the critical `<slug>` placeholder must be zero outside code blocks.
9. Tick Stage 4b items. Append stage log: `Stage 4b completed: <ts>, N action items`. Continue to Step 14.5.

### Step 14.5, Stage the post (Stage 4b.5, main session, adapter-dispatched)

Runs after Step 14 (action items), or on resume when `current_stage=preview`. Mechanical, no subagent. Stages the post + images into their FINAL blog paths (worktree-isolated in the PR case) so the author can read the rendered post before Gate 2.

**This step is a DISPATCHER.** The platform mechanics — worktree/branch/PR (astro-git-pr) or the WordPress draft create/update (wordpress-rest), or the same worktree/branch/PR for a markdown file in the owner's platform's frontmatter shape (markdown) — live in the active publish adapter's `## Staging (Stage 4b.5)` section, which carries the full sub-steps (collision guard, `[IMAGE:]` resolution, cover injection, inbound-link application, commit/push, state file). This shell states the shared invariants and routes to that section; it never re-derives or duplicates the adapter's steps.

**Opening the PR here is unconditional and needs no human approval (standing user instruction): never pause to ask, and never ask permission to push. Always open the PR at finish.** There is no second path: the GitHub precondition was confirmed at Step 0 (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §GitHub precondition) and a run that failed it never reached this step. A push or `gh pr create` that fails mid-stage PARKS with `pr_create_failed`; it never completes the post on disk.

1. Update checklist: `current_stage=preview`, `current_owner=blog-post-workflow`, `last_updated=<now>`. Append stage log: `Stage 4b.5 staging started: <ts>`.
2. **Route to the active adapter's §Staging.** Read `${CLAUDE_PLUGIN_ROOT}/adapters/publish/<publish.adapter>.md` `## Staging (Stage 4b.5)` and execute it end to end. `{content_dir}` and `{assets_dir}` bind to that adapter's own config block (astro: `publish.astro.*`; wordpress: `publish.wordpress.*`; markdown: `publish.markdown.*`). The adapter owns: copying `draft-v<N>.md` → `{content_dir}/<slug>.md`, replacing `[IMAGE:]` placeholders (embed where the rendered file exists on disk, else a build-safe `> **Image pending:**` note — never a local embed to a missing file), setting the featured cover (halt if `featured.<ext>` is missing), applying the outline's inbound links to existing posts (idempotent via a durable write-ahead ownership record in checklist Notes, not link-presence alone — an unrecorded link already present is treated as user-authored and excluded from the PR), stripping the draft mechanism, and — for `wordpress-rest` — creating the WordPress draft at staging (the WP analogue of an Astro CI preview). **PR path, PR completeness:** the adapter's worktree commit (`astro-git-pr.md` §Staging step 6c/6e, which `wordpress-rest` defers to) ALSO includes this post's Remotion composition sources (`{remotion_dir}/src/<id>.tsx` per `remotion` slot + the `Root.tsx` registration diff, when any exist), this post's featured-image rotation entry `{ops_dir}/featured-log/<date>-<slug>.md` (so its archetype travels with the post — a fresh checkout must not see stale rotation history; one file per post, never a shared ledger, so concurrent posts cannot conflict), and an early, non-terminal snapshot of `{drafts_dir}/<slug>/` at `{drafts_dir}/_archive/<slug>/` inside the worktree — a completeness copy for reviewers, re-synced to its final state at finalize (Step 15.3); the LOCAL `mv` to `_archive/` still only happens at finalize, unchanged.
3. **Shared invariants (hold across all adapters, so verify the adapter honored them):**
   - **Ownership guards:** the authoritative slug-collision check is the adapter's §Staging step 6a (slug must not exist on `origin/{git.base_branch}` after `git fetch`); it is the only slug-collision check — the former main-tree `draft: true`-present pre-check went with the deleted local path.
   - **Deferred main-tree cleanup:** the adapter cleans the main tree (step 6h) ONLY after the PR exists AND `pr-monitor.json` is written, so any failure at push/PR-create/state-write leaves the staged artifacts recoverable in the main tree.
   - **Idempotent commit/push:** every branch commit runs `git -C "$WT" diff --cached --quiet || git -C "$WT" commit ...` — **that `diff --cached` guard IS the idempotency mechanism, NOT `git ls-files`** (which reports staged-but-uncommitted paths too and would wrongly skip a needed commit). The push is a no-op when the branch is already current.
   - **`pr-monitor.json` schema** (written by the adapter at step 6g), `repo` derived from `git remote get-url origin`, never hardcoded:
     ```json
     { "slug": "<slug>", "repo": "<owner>/<repo>", "pr_number": 0, "pr_url": "",
       "branch": "{git.branch_prefix}<slug>", "base": "{git.base_branch}",
       "worktree": ".worktrees/blog-<slug>", "staging_url": "", "status": "open",
       "mode": "pr", "handled_comment_ids": { "issue": [], "inline": [], "review": [] },
       "created_at": "<ISO8601>", "last_poll": "",
       "poll_interval_minutes": 15, "idle_polls": 0 }
     ```
     `status`: `open` | `approved` | `done` | `closed`. `poll_interval_minutes` / `idle_polls` drive the monitor's idle backoff (`pr-monitor.md` §Adaptive cadence); the monitor tolerates their absence in older state files (defaults 15 / 0). When `publish.adapter: wordpress-rest`, the state file ALSO carries `wp_post_id`, `wp_media_ids[]`, `wp_preview_url`, and `wp_upload` (`ok` | `failed`), per that adapter's §`pr-monitor.json` additions.
   - **Auth-probe discipline (`wordpress-rest` only):** this shell never probes the WordPress credential itself. That happens exactly once, inside the adapter's §Staging step 2, never retried and never polled; this shell does not re-verify or duplicate that check before or after dispatching. On a probe failure the adapter stops and reports per its own lockout guidance — do not add a second check here "just to be sure."
4. **Result:** the post + assets are committed/pushed on `{git.branch_prefix}<slug>` inside the worktree `.worktrees/blog-<slug>`, the PR is open, and `pr-monitor.json` has `mode: pr`. The worktree PERSISTS through the review phase (comment-fixes commit into it) and after finalize too (Step 15.3 no longer removes it) — deletion belongs to a human alone, via the console's worktree list (the console displays a post's worktree path today but **no delete control has shipped yet**, so until one does a human removes it by hand). Do NOT poll for the CI staging preview here; the Gate 2 banner / the monitor surface it (astro: the configured `publish.astro.preview_comment_marker`; wordpress: `wp_preview_url`).
5. Update checklist: `current_stage=finalize`, `gate_pending=gate_2_final`. Append stage log: `Stage 4b.5 completed: <ts>, PR #<n> opened (<url>)`.
6. Continue to Step 15 (Gate 2), passing the preview URL(s) into the banner.

### Step 15, Gate 2 + Finalize (main session, conversational + bash)

The editor persona's "Gate 2, Final approval" + "Gate 2 Finalize" sections are the contract. The platform mechanics of finalize live in the active adapter's `## On Gate 2 approval`; the banner/routing/bookkeeping shell lives here. **Gate 2 is a mandatory human stop: no launch arg and no standing instruction is Gate 2 approval, and none authorizes `status=publish` or a PR merge (see §How to invoke, Go-live guard). "Update status to published" in an invocation always means the content-calendar Status column.**

#### Step 15.1, Present Gate 2 banner

Update checklist: `current_stage=finalize`, `gate_pending=gate_2_final`. Append stage log: `Gate 2 opened: <ts>`.

Present the banner per the persona.

- The `Preview:` line carries the PR URL and the staging preview (astro: read the CI comment matching `publish.astro.preview_comment_marker`; if CI hasn't posted it yet, show the PR URL and note "staging deploying, the monitor surfaces the URL when ready"; wordpress: show the PR diff URL AND `wp_preview_url` side by side; markdown: show the PR diff URL and, when the blog is registered with the Pilcrino app, the app's preview page for the post, and for a paste platform the paste instruction of `${CLAUDE_PLUGIN_ROOT}/adapters/publish/markdown.md` §Staging step 6, before any approval). Then **always start the PR-comment monitor cron** (`CronCreate`, every ~15 minutes; unconditional, no approval — standing user instruction; the monitor backs itself off to 30/60 minutes on an idle PR and snaps back on activity, per `pr-monitor.md` §Adaptive cadence) whose prompt is: "Run the blog-post-workflow PR monitor for slug `<slug>`: read `{drafts_dir}/<slug>/pr-monitor.json` and follow `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md`." Gate 2 no longer blocks on an in-session answer; review happens asynchronously on the PR (the user may still comment in the console). The banner also carries the `/blog-retro <slug>` retro nudge: this is the pre-cron, working-session touchpoint, since finalize (Step 15.5) runs in the contextless monitor-cron session on the PR path.
- The `Layout:` line carries the layout check's result on the rendered page (astro: the adapter's §Staging step 9, run on the staging-deploy URL; wordpress: that adapter's §Staging step 8, on `wp_preview_url`; markdown: always `not checked (the markdown adapter has no site preview)`, its §Staging step 7): `fits at 1440px and 390px`, or one line per finding, or `pending` / `not checked (<why>)`. Never omit the line: a post that was never looked at must say so.

#### Step 15.2, Route on human response

**PR path (async).** The monitor (Step 16) drives the review loop: it addresses PR comments (via the adapter's `## On review-loop edit`) and watches `reviewDecision`. The editor does not block here. Handle these signals whenever they arrive (cron or console):
- **PR approved on GitHub** (`reviewDecision == APPROVED`) → advisory only, NOT terminal: the monitor records `status: approved` on its tick and HOLDS (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md` §Each firing step 5) rather than finalizing immediately — a GitHub review is a recommendation, never authorization by itself. Finalize (Step 15.3 PR path) fires only once one of two explicit actions follows: the PR is actually merged (the monitor's MERGED discriminator treats an already-recorded `status: approved`, or `approval.json`, as proof the merge is the legitimate completion of a real review — see that doc), or a console `approve` is typed, which finalizes immediately without waiting for a merge.
- **WordPress post published externally** (`wordpress-rest` only: the monitor's per-firing check — `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md` §Each firing step 2 — finds `GET .../posts/<wp_post_id>?_fields=status` returns `publish`; a normal authenticated call by the stored ID, not a probe) → finalize (Step 15.3 PR path) exactly as a PR approval, with the one difference the adapter's `## On Gate 2 approval` step 1 already encodes: the final content sync is SKIPPED since the live post is now authoritative.
- **PR comment / console comment** → address per the adapter's `## On review-loop edit` + `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md` (change, push, reply once).
- **`pause`** (console) → `status: paused`, stop the cron (`CronDelete`), tell the human how to resume; the PR + worktree stay in place.


#### Step 15.3, Finalize sequence (adapter-dispatched)

**PR path.** On approval the post is already publish-ready (draft mechanism stripped at Stage 4b.5) and committed/pushed on `{git.branch_prefix}<slug>` via the worktree. Finalize is bookkeeping, NO merge. Run `${CLAUDE_PLUGIN_ROOT}/adapters/publish/<publish.adapter>.md` `## On Gate 2 approval` (for `wordpress-rest` that first re-syncs the WP draft, then runs the git-side archive from `astro-git-pr.md` §On Gate 2 approval). **The ordering that section encodes is load-bearing and must not be reordered:**
1. `CronDelete` the PR-comment monitor cron.
2. Ship the archive into the SAME PR, editing ONLY the worktree copies of `checklist.md` (→ `status=complete`, `current_stage=complete`, `gate_pending=none`) and `pr-monitor.json` (→ `status: done`) to terminal state; **do NOT touch the SOURCE `{drafts_dir}/<slug>/` copies yet** (they stay non-terminal so a crash before the push leaves a recoverable state). Commit with the `git -C "$WT" diff --cached --quiet || ...` guard (the `diff --cached` check IS the idempotency mechanism, NOT `git ls-files`), then push.
3. **Only after the archive push succeeds:** set `status=done` in the SOURCE `pr-monitor.json`, then `mv {drafts_dir}/<slug>/` → `{drafts_dir}/_archive/<slug>/` in the main tree, and complete the now-archived `checklist.md`.
4. **Leave the worktree in place.** Finalize no longer removes it — deletion belongs to a human, via the console's worktree list (no delete control has shipped there yet, so for now that means removing it by hand). The branch + PR remain on the remote.

Then Step 15.4, then Step 15.5. Report the PR is approved and ready to merge; the human merges to publish. Do NOT auto-merge. (For `wordpress-rest`, the human's publish action is clicking Publish in WP admin; the draft is never auto-published.)

**Console-merge entry (from the Step 2 route: `finalize`+`gate_2_final`, `mode: pr`, `status` non-terminal, PR already MERGED, `approval.json` present).** This is the console's browser-Approve → merge → `resume <slug>` cleanup sequence: the console merged the PR out-of-band and is now calling this session only to finalize. Run this SAME PR-path sequence with two adjustments: (a) step 1's `CronDelete` is a no-op here, since no monitor cron was ever created under console-gated mode; skip it silently if there is nothing to delete; (b) the PR is already merged, so this is pure bookkeeping (finalize never merges anyway): the archive push in step 2 is still safe and idempotent, but if the branch is gone or the push is rejected because the PR is merged/closed, that is not an error, proceed to step 3. **Ordering is load-bearing here specifically because the console's `runCleanupFor` runs `classifyArchive` on the first tick after this resume exits: this session MUST complete the archive/bookkeeping and the `mv {drafts_dir}/<slug>/` → `_archive/` (steps 2-3) BEFORE it returns, so `classifyArchive` finds a healthy archive instead of triggering a rescue or an `archive_missing` park.** `approval.json` is the durable proof-of-approval that authorizes this finalize; the Step 2 route already confirmed it is present.


#### Step 15.4, Post-finalize checklist update

The draft directory has moved to `{drafts_dir}/_archive/<slug>/`. Update the ARCHIVED checklist (at its new path). This step is idempotent — if the archived checklist already has `status=complete`, skip the write and continue to Step 15.5:

```
Read:  {drafts_dir}/_archive/<slug>/checklist.md
If     status=complete already → skip the edit (recovery path)
Else   Edit: frontmatter:
         status=complete
         current_stage=complete
         gate_pending=none
         last_updated=<now>
         Append stage log: "Gate 2 approved: <ts>, Finalize completed: <ts>"
```

#### Step 15.5, Report completion

```
Gate 2 approved, Phase 4 complete for <slug>.

- Post:    {content_dir}/<slug>.md  (canonical markdown; publish per the active adapter)
- Assets:  {assets_dir}/<slug>/  (rendered images + README.md already in place)
- Archive: {drafts_dir}/_archive/<slug>/
  (wordpress-rest: the WordPress draft is at <wp_preview_url>; publish = clicking Publish in WP admin)

Next: work through {drafts_dir}/_archive/<slug>/action-items.md. When every item is
checked, publish per action-items §6-7 (the active adapter's publish sequence — a PR
merge for astro-git-pr, WP admin Publish for wordpress-rest; for markdown, repo platforms merge the PR, paste platforms paste the zip then merge).
Retro: run /blog-retro <slug> in this session to capture workflow improvements from this run.
Once the post is live, run the standalone /repurpose-blog-post <slug> skill for the
repurpose outputs.
```

When Step 2.5's test says standalone and `blog-ops/content-plan.md` has a row for this slug (check again here: this step can run in a fresh monitor session): add one line to the closing message above, whichever adapter: "Once the post is live, run `/pilcrino:blog-post-workflow published <slug>` to mark the plan row."

### Step 16, PR-comment monitor (PR path, cron-driven)

While the post's PR is open, a cron (started at Step 15.1) runs the self-contained routine in `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md` every ~15 minutes (decaying to 30/60 minutes while the PR is idle, snapping back to 15 on reviewer activity — that routine's §Adaptive cadence owns the mechanics): it polls the three GitHub feedback channels (issue comments, inline diff comments, and review-summary bodies), addresses clear comments via the active adapter's `## On review-loop edit` (change, push to `{git.branch_prefix}<slug>`, reply once each via an on-PR `<!-- handled:<channel>:<id> -->` marker), asks for clarification on ambiguous ones, and on `reviewDecision == APPROVED` runs the finalize-on-approval sequence (Step 15.3 PR path) then `CronDelete`s itself. The user may also comment in the console; those are handled live with the same change/push/reply behavior. State + dedup live in `{drafts_dir}/<slug>/pr-monitor.json`. This routine is read on demand (kept out of the always-loaded hot path).

### Step 16.5, published <slug>

Gate 2 approval does not publish: for `astro-git-pr` the PR is merged later by a human or the PR monitor, for `wordpress-rest` go-live is a manual status change (Step 15, the go-live guard), and for `markdown` the PR merge is the publish (paste platforms paste the zip first). So the plan row changes in its own invocation, with no intake and no other stage.

1. Decide the mode as Step 2.5 does. Registered: say "The Pilcrino app owns this blog's plan and updates it from its post list; nothing to edit here" and stop. Standalone with no `blog-ops/content-plan.md`, or no row with this slug: say so and stop. A row already `published`: say so and stop. Another branch than `{git.base_branch}` checked out: say so and stop (never switch branches here).
2. Check the post is live, reading the PR number and repo from `{drafts_dir}/_archive/<slug>/pr-monitor.json` (`{drafts_dir}/<slug>/` when not archived yet):
   - `astro-git-pr`: `gh pr view <pr_number> -R <repo> --json state` returns `MERGED`, and `{blog.url}{route_prefix}<slug>` (trailing `/` iff `blog.trailing_slash`) answers 200.
   - `wordpress-rest`: `GET $WP_BASE/wp-json/wp/v2/posts/<wp_post_id>?_fields=status` (the adapter's authenticated call by the stored ID) returns `publish`.
   - `markdown`: `gh pr view <pr_number> -R <repo> --json state` returns `MERGED`. No URL is probed: a paste platform has no known URL, and the repo platforms' URL shapes are not configured.
   Not live yet: say what was found (PR still open, status `draft`, URL not 200), change nothing and stop.
3. Live: set only that row's Status cell to `published`. Every other row, cell, and the `## Details` blocks stay byte for byte.
4. Commit only that file: `git add blog-ops/content-plan.md && git commit -m "chore(content-plan): <slug> published" -- blog-ops/content-plan.md`. Do not push. Report the row is marked.

## Autopilot

Headless mode, driven by the Pilcrino app's console.
Active exactly when `$CONSOLE_RUN_STATE` is set. The full run↔console contract
(invocations, event vocabulary, verification handshake, Gate 2 semantics) is
`references/console-contract.md` — read it now; emit every event it defines at
the moment it defines.

**Doctrine (unchanged from v0.4.0):** autopilot runs autonomously all the way
TO Gate 2, never through it. Nothing in this section authorizes a merge or a
live publish.

### Modes

- `autopilot <slug>` — fresh run: Step 3 intake from files (below), then the
  normal pipeline. With `CONSOLE_VERIFICATION=on`, stop after staging file
  layout per the contract's verification handshake: emit
  `ready_for_verification` and exit. That event is the terminal — do NOT also
  emit `done` (a trailing `done` makes the console skip verification and
  `autopilot-cont`, so no PR / WP draft is ever opened).
- `autopilot-cont <slug>` — resume at Step 14.5 staging side effects (open the
  PR / create the WP draft), emit `pr_opened`, then `done`. Nothing else.
- `autopilot-revise <slug>` — read `{drafts_dir}/<slug>/feedback.md` as
  editor-priority revision input. Do NOT assume it is prose feedback: CLASSIFY
  it and route it through the SAME classify-then-route table
  `references/pr-monitor.md` §Each firing step 4 uses (image change →
  `image-planner` + `image-builder`; section/prose → the Step 11.3 revise loop
  once (`blog-writer` mode=revise); a claim needs a source → `blog-researcher`
  then `blog-writer`; off-voice → `blog-humanizer`; trivial → inline edit).
  After the specialist returns, re-run humanize + marker resolution + image
  plan deltas only if the draft prose actually changed, re-stage (respecting
  the verification handshake), then emit the SAME terminal a fresh run would:
  `ready_for_verification` alone under `CONSOLE_VERIFICATION=on`, `done` only
  when verification is off. Never both.
- `autopilot-fix <slug>` — read `{drafts_dir}/<slug>/verification-report.md`,
  fix ONLY the reported failures, emit `done`. No re-staging side effects.

### Intake without a conversation (replaces Step 3 Q&A)

1. If `{drafts_dir}/<slug>/brief.md` exists, use it as the brief verbatim.
2. Else read the JSON file at `$CONSOLE_POST` (keys `slug`, `title`, `angle`,
   `author`, `requirements`, `pageType`; the console writes it from its post table at every
   spawn). Write `brief.md` yourself from it, record every assumption you make
   in a `## Autopilot assumptions` section of the brief. Never read
   `blog-ops/content-plan.md` for this: it is a generated printout and may lag
   the console. Step 3 says when to park instead.
   - **Author.** Blank → propose per `{profile_dir}/authors.md` §Selection
     rubric, the SAME rubric `personas/editor.md` Stage 0 step 5 uses
     interactively, when that file defines one; if it defines none, fall back
     to the first author listed in `{profile_dir}/authors.md`. Record which
     path was taken in `## Autopilot assumptions`. Never hardcode "first
     author" as the rule, that's only the fallback when no rubric exists.
   - **Requirements.** When the `requirements` value is non-empty, copy it into
     `brief.md` as a `## Requirements` section, verbatim.
   - **Intent.** When pageType is non-empty, the brief's ## Intent defaults from it: alternatives, best-for and for-role → transactional; vs → comparison; review → review; export and how-to → how_to; other → choose as today. A requirement naming another intent wins (the precedence above). Record the default and its source in ## Autopilot assumptions. Observed search intent still wins at planning: when the SERP disagrees, switch intent while writing the plan and record the switch in the plan, as for any post.
   <!-- module: competitors -->
   - **Competitors.** Whenever `modules.competitors` is on, run
     `competitor-profiles.mjs` in list mode once, even with no requirements,
     and apply reference rule 5 first (a failure parks `other`). Competitor
     names come from the requirements text (a line
     such as "Mention: Lasso, PrettyLinks", or names in prose). That one list
     run is the only one per intake: for each name, apply
     `references/competitor-profiles.md` rules 1 and 2 to its JSON exactly as
     interactive intake does. A hard stop parks `competitor_profile_stale`
     with the rule 6 detail; a script failure parks `other` (rule 4). Every
     name that passes goes into brief.md's "Competitors to mention" table
     exactly as interactive intake would (`Name | Profile path`).
     No requirements, or none that name a competitor: an empty table, and
     Stage 1.5c skips its check as it does for any post naming no competitor.
   - **`modules.competitors` off:** names in the requirements are plain text;
     validate nothing and write an empty "Competitors to mention" table.
   <!-- /module -->
3. `$CONSOLE_POST` unset or unreadable, or its `title` (the keyword/topic)
   empty → park `brief_insufficient`.

Never ask; never guess silently.

### Park-don't-ask policy table

In autopilot, every branch that would STOP and ask the human instead APPENDS a
`parked` event (reason below + a one-line `detail`), leaves checklist.md in
its current valid stage state, and exits 0. Parked slugs stay resumable via
`resume <slug>`.

| Interactive behavior | Autopilot policy |
|---|---|
| Step 11: >2 revise passes or reviewer `reject` → escalation prompt | Park `review_escalation`; attach the review verdict in detail |
| Step 13.5 step 6: featured slot is `screenshot` with no file → pause | Park `featured_screenshot_required` |
| Step 4.85: competitor profile missing / >14d stale → HARD-HALT prompt | Park `competitor_profile_stale` |
| >50% research fetches fail → retry/partial/abandon prompt | Proceed-partial and note it in facts.md, UNLESS the SERP capture itself failed → park `research_fetch_failure` |
| SERP capture returns 0 results or `blocked` (captcha or bot-block) → stop, do not try curl or Playwright | Park `serp_blocked` |
| Pilcrino browser cannot start, or a site is unreachable (login_status error) | Park `chrome_unavailable` |
| login_status signed_out or blocked, or a captcha / login wall during a fetch | Park `captcha_or_login` |
| WordPress auth probe fails | Park `wp_auth_failed` IMMEDIATELY — zero retries, no polling, no backoff (lockout rule) |
| Slug collision at staging (adapter §Staging ownership guard, or its authoritative post-fetch check) → STOP | Park `slug_collision` |
| Featured cover file missing at staging (adapter §Staging §Set the featured cover) → STOP | Park `featured_image_missing` |
| Image-builder asset directory not owned by the workflow (Stage 4a.5 manifest `halt`) → STOP | Park `image_ownership_conflict` |
| Mass forbidden-phrase hits in a draft (>5 distinct, Stage 3a/3b post-spawn check) → flag to human | Park `mass_forbidden_phrases` |
| Humanize preservation check fails (`FAILED and restored`, Stage 3c) → flag to human | Park `humanize_preservation_failed` |
| Any subagent's second consecutive failure (the uniform re-spawn-once policy, any stage) | Park `subagent_failed` with detail: which subagent, which stage |
| Any other would-be question | Park `other` with detail |
| Any unexpected error not covered above | Park `unexpected_error` with the error text as detail |

### Gate 2 and monitoring

Console-gated per the contract: do NOT create the CronCreate PR monitor, do
NOT block on typed input, do NOT treat any launch arg as approval. The
approval GATE itself is enforced by the console, not by the run: the
operator's browser Approve action is what writes
`{drafts_dir}/<slug>/approval.json`, the durable proof-of-approval.

The finalize/bookkeeping that follows a console approval runs LATER, in a
separate `resume <slug>` session the console spawns when it cleans up
(`console-contract.md` §Other invocations, Cleanup finalize resume). That session
has NO `CONSOLE_RUN_STATE` set: it is interactive-mode Stage 4c bookkeeping,
not an autopilot run, so "park" (a console/autopilot-only concept) is NOT
executable there. That finalize therefore VERIFIES `{drafts_dir}/<slug>/approval.json`
is present before flipping/finalizing anything; if the file is MISSING,
**HARD-STOP** with a clear message ("no approval.json for `<slug>` — refusing
to finalize without the console's proof-of-approval") and do NOT finalize —
never "park".

## State persistence

Everything important lives on disk:
- `{drafts_dir}/<slug>/brief.md`
- `{drafts_dir}/<slug>/checklist.md` (YAML frontmatter = machine-readable state)
- `{drafts_dir}/<slug>/research/_raw/_serp.json` + per-URL JSON files
- `{drafts_dir}/<slug>/research/_raw/_reddit_search.json` + `_reddit_selection.md` + per-thread JSONs (optional)
- `{drafts_dir}/<slug>/research/_raw/_x_search.json` + `_x_selection.md` + per-post JSONs (optional)
<!-- module: competitors -->
- `{drafts_dir}/<slug>/research/competitors.md` (only when brief.md lists competitors; sourced from the snapshot in `{drafts_dir}/<slug>/research/profiles/`, no `_raw/` artifacts)
<!-- /module -->
- `{drafts_dir}/<slug>/research/serp.md` (always)
- `{drafts_dir}/<slug>/research/reddit.md` / `research/x.md` (optional, present when the matching source ran)
- `{drafts_dir}/<slug>/facts.md`
- `{drafts_dir}/<slug>/plan.md` + `plan-review.md`
- `{drafts_dir}/<slug>/outline.md` (Stage 2)
- `{drafts_dir}/<slug>/draft-v<N>.md` (Stage 3a; N increments per revise pass)
- `{drafts_dir}/<slug>/review.md` (current iteration) + `review-v<N>.md` (archived prior iterations)
- `{drafts_dir}/<slug>/images.md` (Stage 4a image plan)
- `{drafts_dir}/<slug>/action-items.md` (Stage 4b human checklist)
- After Stage 4a.5: `{assets_dir}/<slug>/*` (rendered file-producing images) + `.staged-by-blog-workflow` sentinel
- After Stage 4b.5: the post (draft mechanism stripped, `[IMAGE:]` resolved, cover set) + assets committed on branch `{git.branch_prefix}<slug>` inside the worktree `.worktrees/blog-<slug>` (path in `pr-monitor.json`), a PR is open, and `{drafts_dir}/<slug>/pr-monitor.json` holds the PR number, branch, worktree, channels handled, and `status` (plus `wp_*` fields for the wordpress adapter). ALSO committed on that same branch: this post's Remotion composition sources (when any `remotion` slots exist), the featured-image rotation ledger `{ops_dir}/featured-log/<date>-<slug>.md` (this post's own rotation entry), and an early, non-terminal snapshot of `{drafts_dir}/<slug>/` at `{drafts_dir}/_archive/<slug>/` inside the worktree — a PR-completeness copy for reviewers, distinct from (and re-synced by) the LOCAL archive move below, which is still the only thing that actually retires the source directory.
- After Gate 2: the above all move to `{drafts_dir}/_archive/<slug>/`; the post + asset folder live under `{content_dir}` / `{assets_dir}`. (This LOCAL `mv` is what makes the archive terminal — the worktree's `{drafts_dir}/_archive/<slug>/` copy was already on the PR since staging and finalize just re-synced it to match.)

If the session dies, everything is on disk. Resume with `resume <slug>`.

## Error handling

- **Slug already exists when starting new:** ask the human to resume that slug or pick a different keyword.
- **Pilcrino browser unavailable or a site not signed in:** stop per §Browser (the sign-in gate); do not fall back to curl or Playwright.
- **SERP capture returns no results or `blocked`:** stop; likely captcha; report to the user.
- **>50% per-URL fetches fail:** offer retry / proceed-partial / abandon.
- **Researcher fails twice:** report; offer retry or proceed-with-partial.
- **Template missing or malformed:** stop immediately and report.
- **Persona file missing:** stop; report `${CLAUDE_PLUGIN_ROOT}/personas/editor.md` is required.
- **Config invalid / missing:** HARD-STOP per Step 0 (run /blog-setup first); never proceed on a partial config.
- **Module enabled but its artifacts are missing:** if a module is on in config but a required artifact is absent when a stage needs it (`modules.competitors: true` with a competitor profile missing at Stage 1.5c, or `modules.product: true` with `{profile_dir}/product.md` absent), HARD-STOP and report — never silently proceed as if the module were off.
- **`ai-prompt` slot render failure (Stage 4a.5):** per `${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md` §Disposition, the builder records the slot under `failed` in the `generate-images` manifest (NOT `prompt_pending` — that bucket is legacy since v0.4.0 and always empty). The slot's `Prompt:` block in `images.md` is left untouched and remains a valid, pasteable prompt, so it still serves as the manual fallback a human can execute by hand. For `ai-prompt`, "codex not on PATH / not logged in" is a normal failure reason (headless/cron sessions may lack a codex login). Step 13.5 already keys its re-spawn/reporting logic on missing-or-`failed` (see that step's step 5); a slot still `failed` after the re-spawn is left as a build-safe 'Image pending' note + an action-item, exactly like a `screenshot` slot. One failed slot never blocks the others.
- **WordPress REST failure (Stage 4b.5, wordpress-rest):** any non-2xx from an upload/create/update call → the adapter sets `wp_upload: failed` in `pr-monitor.json` (with the HTTP status) and reports WITHOUT halting the rest of staging (the markdown is already canonical in the repo). On resume, the adapter re-runs its staging idempotently: it updates the existing draft by the stored `wp_post_id`, and creates a new draft ONLY when there is no stored ID AND a slug lookup returns empty (the double-check that prevents duplicate drafts). See `${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md`.
- **Pause / abandon after Stage 4a.5 or 4b.5 (artifacts already in blog dirs):** clean up ONLY workflow-owned artifacts, via the active adapter's `## On abandon` (`${CLAUDE_PLUGIN_ROOT}/adapters/publish/<publish.adapter>.md`).
  - The post + assets live on `{git.branch_prefix}<slug>` inside the worktree, NOT loose in the main tree. **Leave the worktree in place on abandon as well as on pause** — an abandoned post is the case where the worktree is MOST likely to hold the only copy of something, since less of it ever reached a branch. It belongs in the console's worktree list for a human to delete once they have seen what is in it — and since no delete control has shipped there yet, that deletion is a manual one. The branch + PR remain on the remote either way; do not delete the remote branch/PR.
  - `wordpress-rest` additionally deletes the workflow-owned draft + media by the IDs recorded in `pr-monitor.json` (never anything discovered by other means).
  - Never delete an artifact lacking its ownership marker; report it to the human instead.

## What this skill does NOT do

- DOES `git commit` + `git push` the post on a `{git.branch_prefix}<slug>` branch and opens a PR at Stage 4b.5, and pushes comment-fixes to it, but NEVER merges the PR (the human merges to publish). For `wordpress-rest` it creates a WordPress *draft*, but never publishes it. Either way it does not merge or publish.
- Auto-generates the file-producing image assets (`remotion`, `ai-prompt` via codex) at Stage 4a.5 and stages them + the post into the blog at Stage 4b.5 (`[IMAGE:]` placeholders resolved to embeds where the rendered file exists on disk, or to a build-safe 'Image pending' note for `screenshot`/failed-render slots; cover set; draft mechanism handled by the adapter). It does NOT generate `screenshot` slots (those stay manual). It strips the draft mechanism (at staging on the PR path, or at finalize on the console path), but does NOT merge/publish (the human does that).
- Auto-resolves `[VERIFY:]` and `[EXTERNAL_LINK_NEEDED:]` markers at Stage 3d (web research against the allowlist/primary sources, then resolve-with-citation or delete the claim). It does NOT auto-resolve `[INTERNAL_LINK_NEEDED:]` (action-items, against our own posts) or `[IMAGE:]` (Stage 4a).
<!-- module: competitors -->
- Competitor pricing/feature `[VERIFY:]` markers are never web-resolved — they route to a Stage 1.5c profile refresh.
<!-- /module -->
- Does not produce the repurpose outputs (X / LinkedIn / newsletter) — that's the standalone `repurpose-blog-post` skill, invoked after the post is live (only when `modules.repurpose` is on).

## Quality gates

Per-stage verification checklists are in `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/quality-gates.md`. On stage completion, read the matching section and confirm every box before advancing.
