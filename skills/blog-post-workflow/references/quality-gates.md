# Quality gates

Verification checklist per stage completion. The editor reads this file when completing a stage to confirm the artifacts are in the expected shape before advancing. Not loaded on every skill invocation. All paths are the config-resolved variables (`{drafts_dir}`, `{content_dir}`, `{assets_dir}`, `{profile_dir}`); adapter-conditional items name both the PR path and the console path.

## After Stage 1c.5 (plan review), no human gate

- [ ] `{drafts_dir}/<slug>/brief.md` exists and is fully populated
<!-- module: competitors -->
- [ ] If `brief.md` lists competitors: the "Competitors to mention" table has a `Profile path` pointing to `{competitors_dir}/<slug>.md` for every named competitor (no URL columns)
<!-- /module -->
- [ ] `{drafts_dir}/<slug>/research/_raw/_serp.json` exists with ≥5 top results
- [ ] `{drafts_dir}/<slug>/research/_raw/NN-*.json` files exist (one per selected result, up to 8; **no minimum**, the selection criteria allow skipping weak / paywalled / failed results)
- [ ] `{drafts_dir}/<slug>/research/serp.md` exists; every claim traces to a raw file or URL; §"Citations harvested from competitors" is populated with `primary_source` / `auth_allowlist` candidates so the editor doesn't have to link to top-10 SERP URLs
- [ ] If Reddit / X enabled: matching `_raw/_<source>_search.json`, per-item files, and `research/<source>.md` all exist
<!-- module: competitors -->
- [ ] If `brief.md` lists competitors: every named competitor has a profile at `{competitors_dir}/<slug>.md` whose `**Last verified:**` is ≤14 days from today (Stage 1.5c freshness re-check passed); `research/competitors.md` exists, sourced from those profiles, and its §"Ready for facts.md" carries each profile's verification date verbatim
<!-- /module -->
- [ ] `{drafts_dir}/<slug>/facts.md` exists with sourced entries only
<!-- module: competitors -->
- [ ] Every `Competitor facts` row in `facts.md` has `Last verified` ≤14 days from today (date inherits from the source profile, not "today")
<!-- /module -->
- [ ] `{drafts_dir}/<slug>/plan.md` exists with status `approved` and no remaining placeholders
- [ ] `{drafts_dir}/<slug>/plan-review.md` exists with verdict `approve` (or verdict `request_revisions`/`reject` at iteration > 1 with residual concerns logged to checklist Notes)
- [ ] `{drafts_dir}/<slug>/checklist.md` YAML reflects current state
- [ ] The Pilcrino browser was used, not Playwright

## After Stage 2 (outline) completion (no human gate, editor self-checks)

The outline no longer goes through a human gate. The editor self-checks the items below before auto-progressing to Stage 3a. Any failure here means fix the outline first; don't dispatch the writer on a broken outline (the writer will produce a draft that the Stage 3b reviewer flags wholesale).

- [ ] `{drafts_dir}/<slug>/outline.md` exists with status `approved`, no remaining placeholders
- [ ] Every H2 in outline cites ≥1 fact from `facts.md` (sourced)
- [ ] Intro 4-paragraph shape present (hook / expertise / internal links / preview)
- [ ] Outline structure matches the observed search intent in `research/serp.md` §"Search intent" (intent-match self-check)
- [ ] FAQ block has 3–5 items with answer directions
- [ ] External link plan table populated; every row traces to `facts.md` OR to `research/serp.md` §"Citations harvested from competitors"
- [ ] Image placement plan has featured + per-major-section slots
- [ ] Outline word count roll-up within ±10% of `plan.md` length target
- [ ] External link plan rows all have `Source classification` = `primary_source` / `authoritative_allowlist` / `internal_facts`; zero `forbidden_serp_competitor` entries
- [ ] Every external link plan row's URL is NOT in `research/serp.md` top-10 (or, if it is, the host is on the authoritative-site allowlist)
- [ ] Checklist `current_stage=draft`, `gate_pending=none` (auto-progress completed)

## After Stage 3a completion

