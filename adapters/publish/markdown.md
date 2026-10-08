# Markdown publish adapter

Read by: `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/SKILL.md` at Stage 4b.5 (staging), by the PR-comment monitor's review loop (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md`), at Gate 2 approval, and on abandon, for any blog whose `config.yaml` sets `publish.adapter: markdown`. The workflow dispatches to this doc by the exact H2 section names below. Also read by `${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/SKILL.md` Phase 5.

This adapter serves every platform Pilcrino has no direct adapter for: Hugo, Jekyll, Ghost, Next.js, Eleventy, and anything else that takes a markdown file. It writes `<slug>.md` in the frontmatter shape of the owner's platform, with the images beside it, and publishes through a pull request exactly as `${CLAUDE_PLUGIN_ROOT}/adapters/publish/astro-git-pr.md` does. It builds, deploys and uploads nothing.

## Config inputs

| Variable | Source |
|---|---|
| `{content_dir}` | `publish.markdown.content_dir` (default `posts`): each post lands as `{content_dir}/<slug>.md` |
| `{assets_dir}` | `publish.markdown.assets_dir` (default `posts/images`): each post's images land in `{assets_dir}/<slug>/` |
| `{image_url_prefix}` | `publish.markdown.image_url_prefix`, OPTIONAL. When set, bind it as `PREFIX` after normalizing the raw value `$raw`: `PREFIX=$(printf '%s' "$raw" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's:/$::')`. If `$PREFIX` does not start with `/`, `http://` or `https://`, stop with the message "publish.markdown.image_url_prefix must start with / or http(s):// (got: $raw)" and stage nothing. Set: every body image and the cover are referenced as `$PREFIX/<slug>/<file>` (a site URL). Absent: they are referenced by the source-relative path from `{content_dir}` to `{assets_dir}/<slug>/<file>`, which only works for a site that copies the assets folder next to the post page |
| `publish.markdown.platform` | one of `astro`, `hugo`, `jekyll`, `ghost`, `nextjs`, `eleventy`, `generic`; the only site knowledge this adapter has |
| `publish.markdown.frontmatter_template` | `adapters/publish/frontmatter/markdown-<platform>.md`, derived from `platform` at setup and written out, so every reader of `publish.<adapter>.frontmatter_template` finds the frontmatter contract |
| `{route_prefix}` | `blog.route_prefix`, used only by the inbound links of §Staging step 3 |
| `{remotion_dir}` | `images.remotion.project_dir`, read only when the post has a `remotion` slot (astro-git-pr.md §Staging step 6c) |
| `git.branch_prefix` | e.g. `blog/` |
| `git.base_branch` | e.g. `main` |

No `site_dir`, no authors map, no preview marker. `console.publish_policy` must be `gated` (config-schema.md invariant 10): every markdown post waits for the owner's approval.

**Platform groups.** The group decides what the merge does:

| Group | Platforms | What the merge does |
|---|---|---|
| Repo platform | `astro`, `hugo`, `nextjs`, `eleventy` | The site builds from `{git.base_branch}`: for a site that serves the configured image shape (§Config inputs, `{image_url_prefix}`), the merge publishes. The platform name alone never decides this |
| Paste platform | `jekyll`, `ghost`, `generic` | The merge files the post in the repository. The platform gets it only when the owner pastes it in, before approving. Jekyll is here because its `_posts` folder only picks up files named `YYYY-MM-DD-<slug>.md` |

`<Platform>` in the text below is the display name: Astro, Hugo, Jekyll, Ghost, Next.js, Eleventy, or "your platform" for `generic`.

Repo identity is never hardcoded: `git remote get-url origin` is the only source for the owner/repo pair, as in astro-git-pr.md.

## Site inspection (setup-time)

None. This adapter never reads the site. `publish.markdown.platform` and `publish.markdown.image_url_prefix` (the image shape the owner told setup their site serves) are its only site knowledge, and `blog-setup` writes no `{profile_dir}/site-conventions.md` for it. Pilcrino never verifies that the site serves the configured image shape: the first post's page on the site is the check.

## Relationship to the git repo

