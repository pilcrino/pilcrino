# Retro targets custom instructions only: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `blog-retro` stops suggesting edits to plugin files and to blog-ops files other than `custom-instructions.md`. Each finding becomes a standing instruction the owner can add to `{profile_dir}/custom-instructions.md`. The retro adds the ones the owner picks. A problem no instruction can fix is offered as an issue on the public Pilcrino repository.

**Architecture:** The plugin is markdown read by Claude, so behaviour changes are text changes, pinned by `need`/`absent` anchors in `tests/check_page_anatomy.sh` and one new invariant in `tests/lint.sh`. Before the retro routes findings into `custom-instructions.md`, every subagent the workflow spawns must actually read that file. Today four do not.

**Tech Stack:** Markdown skill and agent docs, bash checks, `gh`.

**Spec:** the decisions below (agreed 2026-10-30). The trigger: a retro told a blog owner to edit plugin files, which an owner cannot do.

## Decisions (the spec)

1. The retro writes every finding as one of three kinds:
   - **Instruction** (the default): a standing instruction in the owner's plain words, ready to add to `custom-instructions.md`, plus the stage it affects (research, plan, draft, review, humanize, images, publish).
   - **Setting**: the fix is a `config.yaml` value. Say in one plain sentence what to change, or that re-running `/pilcrino:blog-setup` changes it. The retro never edits config.
   - **Pilcrino problem**: no instruction can fix or work around it (a crash, a stage that ignores its own rules, a wrong file written). Carry a workaround instruction when one exists. Offer to report it on https://github.com/pilcrino/pilcrino/issues.
2. No finding names a `${CLAUDE_PLUGIN_ROOT}` path, a persona, an agent, a standard, a template or an adapter as something to edit, and no finding targets `voice.md`, `config.yaml` or a template override as an edit. The two-bucket model is removed.
3. After the list, the retro asks which instructions to add (numbers, `all` or `none`). On a pick it appends them to `{profile_dir}/custom-instructions.md` under `## From the retro on <slug>, <YYYY-MM-DD>`, creating the file with a `# Custom instructions` heading when it is missing. It skips an instruction the file already states, in any wording, and names what it skipped. Then it shows the lines it added.
4. **Which copy it writes.** The retro may run in the post's worktree (console runs use cwd = the post's worktree, `references/console-contract.md`), and an edit there is lost when that worktree goes. So the target is the base-branch checkout: `git worktree list --porcelain`, the entry whose `branch` is `refs/heads/{git.base_branch}`; call its path `<base>`. Only the work on `custom-instructions.md` runs against `<base>` (`git -C <base>`): reading it, deduplicating, appending, committing and pushing. Everything else stays where it is today: slug discovery, the post's drafts or archive, `pr-monitor.json` and any post-specific git inspection read from the checkout the retro was invoked in (the evidence root), because before merge they exist only on the post's branch. Plugin files still come from `${CLAUDE_PLUGIN_ROOT}`. When no checkout has `{git.base_branch}` checked out, write nothing: show the picked lines and tell the owner to run the retro again from the blog's main folder.
5. **Saving to GitHub.** Before appending, `git -C <base> status --porcelain -- {profile_dir}/custom-instructions.md`. Clean: append, then `git -C <base> commit -m "chore(pilcrino): custom instructions from the <slug> retro" -- {profile_dir}/custom-instructions.md` (add the file first when it is new), then `git -C <base> push origin {git.base_branch}`. Push without asking only under `git.push_without_asking: true`; always ask first when `git -C <base> log origin/{git.base_branch}..{git.base_branch}` shows another unpushed commit (the push would carry it). **The file already has the owner's own unsaved changes:** append, do not commit, and say the file has changes of theirs that a save would publish with the new lines; commit and push only on an explicit yes, even under `git.push_without_asking`. Never discard or reset the owner's changes. Whenever the lines are not pushed, say plainly that console runs and other checkouts see them only once they are on GitHub.
6. Pilcrino problem reports go to `pilcrino/pilcrino`, never the blog's repo. The retro drafts the title and body: what happened, at which stage, what the owner expected, the plugin version from `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`, and optionally a "likely source" plugin file for the maintainer. No draft text, no facts or research, no private URLs, no keys. It shows the draft and files it with `gh issue create -R pilcrino/pilcrino` only on an explicit yes. With no `gh` sign-in, or when filing fails, it gives the `https://github.com/pilcrino/pilcrino/issues/new?title=...&body=...` link (URL-encoded) instead.
7. The only file the retro ever writes is `{profile_dir}/custom-instructions.md` in `<base>`. Its `allowed-tools` gains `Edit, Write`.
8. An instruction must reach the stage it is for, in the workflow and when that stage's skill runs on its own. So the four workflow agents that skip the file (blog-researcher, plan-reviewer, image-planner, image-builder) and the four skills that are also run standalone (review-blog-post, humanize-text, suggest-images, generate-images) load it as an optional input. A finding about a stage that still ignores the file is a Pilcrino problem, not an instruction.

