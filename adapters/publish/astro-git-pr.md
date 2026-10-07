# Astro git-PR publish adapter

Read by: `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/SKILL.md` at Stage 4b.5 (staging), by the PR-comment monitor's review loop (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md`), at Gate 2 approval, and on abandon/pause cleanup — for any blog whose `config.yaml` sets `publish.adapter: astro-git-pr`. The workflow dispatches to this doc by the exact H2 section names below; it never re-derives the mechanics documented here. Also read by `${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/SKILL.md` at setup time (existing-blog research), which runs `## Site inspection (setup-time)` below exactly once, before any post workflow exists for this blog.

This is the parameterized port of the original git-based blog-publishing flow: every path, branch name, and repo identifier below is read from config, never hardcoded.

## Config inputs

| Variable | Source |
|---|---|
| `{content_dir}` | `publish.astro.content_dir` |
| `{site_dir}` | `publish.astro.site_dir` (default: the repo root) - the Astro project root. Every `npm run build` / `npm run dev` in this adapter runs there, and the emitted `dist/` is `{site_dir}/dist` |
| `{assets_dir}` | `publish.astro.assets_dir` |
| `{remotion_dir}` | `images.remotion.project_dir` — read only when this post has ≥1 `remotion`-type slot in `images.md`; §Staging step 6c commits this post's composition sources alongside its images |
| `{route_prefix}` | `blog.route_prefix` (default `/blog/`) — this blog's post URL prefix; used in inserted inbound links (trailing slash governed by `blog.trailing_slash`, per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Internal linking), the ownership/idempotency greps, the Link-only diff verification pattern, and preview URLs below |
| `publish.astro.frontmatter_template` | which frontmatter contract this post's frontmatter follows: `adapters/publish/frontmatter/astro-starlight.md` or `astro-content.md` |
| `publish.astro.draft_mechanism` | the literal frontmatter line marking a post excluded from the production build, e.g. `draft: true` |
| `publish.astro.authors_map_check` | OPTIONAL; a repo-relative path to the site config file holding the author-key map (e.g. `astro.config.mjs`); omit to skip the check |
| `publish.astro.preview_comment_marker` | OPTIONAL; an HTML comment marker (e.g. `<!-- blog-preview -->`) the site's CI upserts on the PR with the staging-deploy URL; omit to show the PR URL only |
| `git.branch_prefix` | e.g. `blog/` |
| `git.base_branch` | e.g. `main` |

Repo identity is never hardcoded: `git remote get-url origin` is the only source for the owner/repo pair, re-derived every time it's needed (never cached anywhere except as the `repo` field already written into `pr-monitor.json`).

## Site inspection (setup-time)

Run exactly once by `${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/SKILL.md` (existing-blog research phase), never by `blog-post-workflow` — produces `{profile_dir}/site-conventions.md` (shape: `${CLAUDE_PLUGIN_ROOT}/templates/site-conventions.md`), the per-blog data file every later stage reads instead of guessing at this site's conventions. Purely repo-based: reads files already in the workspace repo, no network calls, no auth of any kind, so the auth-probe reuse/lockout rules that gate `wordpress-rest.md`'s equivalent section simply don't apply here.

1. **Platform.** Read `astro.config.mjs`/`.ts` and the content-collections config (`src/content/config.ts` or equivalent) to identify MDX vs. plain Markdown, and any custom remark/rehype plugins or reusable MDX components registered for use in post bodies — this site's "block/component library" equivalent. Record in `## Platform`. If nothing custom is registered, write "plain Markdown/MDX, no custom components in post bodies."

