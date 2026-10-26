# Files by default, publishing as beta: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New setups default to "a markdown file plus images in a pull request" (the `markdown` adapter, `generic`/`ghost`/`jekyll`, in `blog-ops/posts/`), with WordPress and repo-built site publishing offered as a labelled beta.

**Architecture:** Almost all of the change is prose in the skill and adapter documents the model follows. No new adapter, no new config key, no app change. Each task first adds phrase assertions to a new guard script, `tests/check_files_default.sh` (wired into `tests/lint.sh`), then edits the prose until the guard passes. The validator gets one compatibility fixture.

**Tech Stack:** Markdown skill docs, Bash (guard script, same style as `tests/check_competitor_reads.sh`), Node `node:test` (validator tests).

**Spec:** `docs/superpowers/specs/2026-10-26-files-default-publishing-beta-design.md`. Read it whole before Task 1; every task argues from it. Where this plan quotes copy, the spec's wording wins on any difference.

## Global Constraints

- Never write an em dash or an en dash used as a sentence break, in any file or commit message (check `—`, `–`, `&mdash;`, `&#8212;`).
- Owner-facing copy never says "adapter" (`skills/blog-setup/SKILL.md` Phase 5, "Owner's name for this part").
- Every setup question keeps its `Quick path: <ask|derive|omit|action>. <rule>` disposition line (Global rule 10, "Dispositions").
- Files mode is exactly: `adapter: markdown`, `platform` ∈ {`generic`, `ghost`, `jekyll`}, `content_dir: blog-ops/posts`, `assets_dir: blog-ops/posts/images`, no `image_url_prefix`, no `site_live`, no `cover_key`/`frontmatter_keys`/`draft_key`.
- The beta platforms, named in copy: WordPress (as drafts you publish), Astro, Hugo, Next.js, Eleventy.
- "Beta" is a label only: no warning screen, no extra confirmation.
- Existing configs naming `astro-git-pr`, `wordpress-rest` or a markdown repo platform are kept on re-run; nothing is downgraded.
- Version: `.claude-plugin/plugin.json` 0.59.1 → **0.60.0**, plus a Changelog entry at the top of `README.md`'s Changelog (repo CLAUDE.md).
- `./tests/lint.sh` prints `LINT OK` at the end of every task.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Prose wraps: the guard compares with newlines and runs of spaces collapsed, so line breaks never matter.

## Review Focus

1. **Re-running setup on an existing WordPress or Astro blog** must keep its publishing choice on "keep as-is" and on the quick path's silent keep. Expected: no question about files, config unchanged. Pinned in Task 5 (guard phrase) and Task 9 (scenario).
2. **A Jekyll repository on the quick path** must get both the `jekyll` format and the ignore-line offer, without a format question. Pinned in Task 4 and Task 9.
3. **A registered blog (Pilcrino app) on `generic`** must not have its `content-plan.md` edited by the published-on-merge continuation (the app rewrites it from its post list). Expected: continuation runs Step 16.5's standalone-only parts only for standalone blogs. Pinned in Task 7 (guard phrase).
4. **An older `generic` blog with `content_dir: posts`** choosing "update" must keep `posts/`, so inbound-link greps still find old posts. Pinned in Task 5.
5. **Setup interrupted right after "Files in a pull request" was chosen** (block written, ignore step not yet run). Expected: the resumed run still offers the ignore step, because it runs outside Phase 5's resume gate. Pinned in Task 4 (guard phrase) and Task 9.

---

### Task 1: Guard script and validator fixture

**Files:**
- Create: `tests/check_files_default.sh`
- Modify: `tests/lint.sh` (new step 16, before the final `LINT OK` line)
- Modify: `skills/blog-setup/scripts/validate-config.test.mjs` (new fixture `FILES`, new test after the Hugo test at line ~140)

**Interfaces:**
- Produces: `tests/check_files_default.sh` with helpers `has_phrase <file> <phrase>` (collapsed whitespace, `grep -qF`) and `lacks_phrase <file> <phrase>`, a `say` that sets `fail=1` with the prefix `FILES DEFAULT FAIL:`, and one commented block per task (`# Task 2` … `# Task 8`) where later tasks append their assertions. Exit 1 on any failure.