- [ ] `{drafts_dir}/<slug>/draft-v1.md` exists with the frontmatter block per the configured `publish.<adapter>.frontmatter_template`
- [ ] Draft word count ≥ 500 and within ±10% of outline target
- [ ] H2 order in draft matches outline exactly
- [ ] FAQ section exists with one `### <Q>` per outline FAQ item (+ JSON-LD in frontmatter when the configured frontmatter template emits it)
- [ ] No mass forbidden-phrase hits (≤ 5 distinct forbidden phrases across the whole draft)
- [ ] Every `[VERIFY:]` marker contains a non-trivial ` | source: <where>` clause
<!-- module: competitors -->
- [ ] Zero `[VERIFY:]` markers attached to competitor pricing or features (those must come from `facts.md`)
<!-- /module -->
- [ ] Zero external links to top-10 SERP URLs from `research/serp.md` (unless the host is on the authoritative-site allowlist)
- [ ] Zero absolute internal blog links: `grep -nE '\]\(https?://(www\.)?<blog.url host>{route_prefix}' {drafts_dir}/<slug>/draft-v<N>.md` (host from `blog.url`) returns nothing — cross-post links must be root-relative, canonical form `{route_prefix}<slug>` + trailing slash iff `blog.trailing_slash: true` (per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Internal linking)
- [ ] Writer's handoff summary is in `checklist.md` Notes
- [ ] Checklist Stage 3a items ticked, `current_owner=blog-post-workflow`

## After Stage 3b approval (any iteration)

- [ ] `{drafts_dir}/<slug>/review.md` exists with Verdict = `approve`
- [ ] Iteration number ≤ 3 (draft-v3 is the absolute ceiling; draft-v4 means escalation failed)
- [ ] Prior iterations' reviews archived as `review-v<N>.md` when the loop iterated
- [ ] Checklist Stage 3b items ticked

## After Stage 3c completion

- [ ] `{drafts_dir}/<slug>/draft-v<N>.md` still exists (humanize edited in place)
- [ ] Preservation check reported `PASSED` in the humanize handoff
- [ ] No surviving `.draft-v<N>.pre-humanize.md` backup file
- [ ] Forbidden-phrase count = 0 (or escalated to human with line numbers if residual)
- [ ] Word count delta within -20% to 0% (humanization typically reduces by 5–15%)
- [ ] Checklist Stage 3c items ticked, `current_stage=resolve_markers`

## After Stage 3d completion (marker auto-resolution)

- [ ] `grep -nE '\[(VERIFY|EXTERNAL_LINK_NEEDED):' {drafts_dir}/<slug>/draft-v<N>.md` returns nothing<!-- module: competitors -->, EXCEPT competitor-claim `[VERIFY:]` markers explicitly routed to the human (those stay + are logged)<!-- /module -->
- [ ] Every external URL added at this stage is `primary_source` or `authoritative_allowlist` class, and none is a `research/serp.md` top-10 URL
- [ ] Every added external URL returns HTTP 200 (the cited page actually loads and contains the claim, not just a search snippet)
- [ ] No claim was given a fabricated citation; unverifiable claims were deleted (or kept as a defensible general statement), not invented
- [ ] Re-lint clean: 0 em-dashes, no new forbidden phrases, no new absolute internal blog links
- [ ] `facts.md` updated to mirror resolutions (resolved items moved out of "Rejected / not verifiable"; new citations added)
- [ ] Per-marker outcome log written to checklist Notes (resolved / kept-general / deleted<!-- module: competitors --> / competitor-routed<!-- /module -->)
- [ ] Checklist Stage 3d items ticked, `current_stage=images`

## After Stage 4a completion

- [ ] `{drafts_dir}/<slug>/images.md` exists, filled from the resolved `images.md` template structure, no remaining `<placeholders>`
- [ ] One featured-image entry + one `### Image ` entry per `[IMAGE:]` placeholder in the draft (under `## In-post images`)
- [ ] Each in-post entry has `Type`, `Concept`, `Suggested filename`, `Alt text`, and a populated production-spec block matching its type
- [ ] Every entry's `Type` ∈ this blog's `images.enabled`; the featured slot's type = `images.featured_default` when set
- [ ] File destination path matches `{assets_dir}/<slug>/`