## Global Constraints

- No em dash (U+2014) or en dash used as a sentence break anywhere: docs, copy, commit messages.
- No names from the lint check 3 pattern in content dirs (`tests/lint.sh` check 3).
- Work only in this worktree, branch `fix/retro-custom-instructions`, based on `origin/main` (0.59.2).
- Version `0.61.0` in `.claude-plugin/plugin.json` with a README changelog entry at the top. `0.60.0` is taken by the unmerged `feat/files-default`; whichever merges second fixes up the order.
- `./tests/lint.sh` prints `LINT OK` before each commit.

## Review Focus

1. The owner answers `none`, or nothing: the retro writes no file and commits nothing.
2. `custom-instructions.md` is missing: the retro creates it with a `# Custom instructions` heading and leaves no placeholders.
3. A picked instruction is already in the file in other words: it is skipped and named, not appended twice.
4. The retro runs in the post's worktree: it writes to the base-branch checkout, never the post's worktree; with no base-branch checkout it writes nothing (Decision 4).
5. `custom-instructions.md` already has uncommitted edits by the owner: they are kept and never committed or pushed without an explicit yes (Decision 5).
6. A Pilcrino problem report could leak the draft or private details into a public issue: the body is restricted (Decision 6) and is shown before anything is filed.

Each line is pinned by an anchor in Task 2.

---

### Task 1: Every stage reads custom instructions

**Files:**
- Modify: `tests/lint.sh` (new check 16, before the final `LINT OK` line)
- Modify: `agents/blog-researcher.md` (§Important: you run in a subagent context, the input sentence)
- Modify: `agents/plan-reviewer.md` (§Inputs list)
- Modify: `agents/image-planner.md` (§You run in a subagent context, the input sentence)
- Modify: `agents/image-builder.md` (§Inputs)
- Modify: `skills/blog-post-workflow/SKILL.md` Step 7.1 (the plan-reviewer dispatch path list)
- Modify: `skills/review-blog-post/SKILL.md` Step 1.3 (required inputs list), `skills/humanize-text/SKILL.md` §Tool access `Read` line, `skills/suggest-images/SKILL.md` (the profile docs list near line 41), `skills/generate-images/SKILL.md` (the config preamble near line 15)

**Interfaces:**
- Produces: the phrase `{profile_dir}/custom-instructions.md` (optional; honor when present) in every `agents/*.md` and in the four skills above. Task 2's retro relies on this to say an instruction reaches every stage (Decision 8).

- [ ] **Step 1: Add lint check 16**

```bash
# 16. Every subagent, and every skill a subagent runs, reads the blog's custom instructions (the workflow's Step 0.5 promises it)
for f in agents/*.md skills/review-blog-post/SKILL.md skills/humanize-text/SKILL.md skills/suggest-images/SKILL.md skills/generate-images/SKILL.md; do
  grep -qF '{profile_dir}/custom-instructions.md' "$f" || err "$f: does not read {profile_dir}/custom-instructions.md"
done
```

