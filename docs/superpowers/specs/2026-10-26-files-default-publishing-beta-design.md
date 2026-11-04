# Files by default, publishing to the site as beta

## Why

The public plugin launch should be simple for a first-time owner. Today setup's "Where your posts go" phase (`skills/blog-setup/SKILL.md` Phase 5) fits Pilcrino to the owner's site. It covers:
- whether the site is live and rebuilds from GitHub
- platform detection
- Astro schema edits
- Hugo theme fitting
- how images are served
- the WordPress username, application password, `jq` and auth probe
- site conventions

Each of those is a place a new owner can stall, and each is a code path that has had less testing than the core writing pipeline.

After this change, every new setup ends the same way by default: **each post arrives as a pull request holding one markdown file and a folder with its images.** Merging files the post in the repository and nothing more. Publishing to the site (WordPress drafts, or a site built from the repository with Astro, Hugo, Next.js or Eleventy) stays available as an opt-in labelled beta.

"Beta" is a label only: it works, it is less tested. No warning screen, no extra confirmation.

## Goals

- A new owner who takes the default answers one publishing question in Phase 5 and nothing else there. Phase 1 (site address, route prefix, trailing slash) and Phase 1.5 (reading the live site) are out of scope and unchanged: the validator needs those values, and inbound links use them.
- The default never publishes anything by accident, whatever the repository is (Astro, Hugo, Jekyll, Next.js, Eleventy, an empty repo).
- Today's publishing flows still exist, unchanged, behind the beta choice, and they say which platforms they support.
- No new pipeline: the default is the existing `markdown` adapter.
- The Pilcrino app keeps working with the default without an app change.

## Non-goals

- Removing GitHub. The pull request is the deliverable; Phase 0's `gh` install, sign-in and repository step stay as they are.
- Changing the beta flows themselves (the `astro-git-pr`, `wordpress-rest` and repo-platform `markdown` steps).
- Migrating existing blogs. A `config.yaml` that already names `astro-git-pr`, `wordpress-rest` or a `markdown` repo platform keeps it when setup runs again; nothing is downgraded to files.

## Anti-goals

- A merged default post showing up on the owner's live site, or breaking its build, without the owner having been told and having declined the fix (see the ignore step).
- The default path asking the owner anything about their site's internals (schema, theme, image URLs, draft flags).
- Requiring an app release before this plugin version can be pinned.

## The default: "files" mode

Files mode is not a new adapter and adds no config key. It is this shape of the existing `markdown` adapter:

```yaml
publish:
  adapter: markdown
  markdown:
    content_dir: blog-ops/posts
    assets_dir: blog-ops/posts/images
    platform: generic          # or ghost, or jekyll (the format, below)
    frontmatter_template: adapters/publish/frontmatter/markdown-<platform>.md
git:
  branch_prefix: blog/
  base_branch: <the repository's default branch>
```

- **No `image_url_prefix`.** Images are referenced relative to the post, exactly as `markdown-generic.md` §Cover path computation already describes. With these folders the cover is `images/<slug>/featured.png`.
- **No `site_live`.** It is not asked and not written. Paste platforms already ignore it (`blog-post-workflow/SKILL.md` Gate 2 banner rules), and the image completion gate then requires only the featured image, as today when it is absent.
- **No `cover_key`, `frontmatter_keys` or `draft_key`.** The template's own keys are used.
- **Why only `generic`, `ghost`, `jekyll`.** These are the three platforms the plugin (`markdown.md` §Platform groups) and the app (`console/src/markdown-platform.ts`, `paste: true`) both treat as paste platforms: the merge files the post, it does not publish it. Using a repo platform (`hugo`, `astro`, `nextjs`, `eleventy`) in files mode would make the workflow banner and the app say "merging publishes", which is false for a file in `blog-ops/posts/`. That is the reason files mode needs no new key and no app change.

### Why `blog-ops/posts/`