## After Stage 4a.5 completion (image generation)

- [ ] `{assets_dir}/<slug>/` exists and contains `.staged-by-blog-workflow`
- [ ] Every file-producing slot in `images.md` (`Type: remotion` or `Type: ai-prompt`) has its `Suggested filename` present as a non-empty file in the asset dir (featured + each in-post file-producing slot), except slots recorded `failed` (those carry a reason + a manual `Prompt:` fallback)
- [ ] No non-file-producing slot (`Type: screenshot`) produced a file (those stay manual; recorded `screenshot_pending`); the manifest's `prompt_pending` bucket is empty (legacy since v0.4.0)
- [ ] For each rendered slot, the builder ran its eyeball checklist per the slot's image adapter (`${CLAUDE_PLUGIN_ROOT}/adapters/images/<type>.md`)
- [ ] Checklist Stage 4a.5 items ticked, `current_stage=action_items`

## After preview-stage (Stage 4b.5)

- [ ] Every rendered embed (in-post + featured) passed the staging-step visual backstop (`${CLAUDE_PLUGIN_ROOT}/adapters/publish/astro-git-pr.md` §Staging step 3b; wordpress-rest step 1 runs the same check by reference) — no overlap/clipping/stray-glyph hit shipped unfixed; a still-broken slot after one retry carries the "Image pending" note instead
- [ ] The staged post exists and does NOT carry the draft mechanism (`publish.<adapter>.draft_mechanism`), so the staging build renders it; `{git.branch_prefix}<slug>` branch pushed and `{drafts_dir}/<slug>/pr-monitor.json` written with `pr_number` + `pr_url`.
- [ ] Zero `[IMAGE:` placeholders remain in the staged post (`grep -c '\[IMAGE:' <post>` = 0); each was replaced with EITHER a Markdown embed (the rendered file exists on disk) OR a build-safe `> **Image pending:**` note (screenshot slot or failed render; no local image reference)
- [ ] No Markdown image embed in the staged post points to a non-existent file under `{assets_dir}/<slug>/` (such an embed would fail an Astro build)
- [ ] `featured.<ext>` exists on disk and the configured frontmatter template's cover/hero field(s) point to it (astro-starlight: `cover.image` + `cover.alt`; astro-content: `heroImage`)
- [ ] Number of in-post embeds + 'Image pending' notes = number of `### Image ` entries in `images.md`
- [ ] `gh pr view <n>` shows the PR open
- [ ] **wordpress-rest only:** the WordPress draft was created (`wp_post_id` recorded in `pr-monitor.json`) and `wp_upload: ok` (or `failed` was reported with retry instructions, staging not halted)
- [ ] **PR path, remotion slots present:** each `remotion`-type slot's `{remotion_dir}/src/<id>.tsx` plus the `Root.tsx` registration diff are committed on the branch alongside the rendered images, not left as an uncommitted main-tree change
- [ ] A non-terminal snapshot of `{drafts_dir}/<slug>/` (the research/draft archive so far) is ALSO committed into the same PR at `{drafts_dir}/_archive/<slug>/` inside the worktree — an early completeness copy for reviewers; Gate 2 finalize re-syncs it to the final state before the LOCAL `mv`, which still happens only at finalize (see below)
- [ ] Checklist `current_stage=finalize`, `gate_pending=gate_2_final`

## After Stage 4b completion

- [ ] `{drafts_dir}/<slug>/action-items.md` exists with every section filled
- [ ] § 1 Create images checkbox count = images.md entry count
- [ ] § 2 / § 3 reflect the Stage 3d resolution log (resolved / kept-general / deleted<!-- module: competitors --> / competitor-routed<!-- /module -->); any residual `[VERIFY:]`/`[EXTERNAL_LINK_NEEDED:]` grep hit has a checkbox
- [ ] § 4 `[INTERNAL_LINK_NEEDED:]` checkboxes = grep hit count (Stage 3d does not touch these)
- [ ] § 6 / § 7 filled from the active adapter's §Action-items sections (astro authors-map status reflects `{publish.astro.authors_map_check}` when configured; else the adapter's N/A line)
- [ ] § 7 Publish block has real `<YYYY-MM-DD>`, `<slug>`, `<title>` values (not placeholder text)
- [ ] Checklist `current_stage=preview` (Stage 4b.5 staging is next; the checklist advances to `preview` at the start of Step 14.5)