- [ ] **Step 2: Run it and see it fail**

Run: `./tests/lint.sh`
Expected: eight `LINT FAIL` lines: blog-researcher, plan-reviewer, image-planner, image-builder, review-blog-post, humanize-text, suggest-images, generate-images.

- [ ] **Step 3: Add the input to the four agents and four skills**

Use the wording the other three agents use: `{profile_dir}/custom-instructions.md` (optional; honor when present), standing per-blog instructions that outrank this agent's own defaults. In `plan-reviewer.md` it is a list item in §Inputs. In the other three it is added to the existing input sentence or list. In Step 7.1 of the workflow, add `{profile_dir}/custom-instructions.md` when present to the dispatch paths. In each skill it is an optional input (missing is not a failure) ranked below the user's live instructions and above the skill's standards defaults, the same precedence as workflow Step 0.5.

- [ ] **Step 4: Run lint**

Run: `./tests/lint.sh`
Expected: `LINT OK`

- [ ] **Step 5: Commit**

```bash
git add tests/lint.sh agents/ skills/blog-post-workflow/SKILL.md skills/review-blog-post/SKILL.md skills/humanize-text/SKILL.md skills/suggest-images/SKILL.md skills/generate-images/SKILL.md
git commit -m "agents and skills: every stage reads the blog's custom instructions"
```

### Task 2: Rewrite blog-retro

**Files:**
- Modify: `skills/blog-retro/SKILL.md` (frontmatter description and allowed-tools, opening paragraph, replace §The two-bucket model, Step 3, Step 4, add Step 5 and Step 6, Hard rules, What this skill does NOT do)
- Modify: `tests/check_page_anatomy.sh` (a `# Retro: custom instructions only` block before the final line)

**Interfaces:**
- Consumes: Task 1's guarantee that every stage reads `custom-instructions.md`.
- Produces: the retro behaviour in Decisions 1 to 8. Task 3 describes it in one line.

- [ ] **Step 1: Add the anchors**

```bash
# Retro: custom instructions only (plan 2026-10-30-retro-custom-instructions)
R=skills/blog-retro/SKILL.md
absent $R 'Shared-skill findings'
absent $R 'two-bucket'
absent $R '${CLAUDE_PLUGIN_ROOT}/personas/{editor,writer,repurposer}.md'
need $R '## Instructions to add'
need $R '**Setting:**'
need $R '**Pilcrino problem:**'
need $R 'github.com/pilcrino/pilcrino/issues'
need $R 'gh issue create -R pilcrino/pilcrino'
need $R 'No draft text'
need $R '## From the retro on <slug>, <YYYY-MM-DD>'
need $R '# Custom instructions'
need $R 'already states'
need $R 'On `none`, or no answer, write nothing'
need $R 'chore(pilcrino): custom instructions from the <slug> retro'
need $R 'git worktree list --porcelain'
need $R 'refs/heads/{git.base_branch}'
need $R 'Only the work on `custom-instructions.md` runs against `<base>`'
need $R 'the checkout the retro was invoked in (the evidence root)'
need $R 'run the retro again from the blog'
need $R 'changes of theirs that a save would publish'
need $R 'see them only once they are on GitHub'
absent $R 'the next post run'
need $R 'allowed-tools: Read, Glob, Grep, Bash, Edit, Write'
```

- [ ] **Step 2: Run it and see it fail**

Run: `bash tests/check_page_anatomy.sh`
Expected: `ANATOMY FAIL` lines for each `need` anchor, and for the three `absent` anchors whose strings are still there (`'the next post run'` already passes).

- [ ] **Step 3: Rewrite the skill**