Decided with the owner (26 Oct 2026): one folder for every blog, inside `blog-ops/`, next to the rest of Pilcrino's files, so the owner always knows where to look. The alternatives fail:
- **The site's own posts folder** (Astro `src/content/blog`, Hugo `content/posts`). The merge publishes a file the site never agreed to. Astro's schema rejects it (`date` vs `pubDate`, unknown keys, image paths) and the build fails. Hugo publishes it with the cover missing.
- **A top-level `posts/`** (today's `markdown` default). Next.js blog starters commonly read a top-level `posts/` or `_posts/`.

Astro, Hugo and Next.js do not read `blog-ops/`. Jekyll and Eleventy do: see the next section.

### Keeping `blog-ops/` out of Jekyll and Eleventy builds

Jekyll, and Eleventy when its input folder is the repository root, turn every markdown file in the repository into a page. That already includes `blog-ops/` today, for every adapter: setup never excludes it (checked: no `exclude`/`.eleventyignore` handling anywhere in the plugin). In files mode it would also publish each merged post at a stray address like `/blog-ops/posts/<slug>.html`.

Setup therefore adds one ignore entry for `blog-ops/`, **for every adapter**, when the repository is:
- **Jekyll:** a `_config.yml` at the site root, or a GitHub Pages site built by Jekyll (`gh api repos/<owner>/<repo>/pages` reports `build_type: legacy` and the repository has no `.nojekyll`). Add `blog-ops` to `_config.yml`'s `exclude` list. Builder: confirm how the target Jekyll versions treat a user `exclude` list (whether it replaces or extends Jekyll's default excludes such as `node_modules`, `vendor`), and if it replaces them, keep the defaults in the list too. A Pages site with no `_config.yml`: create one holding only the `exclude` entry.
- **Eleventy:** detected by any supported config file (`.eleventy.js`, `eleventy.config.js`, `eleventy.config.mjs`, `eleventy.config.cjs`) or an `@11ty/eleventy` dependency in `package.json` (Eleventy runs with no config file at all). Today's adapter detection knows only `.eleventy.js` (`skills/blog-setup/SKILL.md` around line 2162); widen it for both uses. When the input folder (the config's `dir.input`, or the `--input` flag in a `package.json` script, default `.`) contains `blog-ops/`, Add `blog-ops/` to `.eleventyignore`, creating the file if needed. Builder: confirm that creating `.eleventyignore` does not switch off Eleventy's use of `.gitignore` in the versions in use.

Jekyll does more than render markdown: it copies every other file that is not excluded as it is, so `blog-ops/config.yaml`, the research captures and the profile docs end up on the site too (and GitHub Pages renders markdown even without front matter). This is an action, not a counted question, on both paths. It is asked with consent in one sentence: "Your site publishes every file in the repository it is not told to skip, Pilcrino's own notes and settings included. Shall I add one line to `<file>` so it skips the `blog-ops` folder?" The edited file joins setup's commit (Phase 6). Declined: say once "Then merged posts will also appear on your site at an address under /blog-ops/." and continue. Setup does not block on a decline (my call, over a reviewer's suggestion to leave setup incomplete): the owner has been told what happens and the repository is theirs. Record the decline in `setup-notes.md` so a re-run does not ask again unless the owner asks for it.

**It runs outside Phase 5's resume gate** (my call), like today's "pending required sub-flow" exception for site conventions: on a re-run where Phase 5 is kept as it is (Global rule 3, or the quick path keeping finished phases), the step still runs when the repository matches and neither the ignore line nor a recorded decline exists. That is how existing Jekyll and Eleventy blogs get the fix.

### The format question

After files is chosen, the post's field names can follow the platform the owner will put the files into:

| Answer | `platform` | What changes |
|---|---|---|
| "Not sure, keep it plain" (first, the default) | `generic` | `title`, `description`, `date`, `tags`, `author`, `image` |
| Ghost | `ghost` | Ghost's names (`excerpt`, `published_at`, `feature_image`), and the field-by-field paste steps at review |
| Jekyll | `jekyll` | `layout: post`, `image`, the `YYYY-MM-DD-<slug>.md` filename reminder and the paste steps |

- **Detailed path:** asked as a menu, counted.
- **Quick path:** never asked. Derived: `jekyll` when the Jekyll test above matches, otherwise `generic`. Setup has no Ghost detection today, so the quick path never picks `ghost`; an owner who wants Ghost's field names takes the detailed path or re-runs setup. Stated in the summary before the commit ("Post format: plain markdown").

Hugo, Astro, Next.js and Eleventy are not formats in files mode, for the reason given under "Why only `generic`, `ghost`, `jekyll`". An owner who wants Hugo's field names wants Hugo publishing, which is the beta.

## Setup changes (`skills/blog-setup/SKILL.md`)

### Phase 5 opens with one question, both paths

"Where your posts go", counted on both paths, as a menu:

1. **"Files in a pull request (recommended)"**: "Each post is a markdown file with its images, in `blog-ops/posts/` in your repository. Merging the pull request files it there; you put it on your site yourself."
2. **"Publish to my site (beta)"**: "WordPress (as drafts you publish), or a site built from this repository with Astro, Hugo, Next.js or Eleventy."

When detection (today's adapter-choice detection, run before the question) recognises a supported site, option 2's label names it: "Publish to your Astro site (beta)", "Create drafts in your WordPress (beta)". Detection only changes the label; option 1 is always first and is the default. When nothing supported is detected (Jekyll, a hosted CMS, an empty repository), option 2 keeps the general wording with the platform list, so the menu always has two options (my call: the owner may be moving to a supported site).

**Beta replaces today's adapter-choice confirm** (my call). Picking a label that named the detected site selects that adapter: today's "Interview: adapter choice" confirm is not asked again. Picking the general label asks today's adapter menu, limited to the beta platforms, counted. So the beta path asks exactly one more question than today only when nothing was detected.

### Files chosen

- Write the block shown above. State the folder in one line ("Posts go in `blog-ops/posts/`, with their images in `blog-ops/posts/images/`") and do not ask for folders.
- `mkdir -p` both folders (an action, as today's markdown step does).
- The format question (above).
- The Jekyll/Eleventy ignore step (above). It runs regardless of which option was chosen.
- On a repository that is a site (Astro, Hugo, Next.js, Eleventy, Jekyll detected), say once: "Your site won't show these posts; merging only files them in `blog-ops/posts/`. To have Pilcrino publish to your site, run setup again and choose the beta."
- Skip the rest of Phase 5: the live-site question and its deployment evidence, adapter detection beyond the label, the `astro-git-pr` / `wordpress-rest` / `markdown` sub-flows, site conventions. The `git:` block and the GitHub precondition still run.
- The `jq` check (Phase 0a check 6, deferred to the start of Phase 5 on both paths once the adapter is WordPress) does not run.

### Beta chosen

Today's Phase 5 from "Interview: how the site goes live" onward, unchanged, except that adapter detection now chooses only among `astro-git-pr`, `wordpress-rest` and `markdown` with a repo platform (`hugo`, `nextjs`, `eleventy`, and `astro` where today's flow offers it). Jekyll, Ghost and hosted CMS routes in today's adapter choice move to files mode.

### Resume and re-runs

**A completed quick-path setup can change where posts go.** Today a quick-path re-run keeps every finished phase without asking (`skills/blog-setup/SKILL.md` 0d), so "run setup again and choose the beta" would not work. Change 0d: when `Path: quick` and every phase already has its files, ask one menu instead of continuing silently: "Your setup is complete. What would you like to change?" with "Where your posts go", "Go through everything" and "Nothing, just check it". "Where your posts go" runs Phase 5 with "update", then Phase 6's validation and commit. An interrupted quick-path setup (some phase without files) resumes as today.

**Switching to files sets the approval policy.** When files is chosen on a blog whose `console.publish_policy` is `auto` (allowed only for `astro-git-pr`, invariant 10), set it to `gated` in the same whole-file rewrite, keep the rest of the `console:` block, and say: "Every post now waits for your approval."

Phase 5's resume check reads `publish:` as today. An existing config is described in the "keep as-is / update / start over" summary in owner words ("Posts go to your WordPress as drafts (beta)", "Posts are files in `blog-ops/posts/`"). "Keep as-is" keeps it, whatever it is, so existing WordPress, Astro and Hugo blogs are never moved to files. "Update" asks the new first question again.

An existing `markdown` blog with `platform: generic`, `ghost` or `jekyll` and a `content_dir` other than `blog-ops/posts` (today's `posts/` default) keeps its folders, on "keep as-is" and on "update" alike (my call): its posts already live there, and the inbound-link grep over `{content_dir}` must keep finding them. Only a fresh setup, or "start over", writes `blog-ops/posts`.

### Counting

- Quick path: Phase 5 is one counted question in files mode. Update the quick path's per-adapter counts where they exist.
- Detailed path (§Counting the detailed path): add a row, files mode, publishing 2 (where posts go, format), base T 50. The existing rows are unchanged when the beta label named the detected site (the new first question replaces the adapter confirm), +1 when the general label leads to the adapter menu.
- Quick path T (Global rule 10's list): unchanged for beta in the detected case, +1 in the undetected case.

### Skill description and wording

The skill's frontmatter `description` mentions fitting the site, the WordPress keychain and the adapter auth probe. Reword it so those read as the beta path, with files as the default.

## Workflow and adapter wording

**Every operative paste prerequisite goes for `generic`; `ghost` and `jekyll` keep theirs.** Known places (builder: grep for more, `paste`, `pasted`, `<Platform> has it`):
- `adapters/publish/frontmatter/markdown-generic.md` line 3 ("the owner pastes the post in before approving").
- `adapters/publish/markdown.md` §On Gate 2 approval (around line 91: "<Platform> has it only if you pasted it in", and the merge that "only files the repository copy of a post the owner has pasted").
- `skills/blog-post-workflow/SKILL.md` around lines 1204, 1267, 1273 ("Once the post is pasted into <Platform>"), 1295 ("Publish it" on a paste platform) and 1317.

The files-mode default is `generic` for most owners, and today `generic`'s review wording assumes a platform ("put the post into your platform… fill these fields one by one… when it looks right in your platform, tell me approve"). A new owner may have no platform yet.

- **`adapters/publish/markdown.md` §Staging step 6, `generic` only:** the banner becomes: "Your post is the file `<path>`, and its pictures are in the folder I opened. Read it in the pull request (<pr_url>); when it reads right, tell me "approve". Merging files it in your repository. To put it on a site, copy the file and its pictures there; the title, description, date, tags and cover are at the top of the file." `ghost` and `jekyll` keep today's field-by-field paste steps. Existing `generic` blogs (Webflow and similar) get the new wording too (my call: the field list was a convenience, and the fields are at the top of the file).
- **`skills/blog-post-workflow/SKILL.md`** Gate 2 banner (around line 1204), approval report (around 1267) and merge step (around 1317) say "<Platform> has it only once you paste it in" for paste platforms. For `generic`, replace with "Merging files the post in your repository." and drop the paste clause. `ghost` and `jekyll` unchanged.
- **The "Merged" closing message** (around line 1283) and action-items §7's last item ("Once <Platform> shows the post, verify it per §8"): see "When a files post counts as published" below.
- **§Action-items §7, paste platform, `generic`:** "Put the post into <Platform> as the Gate 2 banner says…" becomes optional wording for `generic`: "If you publish the post somewhere, copy the file and its pictures there."
- **§4b inbound links:** unchanged. For a paste platform it already says to add the link by hand on the platform. Builder: decide whether `generic` needs a softer wording here too, consistent with the banner.

## When a files post counts as published

Decided with the owner (26 Oct 2026): **for `platform: generic`, the merge is the publish.** The deliverable is the merged file; Pilcrino never waits for the owner to put it on a site. `ghost` and `jekyll` keep today's rule (published once the platform shows it), since those owners do paste the post somewhere.

- **Go-live test:** unchanged. Step 16.5 already treats a merged PR as live for `markdown`.
- **"Merged" closing message** (`skills/blog-post-workflow/SKILL.md` around line 1283), `generic`: "The post is merged and filed in `blog-ops/posts/<slug>.md`." with no "once <Platform> shows it" clause.
- **When this session sees the merge** (a Step 15.6 merge, the monitor's merged path, a resume that finds the PR merged), a standalone blog continues straight into Step 16.5: the merge-date check, the content-plan row set to `published`, the commit, the cleanup offer. The owner does not have to run `published <slug>`. A registered blog changes nothing here: the app already marks the post published on merge.
- **When the owner merges on GitHub with nothing watching**, the Gate 2 approval report (around line 1267) says for `generic`: "After you merge, run /pilcrino:blog-post-workflow published <slug> and I'll mark it published in your content plan."
- **Action-items §7**, `generic`: drop "Once <Platform> shows the post, verify it per action-items §8". Builder: decide which of §8's post-publish items still apply to a post that is on no site, and write "N/A" for the rest.

## README

- The intro bullet "Published as a pull request" and the paragraph "It works with sites built from a GitHub repository… creates drafts in WordPress, and hands you a file to paste in…" lead with the default: each post arrives as a pull request with a markdown file and its images. WordPress, Astro, Hugo, Next.js and Eleventy publishing are named as beta.
- §Publish adapters: a short files-mode paragraph first, then the existing table under a "beta" heading.
- Quickstart and FAQ: check for sentences that promise the merge publishes, and qualify them as beta.
- Version bump in `.claude-plugin/plugin.json` (minor: 0.60.0) and a Changelog entry, per the repo's CLAUDE.md.

## The Pilcrino app

No app change is required: files mode is `adapter: markdown` with a platform the app already marks `paste: true`, and the app reads `content_dir`/`assets_dir` from config with no location rule (`console/src/config.ts`). The app's `generic` wording ("Paste the zip into your platform first", `console/public/markdown-words.js`) reads oddly for an owner with no platform. That is an optional follow-up in the app repository, not part of this change.

## Testing

- `./tests/lint.sh` passes.
- `skills/blog-setup/scripts/validate-config.test.mjs`: add a files-mode config fixture (generic, `blog-ops/posts`) and confirm it passes all 16 invariants unchanged.
- **A fresh-OS run after implementation, required before the release tag.** Method, harness scripts and tester prompts: the app repository's `docs/testing/fresh-mac/` (start with `methodology.md`; checkpoints in `plan.md`; lessons in `process.md`). It is the same Tart VM test as the October rounds: an Opus subagent plays the owner Dana Reyes and drives Claude Code in the VM's Terminal. Closest earlier run: re-test 8, a Webflow blog with no repository (`runs/2026-10-13-retest-8-webflow.md`), which took today's `generic` path end to end.
  - **Start from** the `prereqs-signed` checkpoint (prerequisites installed, Pilcrino's browser signed in to Google and Reddit), which Tart still holds on this Mac (`tart list`, 26 Oct 2026). Clone it, update the plugin to this release (`methodology.md` step 2), and pin Claude Code in the VM to Opus. For the Phase 0 wording below, add a run from `pilcrino-base` (before the prerequisites) so the opening message is seen by an owner who has nothing installed. `hugo-posted` and `custom-posted` are listed in `plan.md` but no longer in Tart.
  - **Runs:** (1) quick path, no repository, take the default through one post to merge: one publishing question, the post and images in `blog-ops/posts/`, the banner and closing wording, the plan row set to `published` on merge. (2) quick path on an Astro repository: the beta label names Astro, the default is still files, the "your site won't show these posts" line. (3) a completed quick-path re-run choosing "Where your posts go".
  - **Findings** are appended to lucky72o/slavhurmanau#84 under a new run heading, not filed as new issues.
- Real builds, run by hand, of a Jekyll fixture and an Eleventy fixture (root input, no config file) with a files-mode post merged: assert that nothing under `blog-ops/` (posts or settings) is in the build output and that the site still builds.
- Setup scenarios, run by hand, each checked against the generated `config.yaml`: detailed path taking the defaults; a completed quick-path re-run choosing "Where your posts go"; an interrupted quick-path resume; declining the ignore line (and that a re-run does not ask again); an Astro blog with `publish_policy: auto` updated to files (the policy becomes `gated` and the validator passes).
- The validator fixture above is a compatibility check only: the unchanged validator already accepts this shape.

## Also in this change: say up front that GitHub is required

Not part of the files default, but asked for in the same review (owner, 26 Oct 2026). Today a new owner learns that Pilcrino needs git and a GitHub repository only when a check fails (Phase 0a check 1 or 3) or at 0b answer 3 ("Pilcrino still needs a GitHub repository for this blog"). Say it before the first check.

- **Phase 0's opening sentence** (`skills/blog-setup/SKILL.md` Phase 0, "Before any questions, I'll check that this Mac has what Pilcrino needs, then find your blog.") becomes, in substance: "Pilcrino keeps your posts and its settings in a GitHub repository, and opens every post as a pull request for you to review. So you need a GitHub account (a free one works), and this Mac needs git and GitHub's command line tool; I'll install those with you if they're missing. Before any questions, I'll check this Mac, then find your blog." On Windows and Linux, "this computer".
- **No GitHub account yet** (my call): check 4's sign-in step says once, before the device code: "No GitHub account yet? Create one at https://github.com/signup, then come back here." Today it assumes an account exists.
- **0b answer 3** keeps its sentence but no longer reads as news: "As I said at the start, Pilcrino needs a GitHub repository for this blog."
- **README** "What you need" already lists the GitHub CLI; check its first line says a GitHub account is required, and the Quickstart says the same in one sentence.
- **Skill description** (frontmatter) already names the GitHub CLI preflight; no change.

## Left to the builder

- The exact owner-facing wording, within the meaning given above.
- The Jekyll `exclude` and Eleventy `.eleventyignore` semantics checks flagged above.
- Whether the beta label wording needs a fuller platform list on narrow menus.
- Where in Phase 5's text the split lands; the beta branch's existing text should move as little as possible.