## After Gate 2 approval + Finalize

- [ ] The staged post exists and does NOT carry the draft mechanism; the `{git.branch_prefix}<slug>` PR is open and approved; `pr-monitor.json` `status=done`; the monitor cron has been deleted.
- [ ] `{assets_dir}/<slug>/` exists with rendered images and `README.md` (copy of images.md added by finalize); the `.staged-by-blog-workflow` sentinel has been REMOVED (ownership released at finalize)
- [ ] No `[IMAGE:` placeholders remain in the staged post (each resolved at Stage 4b.5 to an embed where the rendered file exists, or a `> **Image pending:**` note otherwise)
- [ ] `{drafts_dir}/_archive/<slug>/` exists; original `{drafts_dir}/<slug>/` no longer exists
- [ ] Archived checklist has `status=complete`, `current_stage=complete`

  > **Console-side safety net (not a substitute for the two items above).** After the merge, the console's cleanup step (the post reads `cleaning` until it finishes) re-checks this post's archive in its own `_console-base` worktree, rescues what it can from the post's worktree into that same tree (committing and pushing the rescue itself) when the archive is incomplete, and parks the post `archive_missing` when it cannot. Three consequences for this session; nothing else about that machinery is actionable at gate-check time.
  >
  > - **Both items above have to hold — completing the `mv` is not enough.** The console's `healthy` verdict is exactly: `{drafts_dir}/_archive/<slug>/` non-empty, holding a `checklist.md` whose LEADING frontmatter reads `status: complete`. A finalize that moved the directory but never stamped the checklist classifies as incomplete and triggers the rescue-or-park path, on an already-published post.
  > - **Do NOT run git of your own against the main checkout's archive.** The console never commits the main checkout's tracked `{drafts_dir}/_archive/`, and uncommitted drift there is never something to fix from this session. The cleanup rescue does not touch it either: it writes into, commits from and pushes from the console's own base worktree, so a rescue reaches `origin/<base branch>` whatever branch the main checkout is on.
  > - **Do NOT remove the post's worktree** — not here, not at finalize, not on abandon. The console never removes it either, on any classification and any park reason; deletion is a human action.
  >
  > The mechanism behind that (which tree the console classifies, the four `ArchiveHealth` states, what each one does, and how to diagnose a post the check silently skipped) is operator diagnostics, not gate-check material: `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/console-contract.md` §Cleanup's archive check.

- [ ] **PR path:** the PR was NOT merged by the workflow (merge is the human's action to publish)
- [ ] The PR's `{drafts_dir}/_archive/<slug>/` worktree copy matches the just-`mv`'d local `{drafts_dir}/_archive/<slug>/` — finalize re-synced the early staging-time snapshot to the final state before the local move, so the PR carries the complete research/draft archive, not just the post + images
- [ ] **wordpress-rest only:** the WordPress post is `draft` (the normal case — the workflow never auto-publishes) OR `publish` (the external-publish path: the human clicked Publish in wp-admin themselves before/instead of a console or PR `approve`); `wp_post_id` / `wp_media_ids` / `wp_preview_url` are recorded as the permanent published-where record either way
- [ ] **wordpress-rest, external-publish path only:** if `GET .../posts/<wp_post_id>?_fields=status` returned `publish` before finalize ran (checked at the adapter's `## On Gate 2 approval` step 1, by the PR-comment monitor's per-firing check, or at a Gate 2 resume) → the final content sync (adapter §Staging steps 3-4 + the update call) was SKIPPED; only bookkeeping (archive, `pr-monitor.json`, cron deletion) ran, since the live post was already authoritative