- Replace §The two-bucket model with §Where findings go: why plugin files are out of reach for a blog owner, the three kinds (Decision 1), and the precedence that makes an instruction win over persona and standards defaults (cite workflow Step 0.5).
- Step 2 (gather signals) stays. Step 3 still finds the root cause by reading the stage's files. The cause decides the kind and the wording, but the file path never appears in the output.
- Step 4 output: one section `## Instructions to add`, numbered. Each entry has **What happened:**, **Add:** (the instruction, quoted, in second person to the workflow, for example "Never open a post with a question."), and **Affects:** (the stage). A Setting entry has **Setting:** instead of **Add:**, and a Pilcrino problem entry has **Pilcrino problem:** with an optional **Workaround to add:**. "No changes suggested, the run was clean" stays.
- New Step 5, Add what the owner picks: Decisions 3, 4 and 5, including the exact anchor sentence `On \`none\`, or no answer, write nothing and commit nothing.`
- New Step 6, Report a Pilcrino problem: Decision 6.
- Step 3 classifies a finding about a stage that does not load the file as a Pilcrino problem (Decision 8).
- Hard rules: the retro writes only `{profile_dir}/custom-instructions.md`, and only after the owner picks. Never a plugin file, never `config.yaml`, never another profile doc. It files an issue only on an explicit yes.
- The frontmatter description drops the two-bucket wording and says the retro suggests standing instructions, adds the ones the owner picks, and offers to report Pilcrino problems.

- [ ] **Step 4: Run both checks**

Run: `bash tests/check_page_anatomy.sh && ./tests/lint.sh`
Expected: `ANATOMY OK` then `LINT OK`

- [ ] **Step 5: Commit**

```bash
git add skills/blog-retro/SKILL.md tests/check_page_anatomy.sh
git commit -m "blog-retro: findings become custom instructions, Pilcrino problems become issues"
```

### Task 3: Copy that describes the retro, version, changelog

**Files:**
- Modify: `personas/editor.md:468` (Gate 2 banner retro line, "suggestions only; nothing auto-applied")
- Modify: `README.md:560` (skills table row) and the Changelog
- Modify: `.claude-plugin/plugin.json` (`version`)
- Modify: `tests/check_page_anatomy.sh` (four more anchors, and the existing version pin at line 221)

- [ ] **Step 1: Add the anchors**

```bash
absent personas/editor.md 'suggestions only; nothing auto-applied'
need personas/editor.md 'adds the ones you pick to your custom instructions'
absent README.md 'suggests shared-skill and blog-local improvements'
need README.md '### 0.61.0 - The retro writes custom instructions'
```

Also change the existing pin `need .claude-plugin/plugin.json '"version": "0.59.2"'` (line 221) to `0.61.0`.

- [ ] **Step 2: Run it and see it fail**

Run: `bash tests/check_page_anatomy.sh`
Expected: five `ANATOMY FAIL` lines (three copy anchors, the changelog heading, the version pin).

- [ ] **Step 3: Edit the copy**

- Banner line: `After I finalize, run /pilcrino:blog-retro <slug> here for a retrospective: it suggests standing instructions for this blog and adds the ones you pick to your custom instructions.`
- README row: `Post-run retrospective; turns what went wrong into standing instructions in custom-instructions.md and offers to report Pilcrino problems.`
- Version `0.61.0`. Changelog entry `### 0.61.0 - The retro writes custom instructions` with three bullets: findings are instructions for `custom-instructions.md` and never plugin edits; the retro adds the picked ones and saves them to GitHub; Pilcrino problems can be reported on the public issues board. A fourth bullet says the four subagents and four skills that ignored custom instructions now read them.

- [ ] **Step 4: Run both checks and the em dash scan**

Run: `bash tests/check_page_anatomy.sh && ./tests/lint.sh && ! git diff origin/main --unified=0 | grep -n "$(printf '\xe2\x80\x94')"`
Expected: `ANATOMY OK`, `LINT OK`, and no output from the grep.

- [ ] **Step 5: Commit**

```bash
git add personas/editor.md README.md .claude-plugin/plugin.json tests/check_page_anatomy.sh
git commit -m "docs: the retro writes custom instructions (0.61.0)"
```