- [ ] **Step 1: Write the validator test**

```js
const FILES = `${BLOG}
images:
  enabled: [ai-prompt]

publish:
  adapter: markdown
  markdown:
    content_dir: blog-ops/posts
    assets_dir: blog-ops/posts/images
    platform: generic
    frontmatter_template: adapters/publish/frontmatter/markdown-generic.md

git:
  branch_prefix: blog/
  base_branch: main

console:
  publish_policy: gated

research:
`

test('a files-mode config (generic, blog-ops/posts, no site_live) passes all 16 checks', () => {
  const r = run(repo(FILES, { remotion: false, gitattributes: null }))
  assert.equal(r.status, 0, r.out + r.err)
  assert.match(r.out, /All 16 checks pass/)
})
```

- [ ] **Step 2: Run it.** `node --test skills/blog-setup/scripts/validate-config.test.mjs`. Expected: PASS straight away (the spec says the validator already accepts this shape; the test pins it). If it fails, stop: the spec's premise is wrong and the plan needs revisiting.

- [ ] **Step 3: Create `tests/check_files_default.sh`** with the helpers above and empty task blocks. Header comment names the spec path. Make it executable.

- [ ] **Step 4: Wire it into `tests/lint.sh`** as step 16, matching steps 12 and 14: run it when present, else `err "tests/check_files_default.sh missing"`.

- [ ] **Step 5: Run `./tests/lint.sh`.** Expected: `LINT OK`.

- [ ] **Step 6: Commit** `test: files-default guard script and files-mode validator fixture`.

### Task 2: Setup says up front that GitHub is required

**Files:**
- Modify: `skills/blog-setup/SKILL.md` Phase 0 opening (line ~320-323), 0a check 4 (line ~475), 0b answer 3 (line ~566)
- Modify: `tests/check_files_default.sh` (`# Task 2`)