2. **Table of contents.** Read 1-2 existing posts under `{content_dir}` plus the layout component that renders a post page (commonly `src/layouts/<Post|Blog>Layout.astro`, located via the content-collection's render call). If the layout auto-generates a TOC from headings (a component invocation, nothing repeated per-post), or if authors hand-write a TOC snippet into each post's Markdown/MDX body, copy the EXACT source (the component invocation, or the literal Markdown/MDX snippet) into `## Table of contents`, verbatim. Write "none" if neither exists in any inspected post.

3. **Categories.** Read the content-collections schema (`src/content/config.ts`) for a `category`/`tags`-like enum or union type, and `Grep` the distinct values actually used across existing posts' frontmatter under `{content_dir}`. List the full taxonomy in `## Categories`, and draft the per-cluster mapping against `{profile_dir}/blog.md` §Content pillars — same as the WordPress adapter's equivalent step; a human confirms the mapping before it's final.

4. **SEO plugin.** A git-based site has no server-side SEO plugin. Check instead whether the layout/site emits SEO metadata via a component (e.g. a site-wide `<SEO />`/`<Head />` component) or an installed integration package, and how a post's meta description / focus keyword reaches it — almost always a frontmatter field the writer sets directly. Describe the mechanism generically in `## SEO plugin` (e.g. "a site-wide SEO/meta component reading the post's `excerpt` frontmatter field") rather than asserting a specific package name unless one is actually found in `package.json`. Since there is no REST surface at all here, `## SEO plugin`'s "settable via standard REST" sub-field is always "N/A — no REST API for a git-based site; the value is a frontmatter field the writer sets directly."

5. **Permalinks.** Read the routing: for content-collections, the URL is typically `{route_prefix}` + the entry's slug via a dynamic route file (e.g. `src/pages/blog/[...slug].astro`), or Starlight's own routing config. Check whether that route emits a trailing slash: read `trailingSlash` and `build.format` from the Astro config (`build.format: 'file'` builds each page as `<route>.html` and serves it without a slash; the default folder style builds `<route>/index.html` and serves it with one), and cross-check against one existing post's actual dev-server or built URL if convenient. This MUST agree with `blog.trailing_slash` in `config.yaml` — flag any disagreement to the human instead of silently picking one.

6. **Post furniture.** Read the post layout component for an author-box, related-posts, or disclosure-block include (commonly separate components like `<AuthorBox />` / `<RelatedPosts />`, or inline Markdown boilerplate repeated across posts). Record what's found in `## Post furniture`, noting per element whether it's layout-automatic (nothing this workflow needs to emit) or content the post's own Markdown/MDX must carry.

7. **Write the resolved template.** Fill the resolved `site-conventions.md` (per the layered `{templates}` rule: `blog-ops/templates/site-conventions.md` if the blog has one, else `${CLAUDE_PLUGIN_ROOT}/templates/site-conventions.md`) with the findings above, and save the result to `{profile_dir}/site-conventions.md`. Present it to the human for confirmation before treating it as final.

## GitHub precondition (not re-derived here)

The `## Staging (Stage 4b.5)` section below assumes the Step 0 config preamble
already confirmed `git remote get-url origin` resolves and `gh repo view`
against it succeeds (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md`
§GitHub precondition). There is no second path: if either check had failed, the
workflow hard-stopped at Step 0 and never reached this doc.

## Worktree-safe invocation

Every command below resolves the repo root fresh, never a cached or hardcoded absolute path (a hardcoded path silently reads/writes the wrong tree once a worktree is in play):

```bash
REPO=$(git rev-parse --show-toplevel)
```

## Staging (Stage 4b.5)

Runs after Stage 4b (action items), or on resume when `current_stage=preview`. Stages the post + assets into their final blog paths in the current tree so the author can read the rendered version before Gate 2. **Opening the PR here is unconditional, no human approval needed** (standing instruction): never pause to ask PR-vs-local, never ask permission to push. The PR is always built on a fresh branch in an isolated `git worktree` so the operator's current working branch is never switched or disturbed; the worktree persists through the review phase, and after finalize (`## On Gate 2 approval`) too — deletion belongs to a human alone, via the console's worktree list, never to this workflow.

Let `SLUG=<slug>`, `POST="$REPO/{content_dir}/$SLUG.md"`, `ASSETS="$REPO/{assets_dir}/$SLUG"`.

1. **Copy the post:** `cp` the latest `{drafts_dir}/<slug>/draft-v<N>.md` → `$POST`.
2. **Replace `[IMAGE:]` placeholders.** Grep the staged post for `[IMAGE:` in document order. The Nth hit maps to the Nth `### Image N` entry under `## In-post images` in `images.md`. For each entry, let `F="$ASSETS/<Suggested filename>"`. Branch on file existence:
   - **`F` exists on disk** → replace the placeholder line with a Markdown embed: `![<Alt text>](<relative path from {content_dir} to {assets_dir}/<slug>/<Suggested filename>>)` — see the configured frontmatter template's §Cover/hero path computation for the exact relative-path formula, the same rule applies to every in-post embed, just targeting that image's filename instead of `featured.png`.
   - **`F` does NOT exist** (a `screenshot` slot, which is never auto-rendered, or a `remotion`/`ai-prompt` slot whose render failed) → replace the placeholder line with a build-safe pending note carrying **no local image reference**: `> **Image pending:** <Alt text> (Type: <type>). Create this asset per action-items, then replace this line with the image embed.`
   Astro resolves a local Markdown image `src` at dev/build time; emitting one for a file that doesn't exist FAILS the build (it is not a soft broken image). Never emit a local embed for a missing file.
3. **Set the featured cover, then verify every render (before Gate 2).**
   a. Verify `$ASSETS/featured.<ext>` exists before touching frontmatter. If missing, STOP staging — report to the human, branching the remediation on the featured slot's `Type:` in `images.md` §Featured image: **file-producing** (`remotion` or `ai-prompt`) → "re-run Stage 4a.5 (the builder re-renders missing slots)"; **manual** (`screenshot`) → "create it per images.md §Featured image and save to {assets_dir}/<slug>/, then resume". Do not proceed further either way (a missing cover fails the build). If present, inject it into the staged post's frontmatter per the configured frontmatter template's cover/hero field(s) (Starlight variant: `cover.image` + `cover.alt`; content-collections variant: a single `heroImage`), sourced from the `## Featured image` block in `images.md`. If a cover/hero key already exists from the draft frontmatter, replace its value rather than duplicating the key.
   b. **Look at the rendered images.** `Read` each embedded in-post image plus `featured.<ext>` that resolved to a real Markdown embed at step 2 (skip any slot left as an `> **Image pending:**` note — there's nothing rendered to inspect). Check for visual defects: nothing overlaps or touches (a label vs. an adjacent card, two cards, a connector vs. a card), borders/fields are visibly contrasted against the background, no caption or label is clipped or wraps into a stray line, no stray or ambiguous glyphs, a long string uses a wrapped card rather than an overflowing single-line pill. For any `remotion`-type slot, also re-run that slot's full `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md` §Eyeball checklist. The builder self-checks at render time (Stage 4a.5), but this is a backstop so the human is never the first to see a broken image. Any hit → re-run Stage 4a.5 for that slot (fix the source + re-render); still broken after one retry → flag to the human and ship the "Image pending" note instead.
4. **Strip the draft mechanism.** Remove the `{publish.astro.draft_mechanism}` line from the staged post's frontmatter, e.g. for the default `draft: true`:
   ```bash
   perl -i -ne 'print unless /^draft:\s*true\s*$/' "$POST"
   ```
   The PR build (which excludes draft posts) plus the review branch are the gate.
5. **Apply the planned inbound links to existing posts (before Gate 2).** For each row in the outline's "Inbound internal links" section (existing post slug + section/context + anchor), let `P="$REPO/{content_dir}/<existing-slug>.md"`. Process each row in this order — **the ownership check (grep + checklist Notes) runs FIRST**, the dirty-file guard runs only when the link isn't present:

   **Link-only diff verification (shared definition, used by step 5a below, re-used at step 6h, and re-used at §On abandon):** `git diff HEAD -- "$P"` (worktree vs HEAD — this deliberately includes any changes that were already `git add`ed, not just unstaged ones; a plain `git diff` alone would miss a staged copy of our own edit or of mixed-in edits) must show, as its ONLY change, the single inserted link line/sentence matching the ERE `\({route_prefix}<slug>/?\)` (substitute `{route_prefix}` and `<slug>` with this post's literal values before using the pattern; kebab-case slugs contain no ERE metacharacters, so no additional escaping is ever needed there) — escaped parens anchored to the markdown-link boundary, since the canonical inserted form is `[<anchor>]({route_prefix}<slug>)` or `[<anchor>]({route_prefix}<slug>/)` (the actual inserted link ends in `/` or not per this blog's `blog.trailing_slash`, per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Internal linking canonical form; this verification's job is confirming the diff contains our link, not re-deriving which convention this blog uses). Slugs never contain `/` or `)`, so the closing paren, with an optional trailing slash before it, IS the word boundary a bare substring match lacks: matching the unanchored substring `{route_prefix}<slug>` would let a short planned slug (e.g. `run`) false-match an unrelated existing link to a longer slug sharing the same prefix (e.g. `{route_prefix}running-shoes/`) (an extended-sentence edit = one removed line plus the same line with the link added — attributable; any other added/removed line or extra hunk — not).

   a. **Ownership check (load-bearing for resume):** grep `$P` with the ERE `\({route_prefix}<slug>/?\)` — escaped parens, not the bare substring `{route_prefix}<slug>` alone. Slugs never contain `/` or `)`, so the closing paren, with an optional trailing slash before it, is the markdown-link boundary a bare substring match lacks: without it, a short planned slug (e.g. `run`) would false-match an unrelated existing link to a longer slug sharing the same prefix (e.g. `{route_prefix}running-shoes/`). The anchored form still matches whether this blog's `blog.trailing_slash` appends a slash or not, so the same grep works unmodified for every blog regardless of its convention. Presence alone is NOT proof the workflow put it there — a user can type the identical link by hand. Consult the checklist Notes, the durable write-ahead record written at step (c) below:
      - **Recorded** as `inbound link applied by workflow: $P` → it's ours, but recorded-and-present is NOT by itself sufficient to admit the file: run the **Link-only diff verification** (above) on `$P` before adding it anywhere.
        - **Verification passes** (diff is just our link) → ADD `$P` to the `<edited inbound posts>` list so step 6c copies it into the worktree; do NOT re-insert. Continue to the next row.
        - **Verification fails** (the diff carries additional local edits beyond our link) → do NOT add `$P` to `<edited inbound posts>` — copying it into the PR would publish those unreviewed edits alongside it. Record an action-item note: "workflow-applied inbound link on `$P` is now mixed with additional local edits; the file is excluded from the PR — either clean the extra edits and resume, or ship the link with your own commit." Continue to the next row. (Resume edge: if an EARLIER run already got this same file past steps 6c/6e — i.e. the clean version was already copied, committed, and pushed onto `$BRANCH` before this run's local copy picked up further edits — the PR already carries the link correctly; excluding the file here only means this re-run doesn't overwrite that already-committed branch copy with the now-dirty local one.)
      - **NOT recorded** → the link is user-authored: the operator added it (or equivalent text) by hand, possibly alongside other edits, either before this run started or after an earlier workflow-applied link was superseded. Do NOT add `$P` to `<edited inbound posts>` — copying a user-dirty file into the PR would publish unreviewed user edits alongside it. SKIP the row and record an action-item note: "inbound link already present in your local working copy (not workflow-applied); it ships with your own commit and is not part of this PR." Continue to the next row.
   b. **Dirty-file guard (load-bearing for the Link-only diff verification above; only reached when the link is NOT yet present):** run `git status --porcelain -- "$P"`; if it reports anything, the file carries genuine pre-existing uncommitted edits that predate this workflow — SKIP applying the inbound link to this file, record the skip in the checklist Notes as an action-item row ("apply by hand — file had local edits"), and continue to the next row. (`--porcelain`'s two status columns report index-vs-HEAD and worktree-vs-index respectively, so this already covers both staged and unstaged edits — no separate staged-changes check is needed here.)
   c. **Clean file:** FIRST record the path in the checklist Notes as `inbound link applied by workflow: $P` (write-ahead: record, then edit — a crash between the two leaves a recorded-but-linkless file; the next run's step (a) greps for the link, finds nothing yet, treats the file as not-yet-applied, and falls through to (b)/(c) again, simply re-applying). THEN edit `$P` to insert a root-relative link in the canonical form from `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Internal linking — `[<anchor>]({route_prefix}<slug>)`, or `[<anchor>]({route_prefix}<slug>/)` iff this blog's `blog.trailing_slash: true` — at the contextual spot, preferring to extend an existing related-posts sentence over bolting on a new "see also" line, and ADD `$P` to the `<edited inbound posts>` list.

   If the outline planned no inbound links, skip this step entirely.

   **Soundness invariant:** admission to `<edited inbound posts>` requires ALL of: (1) the checklist Notes record from step (c) — written BEFORE the edit — as the durable authority for "did the workflow insert this link" (not link-presence alone; that's what step (a) consults, on first runs and resumed ones alike, so a file the workflow never touched is never claimed as ours just because it happens to already contain matching link text); (2) the link still present on disk; and (3) the **Link-only diff verification** passing at admission time (step 5a). A recorded, link-present file whose diff has picked up additional edits since — e.g. the workflow inserted the link in a prior crashed run and the operator made further edits before this run resumed — FAILS condition (3) and is excluded at admission, before step 6c's whole-file copy ever runs, so those unreviewed edits never reach the PR. Step 6h re-verifies the same rule per file at cleanup time as defense in depth (time, and possibly another crash, can pass between admission and cleanup) — it is a backstop for drift in that window, not the primary gate. Net effect: the PR can never receive a file whose staged diff, at the time it was copied into the worktree, contained anything beyond the workflow's own inserted link.

   **`<edited inbound posts>` on resume:** this list is never carried in memory across a crash — it is reconstructed each run as the set of paths that pass ALL of step 5a's admission checks (recorded in the checklist Notes as workflow-applied, still match the boundary-anchored ERE `\({route_prefix}<slug>/?\)` on disk — the same pattern the ownership check at step 5a uses, so this rule matches regardless of `blog.trailing_slash`, and unlike a bare substring can't be fooled by an unrelated existing link to a longer slug sharing the same prefix — AND pass the Link-only diff verification) — step (a)'s list plus step (c)'s list, each filtered through that verification — so a resumed run rebuilds it correctly from durable state rather than from what it remembers doing.
6. **Open the PR via an isolated worktree.** All paths repo-root-relative (cwd = repo root). `BASE={git.base_branch}`, `BRANCH={git.branch_prefix}$SLUG`, `WT=.worktrees/blog-$SLUG`. **First `git fetch origin "$BASE"`, then base everything on `origin/$BASE`** (a stale local base branch yields a noisy/garbage PR diff). Steps 1-5 staged the post/assets/inbound-link edits in the MAIN working tree; the worktree moves them onto `$BRANCH` without ever switching the operator's current branch.
   a. **Ownership guard (slug collision, authoritative):** after the fetch, if `$SLUG.md` already exists on `origin/$BASE`, STOP — a published post owns the slug; report, do not proceed. This is the ONLY slug-collision check; the former main-tree pre-check existed solely for posts published on the deleted local path.
      ```bash
      git cat-file -e "origin/$BASE:{content_dir}/$SLUG.md" 2>/dev/null && { echo "collision: $SLUG.md exists on origin/$BASE"; exit 1; }
      ```
   b. **Create/reuse the worktree off `origin/$BASE`:** if `$WT` already exists (resume), reuse it; else if `$BRANCH` already exists, `git worktree add "$WT" "$BRANCH"`; else `git worktree add "$WT" -b "$BRANCH" "origin/$BASE"`.

   b2. **Re-base the branch onto `origin/$BASE` whenever it did not come from there — MANDATORY on both reuse paths.** Only the third path above (`-b "$BRANCH" "origin/$BASE"`) is fresh by construction. A reused `$WT` or a pre-existing `$BRANCH` was created at some earlier moment, frequently from the operator's LOCAL base branch, which routinely carries unpushed commits and trails `origin`. Both defects are silent and neither is cosmetic:

   - **Unrelated local commits ride along into the PR**, so the diff contains work this run never wrote.
   - **The PR conflicts with the base**, and a conflicting PR is *silently dead*: GitHub cannot construct `refs/pull/<n>/merge`, so NOT ONE `pull_request` workflow runs — no build, no staging deploy, no preview comment, and `gh pr checks` reports "no checks reported" rather than a failure. Squash-merge repos make this near-certain: the previous post's branch carried the same local commits, its squash re-added those files as unrelated content, and the next post's branch now collides with them.

   Do not merely report the divergence in the PR body — REPAIR it, before copying anything in at sub-step c:

   ```bash
   git -C "$WT" fetch origin "$BASE" --quiet
   # Commits on the branch that origin/$BASE does not already contain:
   git -C "$WT" log --oneline "origin/$BASE..HEAD"
   git -C "$WT" rebase "origin/$BASE"
   ```

   `git rebase` drops any commit whose patch is already upstream, which is exactly what should happen to local commits a previous post's PR already merged. If the rebase reports conflicts, resolve ONLY the deterministic ones (the legacy `{ops_dir}/featured-log.md`, per sub-step b3) and `git rebase --continue`; for anything else, list the conflicting paths with `git -C "$WT" diff --name-only --diff-filter=U`, then `git rebase --abort` and PARK with `staging_conflicted`, detail `"branch <name> conflicts with origin/<base> in: <path>, <path>"` (the paths comma-separated). Never force a resolution on a content file you did not write this run.

   b3. **Legacy `{ops_dir}/featured-log.md` only.** Rotation history is now one file per post under `{ops_dir}/featured-log/` (`suggest-images` Step 4 item 7), which cannot conflict — two posts write two different filenames. The old single-table ledger is read-only history and is never appended to, so it cannot conflict either. If a pre-split branch still carries a row against it, resolve by UNION: every row from both sides, ordered by the Date column ascending, deduplicated by slug (a slug on both sides keeps the branch's row). Never drop the base side's rows — those are other posts' archetype history, and losing them makes the image-planner repeat an archetype it should have rotated away from.
   c. **Copy the staged artifacts from the MAIN tree onto `$BRANCH` (inside `$WT`).** Copy only here, don't remove anything from the main tree yet (it stays the recovery source until sub-step h). Whole-file copies, never a patch transfer:
      - New post + assets: `mkdir -p "$WT/{content_dir}" "$WT/{assets_dir}/$SLUG"`, `cp "$POST" "$WT/{content_dir}/$SLUG.md"`, `cp -R "$ASSETS/." "$WT/{assets_dir}/$SLUG/"` (copy CONTENTS, avoids dir nesting).
      - Inbound-link edits to existing posts: `cp` each edited post over the worktree's base copy.
      - **Remotion composition sources (PR completeness), when this post has any `remotion`-type slot in `images.md`:** `mkdir -p "$WT/{remotion_dir}/src"`, then for each such slot's `images.md` "Composition `<Still>` ID" field, `cp "$REPO/{remotion_dir}/src/<id>.tsx" "$WT/{remotion_dir}/src/<id>.tsx"`; also `cp "$REPO/{remotion_dir}/src/Root.tsx" "$WT/{remotion_dir}/src/Root.tsx"` (whole-file copy of the shared registration file — its diff against the worktree's base copy is just this post's new `<Still>` entries, since nothing else touches that file between when the worktree was created off `origin/$BASE` and now). Skip this bullet entirely when this post has zero `remotion` slots — there is nothing to add, and `{remotion_dir}` may not even be configured.
      - **Featured-image rotation entry:** `mkdir -p "$WT/{ops_dir}/featured-log"`, then `cp` THIS post's entry file `{ops_dir}/featured-log/<date>-$SLUG.md` into it. One file, this post's own — never the whole directory, which would drag other posts' entries into this PR. Also `cp "{ops_dir}/featured-log.md" "$WT/{ops_dir}/featured-log.md"` when that legacy table still exists in the main tree (read-only history; copied so a fresh checkout keeps it). This is what makes the rotation durable — without it a fresh checkout or another machine reads stale history and the planner repeats archetypes.
      - **Research/draft archive (PR completeness, early non-terminal snapshot):** `mkdir -p "$WT/{drafts_dir}/_archive/$SLUG"`, `cp -R "{drafts_dir}/$SLUG/." "$WT/{drafts_dir}/_archive/$SLUG/"` (copy CONTENTS; include `research/_raw/` in full even if bulky, it's still just text/JSON — never filter it out). **This is a read-only completeness copy for reviewers, not the terminal archive:** the `checklist.md`/`pr-monitor.json` copied here still carry their CURRENT, non-terminal values (`status: open`, etc.) — nothing is edited to a terminal value at this point. `## On Gate 2 approval` step 2 below RE-SYNCS this exact same path to its final state (and is the ONLY place that edits the worktree copies of those two files to terminal values) before the LOCAL `mv` — which is what still actually retires `{drafts_dir}/$SLUG/` on disk, entirely unchanged by this addition. Never treat this staging-time copy as evidence the post is done; only the source-side `mv` at finalize (step 3 there) is that signal.
   d. **Remove the asset ownership sentinel so it never ships:** `rm -f "$WT/{assets_dir}/$SLUG/.staged-by-blog-workflow"`.
   e. **Scoped add + idempotent commit + push, ALL in the worktree (never `git add -A`):**
      ```bash
      git -C "$WT" add "{content_dir}/$SLUG.md" "{assets_dir}/$SLUG" "{drafts_dir}/_archive/$SLUG" "{ops_dir}/featured-log" <edited inbound posts> <remotion composition paths, if any>
      git -C "$WT" diff --cached --quiet || git -C "$WT" commit -m "blog: <title> ($SLUG)"
      git -C "$WT" push -u origin "$BRANCH"
      ```
      `<remotion composition paths, if any>` = `{remotion_dir}/src/<id>.tsx` (one per `remotion` slot) + `{remotion_dir}/src/Root.tsx`, from sub-step c above; omit entirely when this post has zero `remotion` slots. Add `{ops_dir}/featured-log.md` too when that legacy table exists in the main tree; omit either featured-log path from the add list when it doesn't exist there (`git add` on a missing path errors) — the directory is absent on a blog's first post, and the legacy table is absent on any blog created after the split.
      The `diff --cached --quiet` guard IS the idempotency mechanism (a resumed run whose commit already exists must not error); the push is a no-op if the branch is already up to date. **If the push fails, do NOT clean the main tree.** PARK with reason `pr_create_failed`, detail = the verbatim `git push` output plus the worktree path. The staged artifacts stay intact for a retry; a human resolves the GitHub problem and resumes.
   f. **Open the PR (idempotent):**
      ```bash
      gh pr create --base "$BASE" --head "$BRANCH" --title "<title>" \
        --body "<summary: target keyword, author voice, word count, image count, inbound links applied, action-items reminder>"
      ```
      If it fails because a PR already exists for `$BRANCH` (resume), capture it instead: `gh pr view "$BRANCH" --json number,url`. **If `gh pr create` fails for another reason (e.g. auth), the main tree is still intact.** PARK with reason `pr_create_failed`, detail = the verbatim `gh` output plus the worktree path. Capture the PR number + URL either way.
   g. **Write the monitor state file**, `{drafts_dir}/<slug>/pr-monitor.json` (schema below), including the `worktree` path so the review-loop monitor and the finalize sequence commit into the SAME worktree.
   h. **Only now, after the PR exists AND `pr-monitor.json` is written, clean the MAIN tree** (deferred this late so any failure at e/f/g leaves the staged artifacts recoverable in the main tree): `rm "$POST"`, `rm -rf "$ASSETS"`; then, for EACH `$P` in `<edited inbound posts>` — never a blanket `git checkout HEAD -- <edited inbound posts>` — RE-verify before resetting:
      - **Per-file RE-verification (defense in depth, not the primary gate):** re-run the **Link-only diff verification** defined at step 5 on `$P`. Admission to `<edited inbound posts>` at step 5a already proved the diff was link-only at STAGING time (before step 6c's copy); this re-check exists because time — and possibly another crash — can pass between that admission and this cleanup step, during which the operator could edit `$P` further (e.g. while the PR sits mid-review-loop, or a crash lands between step 6c's copy and this step and the run resumes later). It is a re-check of the same rule, not a new one, and is not the mechanism that keeps unreviewed edits out of the PR — that's step 5a.
      - **Diff is still verifiably just ours** → `git checkout HEAD -- "$P"` (explicitly from HEAD, not from the index — this both updates the worktree AND unstages/reverts any staged copy of `$P` — resets the file to HEAD wholesale; safe here specifically because the diff just verified contains nothing else).
      - **Diff now contains anything beyond the link insertion** → do NOT checkout that file. Leave it in place, and report to the human: "additional local edits found on `$P` beyond the workflow's inbound link; file left untouched (the PR already carries the link on the branch); reconcile manually." Continue cleaning the other files in the list.

      The operator's working tree is now pristine for every file that passed re-verification (any flagged file is left with its extra edits intact, reported for manual reconciliation); the post lives only on `$BRANCH`.
7. **`pr-monitor.json` schema** (written at step 6g):
   ```json
   { "slug": "<slug>", "repo": "<owner>/<repo>", "pr_number": 0, "pr_url": "",
     "branch": "{git.branch_prefix}<slug>", "base": "{git.base_branch}", "worktree": ".worktrees/blog-<slug>",
     "staging_url": "", "status": "open", "mode": "pr",
     "handled_comment_ids": { "issue": [], "inline": [], "review": [] },
     "created_at": "<ISO8601>", "last_poll": "",
     "poll_interval_minutes": 15, "idle_polls": 0 }
   ```
   `poll_interval_minutes` / `idle_polls` are the PR-comment monitor's idle-backoff state (`skills/blog-post-workflow/references/pr-monitor.md` §Adaptive cadence); write the defaults shown here.
   `repo` is derived, never hardcoded:
   ```bash
   REMOTE_URL=$(git remote get-url origin)
   REPO=$(echo "$REMOTE_URL" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
   ```
   `status`: `open` | `approved` | `done` | `closed`. Every branch commit (open, comment-fixes, archive) happens via `git -C "$worktree"`.
8. **Preview line for the Gate 2 banner.** If `publish.astro.preview_comment_marker` is configured, read the CI's PR comment matching that marker for the staging-deploy URL; if CI hasn't posted it yet, show the PR URL and note "staging deploying, check back". If the marker is not configured, show the PR URL only — never guess at a preview host.
9. **Layout line for the Gate 2 banner.** When step 8 found a staging-deploy URL AND the PR head commit has proof of its deploy, as `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md` §Each firing step 2a defines it (every check run for `$(git -C "$worktree" rev-parse HEAD)` completed with conclusion `success`, at least one run, and any commit id in the marker comment a prefix of that head; an earlier push's deploy can be the one behind the URL until then), run the layout check on it and report the result on the banner's `Layout:` line:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/adapters/publish/scripts/layout-check.mjs" --url "$PREVIEW_URL"
   ```
   Exit 0, and the JSON's `finalUrl` is the preview URL (or the same page with a trailing slash) and its `title` is the post's: `Layout: fits at 1440px and 390px`. Any other `finalUrl` or a `title` that is not the post's means a redirect or a placeholder page was measured: `Layout: not checked (the preview answered with <title>)`. Exit 1: `Layout: N finding(s)`, then one line per finding from the JSON (`at 1440px <table> "Claim as found" extends 147px past the article`); these are blocking for the editor, not for the human: say what to change (wrap the cell, shorten the URL, split the table) or that the site's stylesheet is at fault, and let the human decide at Gate 2. Exit 2: `Layout: not checked (<error>)`, never silent. When step 8 had no URL yet, or the checks are still running: `Layout: pending, the monitor runs it when the staging preview for this commit is up` (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md` §Each firing step 2a). The check opens the page in a throwaway headless Chrome at a desktop and a phone width and reports anything that extends past its container; it needs the Pilcrino browser's packages (`node "${CLAUDE_PLUGIN_ROOT}/browser/bin.mjs" install`, once).

## On review-loop edit

While the PR is open (`pr-monitor.json` `status: open`), every addressed review comment (from the PR-comment monitor cron, or a live console comment) is a target-state edit applied the same way:

1. Resolve the worktree from `pr-monitor.json`'s `worktree` field; if it no longer exists on disk, recreate it from the branch, falling back to the remote branch if the local one is also gone.
2. Make the change by editing the file under `$worktree/{content_dir}/` (or `$worktree/{assets_dir}/`), re-derived from the comment's intent so the edit is idempotent (re-processing the same comment produces the same target state, never a duplicate change).
3. `git -C "$worktree" add <path>`; commit only if something is staged (`git -C "$worktree" diff --cached --quiet || git -C "$worktree" commit -m "<one-line summary>"`); `git -C "$worktree" push` (re-triggers the site's staging deploy).
4. Reply on the review surface carrying the marker `<!-- handled:<channel>:<id> -->` so the at-most-once dedup invariant holds (full polling + reply mechanics: `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md`).

All post-file edits during this phase target paths under `$worktree/`, never the operator's main working tree.

## On Gate 2 approval

The post is already publish-ready at this point (draft mechanism stripped at staging) and committed/pushed on `$BRANCH` via the worktree. **This is bookkeeping only — the human merges the PR; the merge itself is what deploys.** Ordering is load-bearing: the source checklist completion and the `mv` to the archive both happen LAST, only after the archive is safely pushed, so a crash mid-finalize leaves `{drafts_dir}/<slug>/` non-terminal (with `pr-monitor.json` still `status: open`) and a resume re-runs this idempotently.

1. Stop the PR-comment monitor cron (`CronDelete`).
2. **Re-sync the archive into the SAME PR, in the worktree copy only** (this path may already exist from §Staging step 6c's early, non-terminal snapshot — expected; this step is what makes it final): `mkdir -p "$WT/{drafts_dir}/_archive/<slug>"`, re-copy the CURRENT contents of `{drafts_dir}/<slug>/` in (`cp -R "{drafts_dir}/<slug>/." "$WT/{drafts_dir}/_archive/<slug>/"`, avoids dir nesting — overwrites the staging-time snapshot with anything that changed since, e.g. Gate 2 "request changes" revisions to `outline.md` / `images.md` / `action-items.md`), drop the `README.md` copy of `images.md` into `$WT/{assets_dir}/<slug>/` if absent. Edit ONLY the worktree copies of `checklist.md` (→ `status=complete`, `current_stage=complete`, `gate_pending=none`) and `pr-monitor.json` (→ `status: done`) to their final state — do NOT touch the SOURCE copies yet (they stay non-terminal until step 3, so a crash before the push leaves a recoverable, non-terminal state). **This step, not §Staging step 6c, is what makes the PR's archive copy final** — the staging-time copy was a completeness courtesy for reviewers, never the terminal record, so committing it early never weakens the crash-recoverable ordering below: the archive push must still land before the SOURCE `status=done`/`mv` in step 3, exactly as before this doc had a staging-time copy at all. Then:
   ```bash
   git -C "$WT" add "{drafts_dir}/_archive/<slug>" "{assets_dir}/<slug>/README.md"
   git -C "$WT" diff --cached --quiet || git -C "$WT" commit -m "blog archive: <slug>"
   git -C "$WT" push
   ```
   The `diff --cached --quiet` check IS the idempotency mechanism (never substitute `git ls-files`, which also reports staged-but-uncommitted paths and would wrongly skip a needed commit).
3. **Only after the archive push succeeds:** set `status=done` in the SOURCE `pr-monitor.json`, then `mv {drafts_dir}/<slug>/` → `{drafts_dir}/_archive/<slug>/` in the main tree, and complete the now-archived `checklist.md` (same terminal values as the worktree copy).
4. **Leave the worktree in place.** Do NOT remove it. The worktree persists after finalize and is deleted only by a human — deletion belongs there, in the console's worktree list, so nothing is destroyed before a human has seen what the tree still holds. Three separate code paths used to delete it and one of them force-deleted, taking untracked research and generated assets with it; deletion now has exactly one owner. The branch and the PR remain on the remote either way.

Report the PR is approved and ready to merge; the human merges it. Never auto-merge.

## On abandon

Triggered on a pause/abandon after staging has already touched blog directories (Stage 4b.5 ran). Clean up ONLY workflow-owned artifacts, and never delete anything lacking its ownership marker.

- **PR path:** the post + assets live on `$BRANCH` inside the worktree, not loose in the main tree. **Leave the worktree in place on abandon as well as on pause** — an abandoned post is the case where the worktree is MOST likely to hold the only copy of something, since less of it ever reached a branch. It belongs in the console's worktree list for a human to delete once they have seen what is in it. **The branch and the PR remain on the remote** (the human closes or reuses them); never delete the remote branch or close the PR programmatically.
- **Inbound-link edits:** step 5 applies inbound links directly in the MAIN tree, before the worktree ever exists, and step 6h is the only step that reverts them there — but 6h runs only AFTER the PR exists, so an abandon before that point (a mid-worktree failure on the PR path) leaves them sitting unreverted in the main tree, ready to ship dead-link edits in the operator's next unrelated commit. For each path recorded in the checklist Notes as `inbound link applied by workflow: $P` (reconstruct the set exactly as step 5a does), skip it if the link is already gone from disk (6h already reverted it), otherwise re-run the **Link-only diff verification** (§Staging step 5):
  - **Passes** (diff is still just our inserted link) → `git checkout HEAD -- "$P"` (revert our link, explicitly from HEAD).
  - **Fails** (mixed with other local edits since) → do NOT touch `$P`; report to the human: "remove the inbound link to `{route_prefix}<slug>` (with or without a trailing slash, per this blog's `blog.trailing_slash`) from `<path>` manually (mixed with your local edits)."

## Action-items sections

The literal content this adapter supplies for `action-items.md` §6/§7 (per `${CLAUDE_PLUGIN_ROOT}/templates/action-items.md` §6-7's pointer sentence), for `publish.adapter: astro-git-pr`.

### §6, Authors-map check (conditional)

Emit this section ONLY if `publish.astro.authors_map_check` is set in config; if unset, write "§6. N/A — no authors-map check configured for this blog." and skip straight to §7.

- [ ] Confirm every `authors:` entry in the post's frontmatter is a literal key in `{publish.astro.authors_map_check}` (case-sensitive — see `adapters/publish/frontmatter/astro-starlight.md` §Authors map for the case rule). If a new author isn't yet a key there, add it before merging the PR.

### §7, Publish

- [ ] Review the PR diff at `<pr_url>` one more time (cover image, inbound links). The frontmatter date does not need checking: the console rewrites it to the day of the merge on the branch, immediately before merging (`console/src/publish-date.ts`).
- [ ] Merge the PR into `{git.base_branch}`. The merge itself triggers the site's production deploy — the workflow never merges on your behalf.
- [ ] After the deploy finishes, verify the live post per action-items §8.