The repository is the canonical home of the post, whatever the site is. This adapter follows the shared git staging of `${CLAUDE_PLUGIN_ROOT}/adapters/publish/astro-git-pr.md` §Staging (Stage 4b.5) steps 6a to 6h VERBATIM (branch from `origin/<base>`, worktree, commit, push, `gh pr create`, `pr-monitor.json` with `mode: pr`), with `{content_dir}` and `{assets_dir}` bound from `publish.markdown.*`, never `publish.astro.*`: `$POST = {content_dir}/<slug>.md` and `$ASSETS = {assets_dir}/<slug>`. The PR path is the only publish path; its GitHub precondition is checked at Step 0 (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §GitHub precondition). For a repo platform, for a site that serves the configured image shape, the merge publishes; the first post's page on the site is the check. For a paste platform the owner pastes the post into the platform first (the zip the Pilcrino app builds: `post.md` plus its images, every image path rewritten to `./<name>`), then the merge files it in the repository.

## Staging (Stage 4b.5)

Unconditional, no human approval needed, as in astro-git-pr.md: never pause to ask, never ask permission to push. No platform API call, no media upload, no state beyond `pr-monitor.json`.

`REPO=$(git rev-parse --show-toplevel)`. Let `SLUG=<slug>`, `POST="$REPO/{content_dir}/$SLUG.md"`, `ASSETS="$REPO/{assets_dir}/$SLUG"`.

1. **Copy the post, resolve the images, set the cover, look at the renders.** Run astro-git-pr.md §Staging steps 1, 2 and 3 as written. Every embed destination is written as `$PREFIX/<slug>/<file>` (`$PREFIX` bound and checked per §Config inputs) when `publish.markdown.image_url_prefix` is set, else as the relative path from `{content_dir}` to `{assets_dir}/<slug>/<file>`, per the configured `markdown-<platform>.md` §Cover path computation. The cover goes under that doc's cover key (`heroImage`, `cover`, `image` or `feature_image`) with the same destination (`$PREFIX/<slug>/featured.<ext>` when the prefix is set, else the relative path), replacing any value the draft carried; a missing `featured.<ext>` stops staging exactly as step 3a there says. The staged copy now in the main tree is not a published post for the image-builder guard, which counts only `origin/{git.base_branch}`.
2. **Strip the draft key** (replaces astro-git-pr.md §Staging step 4), per the configured platform doc. Only the leading frontmatter block (line 1 `---` to the next `---` line) is touched; every body line, code fences included, stays byte for byte. Run exactly:
   - `astro`, `hugo`: remove `draft: true`:
     ```bash
     perl -i -ne 'if ($. == 1 && /^---\s*$/) { $fm = 1 } elsif ($fm && /^---\s*$/) { $fm = 0 } elsif ($fm && /^draft:\s*true\s*$/) { next } print' "$POST"
     ```
   - `jekyll`: remove `published: false`:
     ```bash
     perl -i -ne 'if ($. == 1 && /^---\s*$/) { $fm = 1 } elsif ($fm && /^---\s*$/) { $fm = 0 } elsif ($fm && /^published:\s*false\s*$/) { next } print' "$POST"
     ```
   - `ghost`, `nextjs`, `eleventy`, `generic`: no draft key; nothing to strip.
3. **Apply the planned inbound links.** astro-git-pr.md §Staging step 5 VERBATIM (ownership check, Link-only diff verification, dirty-file guard, write-ahead record, `<edited inbound posts>` admission, soundness invariant, resume rule), with `$P = {content_dir}/<existing-slug>.md`, found by grep over `{content_dir}`. If the outline planned none, skip this step.
4. **Open the PR.** astro-git-pr.md §Staging steps 6a to 6h VERBATIM: collision guard, worktree off `origin/<base>`, rebase on reuse, whole-file copies (post, images, inbound-link edits, Remotion sources, featured-log entry, early archive snapshot), sentinel removal, scoped commit and push, `gh pr create`, `pr-monitor.json`, then the main-tree cleanup. Its parks (`slug_collision`, `staging_conflicted`, `pr_create_failed`) apply unchanged.
5. **`pr-monitor.json`.** astro-git-pr.md §Staging step 7's schema, `mode: pr`. This adapter adds no fields.
6. **Preview line for the Gate 2 banner.** `Preview: <pr_url>` (the diff) and, when the blog is registered with the Pilcrino app, the app's preview page for this post. There is no staging site. For a paste platform the banner then carries this instruction, before any approval:

   > Download the zip from the app, or copy `{content_dir}/<slug>.md` and `{assets_dir}/<slug>/` from the worktree, and paste the post into <Platform> now; then approve. The zip's date is the download day; a copy from the worktree still carries the drafting date, so set <Platform>'s date field to today when you copy by hand.

   For `jekyll` add: "Name the file `YYYY-MM-DD-<slug>.md` when you put it in `_posts`." The order matters: after the merge and cleanup the app serves the published copy from the owner's checkout, which only has the post once they pull.