- [ ] **Step 1: Add guard assertions** on `skills/blog-setup/SKILL.md`: `has_phrase` for `you need a GitHub account (a free one works)`, `https://github.com/signup`, and `As I said at the start, Pilcrino needs a GitHub repository for this blog`.
- [ ] **Step 2: Run `bash tests/check_files_default.sh`.** Expected: FAIL with those three lines.
- [ ] **Step 3: Edit the three places** per spec §"Also in this change". Opening sentence, in substance: "Pilcrino keeps your posts and its settings in a GitHub repository, and opens every post as a pull request for you to review. So you need a GitHub account (a free one works), and this Mac needs git and GitHub's command line tool; I'll install those with you if they're missing. Before any questions, I'll check this Mac, then find your blog." (Global rule 9's "this computer" on Windows and Linux.) Check 4: before the device-code message, once: "No GitHub account yet? Create one at https://github.com/signup, then come back here." 0b answer 3: the reason sentence opens "As I said at the start, Pilcrino needs a GitHub repository for this blog".
- [ ] **Step 4: Run `./tests/lint.sh`.** Expected: `LINT OK`.
- [ ] **Step 5: Commit** `setup: say before the first check that GitHub is required`.

### Task 3: Phase 5 opens with files or beta

**Files:**
- Modify: `skills/blog-setup/SKILL.md` Phase 5: the intro (line ~2053-2095), "Interview: how the site goes live" and "Interview: adapter choice" (line ~2096-2185), the `publish:` YAML block under "git: block" (line ~2820)
- Modify: `tests/check_files_default.sh` (`# Task 3`)

**Interfaces:**
- Produces: a new subsection `### Interview: where your posts go (every blog)` placed right after the Phase 5 intro, and a subsection `### If files` after it. Tasks 4 and 5 refer to both by these exact headings. The existing subsections from "Interview: how the site goes live" onward become the beta branch, introduced by one sentence: "Beta chosen: everything from here to the `git:` block."

- [ ] **Step 1: Add guard assertions** on the setup skill:
  - `has_phrase`: `### Interview: where your posts go (every blog)`, `### If files`, `Files in a pull request (recommended)`, `Publish to my site (beta)`, `WordPress (as drafts you publish), or a site built from this repository with Astro, Hugo, Next.js or Eleventy`, `content_dir: blog-ops/posts`, `assets_dir: blog-ops/posts/images`, `Not sure, keep it plain`, `Your site won't show these posts; merging only files them in`, `Every post now waits for your approval.`
  - `lacks_phrase`, for the old Jekyll/Ghost beta route: `Webflow, Squarespace, Ghost or another hosted CMS → \`markdown\` with \`generic\``.
- [ ] **Step 2: Run the guard.** Expected: FAIL on each.
- [ ] **Step 3: Write "Interview: where your posts go (every blog)"** per spec §"Phase 5 opens with one question": the two-option menu, `Quick path: ask, both paths.`, today's detection run first to set option 2's label ("Publish to your Astro site (beta)", "Create drafts in your WordPress (beta)"), the general label when nothing supported is detected, so the menu always has two options. A detected label picks that adapter and skips today's adapter-choice confirm. The general label asks today's adapter menu limited to `astro-git-pr`, `wordpress-rest` and markdown with `hugo`/`nextjs`/`eleventy`, counted.
- [ ] **Step 4: Write "If files"** per spec §"Files chosen": write the block (Global constraint shape), the folder line ("Posts go in `blog-ops/posts/`, with their images in `blog-ops/posts/images/`"), `mkdir -p` as an action, the format question (detailed: ask, counted, "Not sure, keep it plain" first, then Ghost, then Jekyll; quick: derive `jekyll` from Task 4's Jekyll test, else `generic`, never `ghost`), the site-repo sentence, `console.publish_policy: auto` → `gated` with "Every post now waits for your approval.", and what is skipped (live-site question, sub-flows, site conventions, the `jq` check). Then "Continue at the `git:` block."
- [ ] **Step 5: Trim the beta branch.** In "Interview: adapter choice" remove the Jekyll, Ghost, Webflow/Squarespace/hosted-CMS routes and the "Markdown, paste platform" option text; in "how the site goes live" drop the paste-platform sentence. Leave every other beta line as it is.
- [ ] **Step 6: Update the `publish:` YAML block** comment under `markdown:` to show the files-mode values as one of the shapes.
- [ ] **Step 7: Run `./tests/lint.sh`.** Expected: `LINT OK`.
- [ ] **Step 8: Commit** `setup: posts are files in a pull request by default; site publishing is beta`.

### Task 4: Keep `blog-ops/` out of Jekyll and Eleventy builds

**Files:**
- Modify: `skills/blog-setup/SKILL.md`: new subsection `### Keep Pilcrino's files off the site (every blog)` right after "If files"; the adapter-choice detection line naming `.eleventy.js` (line ~2162); Global rule 3's "pending required sub-flow" exception area in the Phase 5 intro (line ~2080)
- Modify: `tests/check_files_default.sh` (`# Task 4`)

- [ ] **Step 1: Add guard assertions:** `has_phrase` for `### Keep Pilcrino's files off the site (every blog)`, `eleventy.config.mjs`, `eleventy.config.cjs`, `@11ty/eleventy`, `.eleventyignore`, `build_type: legacy`, `.nojekyll`, `Your site publishes every file in the repository it is not told to skip`, `Then merged posts will also appear on your site at an address under /blog-ops/.`, `runs outside Phase 5's resume gate`.
- [ ] **Step 2: Run the guard.** Expected: FAIL.
- [ ] **Step 3: Write the subsection** per spec §"Keeping `blog-ops/` out of Jekyll and Eleventy builds":
  - the Jekyll test (`_config.yml`, or Pages `build_type: legacy` with no `.nojekyll`) and the Eleventy test (any of the four config names or the dependency; input folder from `dir.input` or a `--input` script flag, default `.`)
  - the edit: `exclude` in `_config.yml`, creating it for a Pages site that has none; `.eleventyignore`
  - the consent sentence, with `Quick path: action, both paths.`
  - the decline line, recorded in `setup-notes.md` as `Site ignore line: declined <date>`, and not asked again while that line exists
  - the edited file goes into Global rule 2's site-files handling, so Phase 6 commits it and lists it under `## Site files edited by setup`
  - the builder checks the spec names for Jekyll `exclude` semantics and `.eleventyignore` vs `.gitignore`: do them now, and write the result into the subsection as the rule
- [ ] **Step 4: Widen the adapter-choice Eleventy detection** to the same four names plus the dependency.
- [ ] **Step 5: Add the resume exception.** In the Phase 5 intro, next to the site-conventions "Even on keep as-is" paragraph, one paragraph: the ignore step runs outside Phase 5's resume gate whenever the repository matches and neither the ignore line nor a recorded decline exists, on both paths, including the quick path's silent keep.
- [ ] **Step 6: Run `./tests/lint.sh`.** Expected: `LINT OK`.
- [ ] **Step 7: Commit** `setup: keep blog-ops out of Jekyll and Eleventy builds`.

### Task 5: Re-runs, counting and the skill description

**Files:**
- Modify: `skills/blog-setup/SKILL.md`: frontmatter `description` (line 3); Global rule 10 (line ~248-307); 0d (line ~659-678); the Phase 5 resume check (line ~2058-2090); §Counting the detailed path (line ~3349-3370)
- Modify: `tests/check_files_default.sh` (`# Task 5`)

- [ ] **Step 1: Add guard assertions:**
  - `has_phrase`: `Your setup is complete. What would you like to change?`, `| files | 50 |`, `Posts are files in \`blog-ops/posts/\``, `Posts go to your WordPress as drafts (beta)`, `keeps its folders, on "keep as-is" and on "update" alike`.
  - The frontmatter description, with `has_phrase` on the file's line 3, contains `by default` and `(beta)`.
- [ ] **Step 2: Run the guard.** Expected: FAIL.
- [ ] **Step 3: 0d.** When `Path: quick` and every phase already has its files, ask the menu "Your setup is complete. What would you like to change?": "Where your posts go" / "Go through everything" / "Nothing, just check it". "Where your posts go" runs Phase 5 as "update", then Phase 6's validation and commit. "Go through everything" runs the detailed path's per-phase menus. "Nothing" runs Phase 6's validator only. An interrupted quick setup resumes as today.
- [ ] **Step 4: Phase 5 resume check.** Describe the kept config in owner words (the two guard phrases, plus Astro and the other beta platforms in the same pattern). "Keep as-is" keeps any adapter. "Update" asks "Where your posts go" again. An existing `generic`/`ghost`/`jekyll` blog keeps its folders on "keep as-is" and on "update" alike; only a fresh setup or "start over" writes `blog-ops/posts`.
- [ ] **Step 5: Counting.**
  - Global rule 10: the quick path's "where posts go" stays one of the ten. Beta with a detected label adds nothing. The general label's adapter menu is a conditional (+1). The format question is never asked on the quick path.
  - §Counting the detailed path: add the row `| files | 50 | as above with publishing 2 (where posts go, format) |`. Note under the table that beta rows are unchanged when the label named the detected site, +1 otherwise.
- [ ] **Step 6: Rewrite the frontmatter `description`** so it says posts are markdown files with images in a pull request by default, and that fitting the site, the WordPress keychain and the auth probe are the beta path ("(beta)"). It must stay valid YAML (lint step 9).
- [ ] **Step 7: Run `./tests/lint.sh`.** Expected: `LINT OK`.
- [ ] **Step 8: Commit** `setup: re-runs can change where posts go; counts and description for files mode`.

### Task 6: The markdown adapter's `generic` wording

**Files:**
- Modify: `adapters/publish/markdown.md`: intro (line ~5), §Platform groups (line ~31-38), §Staging step 6 (line ~66-80), §On Gate 2 approval (line ~91), §Action-items §7 paste platform (line ~120-128)
- Modify: `adapters/publish/frontmatter/markdown-generic.md` line 3
- Modify: `tests/check_files_default.sh` (`# Task 6`)

- [ ] **Step 1: Add guard assertions:**
  - `lacks_phrase` on `markdown-generic.md`: `the owner pastes the post in before approving`.
  - `has_phrase` on `markdown.md`: `Your post is the file`, `the title, description, date, tags and cover are at the top of the file`, `If you publish the post somewhere, copy the file and its pictures there.`, `Files mode`.
- [ ] **Step 2: Run the guard.** Expected: FAIL.
- [ ] **Step 3: Edit `markdown.md`.**
  - Platform groups: add one paragraph naming files mode (`generic`/`ghost`/`jekyll` in `blog-ops/posts/`, written by setup's "If files") and saying why it stays on paste platforms.
  - Staging step 6: `generic` gets the spec's banner text verbatim (§"Workflow and adapter wording"); `ghost` and `jekyll` keep today's field-by-field text.
  - On Gate 2 approval: the `generic` sentence becomes "merging it files the post in your repository", with no "pasted" clause; `ghost` and `jekyll` unchanged.
  - §7: `generic` gets "If you publish the post somewhere, copy the file and its pictures there." in place of the paste item, and the last item follows Task 7's published-on-merge rule (no "Once <Platform> shows the post").
  - §4b: decide the `generic` wording, consistent with the banner (the spec leaves this to you), and write it.
- [ ] **Step 4: Edit `markdown-generic.md` line 3** so it no longer says the owner pastes before approving, e.g. "Files mode: the merge files the post; the owner may copy it to a platform afterwards."
- [ ] **Step 5: Run `./tests/lint.sh`.** Expected: `LINT OK` (step 15, `check_markdown_frontmatter.py`, must still pass).
- [ ] **Step 6: Commit** `markdown adapter: generic posts need no platform`.

### Task 7: The workflow: `generic` wording and published on merge

**Files:**
- Modify: `skills/blog-post-workflow/SKILL.md` around lines 1204, 1267, 1273, 1283, 1295 and 1317, Step 15.6, and Step 16.5's intro
- Modify: `skills/blog-post-workflow/references/pr-monitor.md` (the merged path in §Each firing step 5)
- Modify: `skills/blog-post-workflow/references/config-schema.md`: a new example config `### Example: files mode (default)`, YAML that `check_yaml_blocks.py` parses
- Modify: `tests/check_files_default.sh` (`# Task 7`)

- [ ] **Step 1: Add guard assertions:**
  - `has_phrase` on the workflow SKILL.md: `The post is merged and filed in \`blog-ops/posts/<slug>.md\`.`, `After you merge, run /pilcrino:blog-post-workflow published <slug> and I'll mark it published in your content plan.`, `for \`generic\`, the merge is the publish`, `standalone blogs only` within the continuation sentence (Review Focus 3).
  - `has_phrase` on config-schema.md: `### Example: files mode (default)`.
  - Builder: grep the workflow SKILL.md for `paste`, `pasted` and `<Platform> has it`, and add a `lacks_phrase` for each `generic`-specific paste prerequisite you remove.
- [ ] **Step 2: Run the guard.** Expected: FAIL.
- [ ] **Step 3: Wording.** At each listed line, split paste platforms into `generic` vs `ghost`/`jekyll` per spec §"Workflow and adapter wording". `generic`: "Merging files the post in your repository.", no paste clause, and line 1295's "Publish it" rule treats `generic` like a repo merge request. `ghost`/`jekyll`: unchanged.
- [ ] **Step 4: Published on merge** per spec §"When a files post counts as published":
  - the closing message at line ~1283
  - the approval-report line at ~1267 for an owner who merges with nothing watching
  - one rule, stated once (in Step 15.5's "Merged" paragraph) and referenced from Step 15.6, the resume row that finds the PR merged, and `pr-monitor.md`'s merged path. The rule: when this session sees a `generic` merge on a standalone blog, continue straight into Step 16.5 (merge-date check, plan row, commit, cleanup offer); a registered blog changes nothing, because the app marks it published.
- [ ] **Step 5: Add the config-schema example** (the Task 1 `FILES` block's `publish:`/`git:`/`console:` part, with a one-line lead saying it is what setup writes by default).
- [ ] **Step 6: Run `./tests/lint.sh`.** Expected: `LINT OK` (step 5 parses the new YAML).
- [ ] **Step 7: Commit** `workflow: generic posts are published on merge, with no paste step`.

### Task 8: README, version and changelog

**Files:**
- Modify: `README.md`: intro bullets (line ~28-29), the "It works with…" paragraph (line ~46-51), "What you need" (line ~144), Quickstart (line ~243), §Publish adapters (line ~586-602), FAQ sentences promising the merge publishes, Changelog top
- Modify: `.claude-plugin/plugin.json` (`version`)
- Modify: `tests/check_files_default.sh` (`# Task 8`)

- [ ] **Step 1: Add guard assertions:** `grep -q '"version": "0.60.0"' .claude-plugin/plugin.json`. `has_phrase` on README for `### 0.60.0 - `, `a markdown file and its images`, `(beta)`, `GitHub account`.
- [ ] **Step 2: Run the guard.** Expected: FAIL.
- [ ] **Step 3: Edit README** per spec §README: lead with the default; name WordPress, Astro, Hugo, Next.js and Eleventy publishing as beta; give §Publish adapters a short files-mode paragraph and put the existing table under a beta heading; make "What you need"'s first line say a GitHub account is required, and say it once in Quickstart. Changelog entry `### 0.60.0 - Posts are files by default; site publishing is beta`, with 3 to 5 lines covering files mode, the beta label, the Jekyll/Eleventy ignore line, the GitHub-required opening and published on merge.
- [ ] **Step 4: Bump `version` to `0.60.0`.**
- [ ] **Step 5: Run `./tests/lint.sh`.** Expected: `LINT OK`.
- [ ] **Step 6: Commit** `docs: README for files by default (0.60.0)`.

### Task 9: Verification before the release tag (manual)

No code. Every result is recorded in a section appended to lucky72o/slavhurmanau#84 (edit the body, new heading "Files default, 0.60.0"). Never open a new issue. Fix blockers and serious findings only.

- [ ] **Step 1: Jekyll and Eleventy builds.** In a scratch folder, make a minimal Jekyll site and a minimal Eleventy site (root input, no config file). Add `blog-ops/config.yaml` and a files-mode `blog-ops/posts/x.md` with `blog-ops/posts/images/x/featured.png`, and apply the ignore line exactly as Task 4's subsection says. Build each (`bundle exec jekyll build`, `npx @11ty/eleventy`). Expected: the build succeeds and `find _site -path '*blog-ops*'` is empty. Also build each once without the ignore line, to confirm the hazard is real (`blog-ops` appears). If Ruby or Jekyll can't be installed on the host, run the Jekyll build inside the VM in Step 3 and say so.
- [ ] **Step 2: Setup scenarios**, each checked against the resulting `blog-ops/config.yaml` and `./skills/blog-setup/scripts/validate-config.mjs`:
  - (a) detailed path taking every default
  - (b) a completed quick setup re-run choosing "Where your posts go", switching to beta and back
  - (c) quick setup interrupted right after choosing files, then resumed: the ignore step is offered (Review Focus 5)
  - (d) declining the ignore line, then a re-run that does not ask again
  - (e) an Astro config with `console.publish_policy: auto` updated to files: `gated`, validator passes
  - (f) a WordPress config re-run on the quick path: kept, no files question (Review Focus 1)
  - (g) a `generic` config with `content_dir: posts`, "update": folders kept (Review Focus 4)
- [ ] **Step 3: Fresh-OS runs** per the app repository's `docs/testing/fresh-mac/methodology.md`:
  - Clone `prereqs-signed` (`tart list` shows it), update the plugin to this branch's release, and pin the VM's Claude Code to Opus (`"model": "claude-opus-5-5"`); check the header.
  - Run 1, quick path, no repository: the default through one post to merge. Check: one publishing question, files in `blog-ops/posts/`, the banner and closing wording, the plan row `published` on merge.
  - Run 2, quick path on an Astro repository: the beta label names Astro, the default is still files, the "won't show these posts" line.
  - Run 3: a completed quick re-run choosing "Where your posts go".
  - Run 4, from `pilcrino-base` (nothing installed): Phase 0's opening names the GitHub account, git and the GitHub tool before the first check.
- [ ] **Step 4: Open the pull request** after `./tests/lint.sh` passes. The body links the spec, this plan and the #84 section, and ends with the attribution line. The tag `v0.60.0` and the app re-pin come after the merge, and only when Steps 1 to 3 show no open blocker.