7. **Layout line for the Gate 2 banner.** `Layout: not checked (the markdown adapter has no site preview)`. Never omit the line.

## On review-loop edit

astro-git-pr.md §On review-loop edit as written: edit `$worktree/{content_dir}/<slug>.md` (or a file under `$worktree/{assets_dir}/<slug>/`), commit, push, reply on the PR with the handled marker. Nothing outside the repository holds the post, so there is nothing to re-sync.

## On Gate 2 approval

astro-git-pr.md §On Gate 2 approval as written: stop the monitor cron, re-sync the archive into the PR inside the worktree, push, then set the source `pr-monitor.json` to `done`, `mv` the drafts folder to `{drafts_dir}/_archive/<slug>/` and complete its checklist; the worktree stays. The paste instruction (§Staging step 6) was on the banner before approval. Report the PR is approved and ready to merge: for a repo platform "merging it publishes the post on a site that serves the configured image shape; check the first post's page on the site", for a paste platform "merging it files the post in the repository; <Platform> has it only if you pasted it in". Never auto-merge.

## On abandon

astro-git-pr.md §On abandon as written: leave the worktree, the branch and the PR for the human, and revert the workflow's own inbound-link edits in the main tree under the Link-only diff verification. Nothing outside the repository to delete.

## Action-items sections

The literal content this adapter supplies for `action-items.md` §4b, §6 and §7 (per `${CLAUDE_PLUGIN_ROOT}/templates/action-items.md` §6-7's pointer sentence), for `publish.adapter: markdown`.

### §4b, Inbound links

Repo platform (`astro`, `hugo`, `nextjs`, `eleventy`): the `astro-git-pr` wording; each row applied at §Staging step 3 ships in the same PR as the post. If the outline planned none, the template's default "None." stands.

Paste platform (`jekyll`, `ghost`, `generic`): the `wordpress-rest` rule. The live posts on <Platform> are not the repository, so for every existing post in `<edited inbound posts>` write one item:

- [ ] Add the link to `<existing-slug>` on <Platform> by hand (the repository copy already has it): link text `<anchor>`, target `{route_prefix}<slug>`.

If the outline planned none, "None." stands.

### §6, none

There is no authors map to reconcile: write "§6. N/A for the markdown adapter." and continue to §7.

### §7, Publish

Repo platform (`astro`, `hugo`, `nextjs`, `eleventy`):

- [ ] Review the PR diff at `<pr_url>` one more time (cover image, inbound links). The frontmatter date does not need checking: the app rewrites it to the day of the merge on the branch, immediately before merging.
- [ ] Merge the pull request; your site builds from `{git.base_branch}`.
- [ ] After the build finishes, verify the live post per action-items §8.

Paste platform (`jekyll`, `ghost`, `generic`):

- [ ] Review the PR diff at `<pr_url>` one more time (cover image, inbound links).
- [ ] Paste the zip (or `{content_dir}/<slug>.md` and `{assets_dir}/<slug>/`, setting the date field to today) into <Platform>, then merge the pull request.
- [ ] Jekyll only (emit this item only when `platform` is `jekyll`): name the file `YYYY-MM-DD-<slug>.md` in `_posts`.
- [ ] Once <Platform> shows the post, verify it per action-items §8.
