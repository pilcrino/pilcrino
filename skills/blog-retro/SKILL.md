---
name: blog-retro
description: Run a retrospective after a blog post is finished, analyze how the run actually went and turn what went wrong into standing instructions for this blog. Reads the working-session conversation (primary), the PR review + comment history via gh (the async-review friction record), and the slug's archived artifacts (review-iteration counts, verdicts, fallbacks, HARD-HALTs). Produces an in-chat, root-caused list where each finding is an instruction to add to this blog's custom instructions (blog-ops/profile/custom-instructions.md), a setting to change, or a Pilcrino problem no instruction can fix. Adds the instructions the owner picks and saves them to GitHub; offers to report Pilcrino problems on the public Pilcrino issues board. Never edits plugin files. Human-triggered only, never on a timer, standalone via /pilcrino:blog-retro <slug> in the working session after Gate 2. Not wired into blog-post-workflow.
argument-hint: "<slug>"
allowed-tools: Read, Glob, Grep, Bash, Edit, Write
---

# blog-retro

Standalone retrospective. Run AFTER a blog post is finished, in the working session where the post was produced, to mine that run for improvements. Every improvement lands in one place the blog owner controls: `{profile_dir}/custom-instructions.md`. The retro writes that file only after the owner picks what to add, and it never edits a skill, persona, template, adapter, post, `config.yaml`, or any other profile doc.

## When to invoke

- After Gate 2 approval + finalize for a post, in the SAME working session where the drafting happened (so the live conversation is available).
- Standalone: `/pilcrino:blog-retro <slug>`. No dependency on blog-post-workflow being mid-flight.
- Never on an automatic timer. This skill is only ever triggered by a person; see §Invocation for how.

## Invocation

There is exactly ONE way this skill runs, human-triggered: a human types `/pilcrino:blog-retro <slug>` in the working session where the post was produced. All three Step 2 sources are available, including the live conversation, the richest source of all.

## Why standalone (not a blog-post-workflow step)

On the default PR path, Gate 2 approval happens in the console. A human then triggers this skill deliberately in the working session where the post was produced; blog-post-workflow only nudges them to (Gate 2 banner + completion report).

## Where findings go

The person running a retro owns a blog, not this plugin. They cannot change the plugin's skills, personas, agents, standards, templates or adapters: those come from the plugin and are replaced on every update. What they do own is `{profile_dir}/custom-instructions.md`, standing per-blog instructions that every stage of the workflow loads and that outrank the plugin's persona and standards defaults (`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/SKILL.md` Step 0.5 sets the precedence: the user's live instructions > custom instructions > persona/standards defaults). So a fix the owner can make is almost always an instruction in that file.

Every finding is exactly one of three kinds:

- **Instruction** (the default). A standing instruction, in the owner's plain words, that prevents the problem next time, plus the stage it affects (research, plan, draft, review, humanize, images, publish). Tone drift, a banned phrase, a structure the owner wants, a fact the writer keeps getting wrong about the product, an image style rule: all instructions.
- **Setting.** The fix is a value in `blog-ops/config.yaml` (a module toggle, an images or publish setting). Say in one plain sentence what to change, or that re-running `/pilcrino:blog-setup` changes it. The retro never edits config.
- **Pilcrino problem.** No instruction can fix it: the plugin crashed, a stage ignored its own rules or the custom instructions, a wrong file was written, a step ran out of order. Carry a workaround instruction when one would help until the plugin is fixed, and offer to report it (Step 6).

A finding never names a plugin file (`${CLAUDE_PLUGIN_ROOT}/...`, a persona, an agent, a standard, a template, an adapter) as something to edit, and never targets `voice.md`, `config.yaml` or a template override as an edit. The root-cause work in Step 3 still reads those files; it decides the kind and the wording, not the output.

## Procedure

### Step 1, Resolve the slug

- If `<slug>` is given, use it.
- If omitted, infer the most recently finished slug: prefer one named in the current conversation; else `Glob: {drafts_dir}/_archive/*/checklist.md`, read frontmatter, pick the most recent `last_updated` with `status: complete`. State which slug you picked.
- Locate artifacts at `{drafts_dir}/_archive/<slug>/`. If the dir is missing, check `{drafts_dir}/<slug>/` (post not yet archived) and use whichever exists. If neither exists, stop and report.

These paths, and everything in Step 2, resolve from the checkout the retro was invoked in (the evidence root). Before merge the post's drafts, archive and `pr-monitor.json` exist only on the post's branch, so never look for them in another checkout.

### Step 2, Gather signals

Pull all THREE sources; each may be empty depending on the path the run took.

1. **Live conversation** (the primary source, always available: this skill only ever runs in the working session where the post was produced). Review THIS session's history for: where the human corrected you, re-explained, or overrode a decision; gate rejections (plan-review, blog-review) and their reasons; anything the workflow did wrong and had to redo; repeated friction.

2. **PR review feedback** (primary only when the PR monitor ran, `review.pr_monitor: true`, where the corrections happened on GitHub via the cron, NOT in this conversation; with the monitor off, the default, corrections happen in this conversation, so source 1 is primary and this one is reinforcement). Read `{drafts_dir}/_archive/<slug>/pr-monitor.json`. If it has `mode: pr` and a `pr_number`, fetch the human (non-bot) feedback bodies from all three channels (`<repo>` = the `repo` field):
   - Issue comments: `gh api repos/<repo>/issues/<pr_number>/comments --paginate`
   - Inline diff comments: `gh api repos/<repo>/pulls/<pr_number>/comments --paginate`
   - Review-summary bodies: `gh api repos/<repo>/pulls/<pr_number>/reviews --paginate`
   Use the full `/reviews` history, NOT `gh pr view --json latestReviews`: `latestReviews` keeps only each reviewer's latest review and would collapse away an earlier `CHANGES_REQUESTED` / `COMMENTED` summary the same reviewer later flipped to `APPROVED`, which is exactly the friction the retro wants. Filter out the bot's own replies and the CI preview comment (the marker configured in `publish.astro.preview_comment_marker`, when set, per `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md`). If there is no `pr-monitor.json`, skip this source.

3. **Durable artifacts** (reinforcement) under `{drafts_dir}/_archive/<slug>/`: the `checklist.md` Gate log + Stage transition log (timings, retries); `draft-v<N>` count (= blog-reviewer iterations); `plan-review-v<N>` count + verdicts; any logged residual concerns, HARD-HALTs, or failures (push/PR-create failures, `wp_upload: failed`) in checklist Notes; humanizer preservation flags.

### Step 3, Root-cause each friction point

For every distinct problem found, find why it happened before deciding what to suggest. Read the stage's own files (the workflow step, the persona, the agent, the standard or template it follows, and this blog's profile docs and `custom-instructions.md`) so the cause is real, not guessed. Then pick the kind (§Where findings go):

- The stage did what its rules say, and this blog wants something else, or something more specific: **Instruction**. Word it so it would have prevented this run's problem, and check it does not repeat or contradict what `custom-instructions.md` already says. When it contradicts an instruction already there, the **Add:** text itself must say so, so the resolution survives in the file: start it with `Replaces the earlier instruction "<the old text, quoted exactly>":` followed by the new rule. The file is append-only, so this is how the next run knows which of the two wins.
- The cause is a config value: **Setting**.
- The stage broke its own rules, ignored an instruction already in `custom-instructions.md`, or failed in a way no instruction can steer: **Pilcrino problem**. A finding about a stage that does not load `custom-instructions.md` at all is a Pilcrino problem too, because an instruction would never reach it.

If a symptom traces to something none of these covers (a one-off human typo, an external API outage), do not force it into a kind: note it as environmental in the wrap-up instead.

### Step 4, Present the retrospective in chat

One section, one numbered entry per finding:

```
## Instructions to add

1. **What happened:** what went wrong this run (cite the conversation moment, PR comment, or artifact).
   **Add:** "Never open a post with a question."
   **Affects:** draft

2. **What happened:** ...
   **Setting:** turn on <setting, in plain words>, or re-run /pilcrino:blog-setup and answer <question> with <answer>.

3. **What happened:** ...
   **Pilcrino problem:** what the plugin did wrong, in one plain sentence.
   **Workaround to add:** "..." (only when one helps)
   **Affects:** images
```

An **Add:** line is the exact text that will go into the file, quoted, written as a standing instruction to the workflow. Keep it one or two sentences. If nothing notable surfaced, say so plainly ("No changes suggested, the run was clean") rather than inventing nits, and skip Steps 5 and 6.

Then ask: "Which of these should I add to your custom instructions? Reply with the numbers, `all`, or `none`." Only **Add:** and **Workaround to add:** lines can be picked. When the list has a Pilcrino problem, also ask whether to report it (Step 6).

### Step 5, Add what the owner picks

On `none`, or no answer, write nothing and commit nothing.

1. **Find the copy to write.** Run `git worktree list --porcelain` and take the entry whose `branch` line is `refs/heads/{git.base_branch}`; call its `worktree` path `<base>`. Only the work on `custom-instructions.md` runs against `<base>` (`git -C <base> ...`, and the file at `<base>/{profile_dir}/custom-instructions.md`): reading it, deduplicating, appending, committing and pushing. When the retro runs inside the post's worktree, an edit there would be lost when that worktree is removed, which is why it never writes there. When no checkout has `{git.base_branch}` checked out, write nothing: show the picked lines and tell the owner to run the retro again from the blog's main folder.
2. **Check for the owner's own changes.** `git -C <base> status --porcelain -- {profile_dir}/custom-instructions.md`. Note whether it prints anything.
3. **Append.** When the file is missing, create it with a `# Custom instructions` heading. Append the picked lines under a new heading `## From the retro on <slug>, <YYYY-MM-DD>`, one `- ` bullet per instruction. Skip any instruction the file already states, in any wording, and name what you skipped. Never rewrite or remove anything already in the file. Show the owner the lines you added.
4. **Decide whether to save.**
   - **Step 2 printed nothing** (the file had no unsaved changes): with `git.push_without_asking: true` go straight to the save sequence; without it, ask "Save these to GitHub now?" and run it on a yes.
   - **Step 2 printed something** (the file already had the owner's own unsaved changes): say the file has changes of theirs that a save would publish together with the new lines, and run the save sequence only on an explicit yes, even under `git.push_without_asking`. Never discard, stash or reset the owner's changes.
   - No (or no answer): stop here. The lines stay in the file on this Mac.

   Both routes then run the same save sequence, in this order, stopping at the first step that fails:
   1. `git -C <base> add -- {profile_dir}/custom-instructions.md` (this path only, never a folder, never `-A`).
   2. `git -C <base> commit -m "chore(pilcrino): custom instructions from the <slug> retro" -- {profile_dir}/custom-instructions.md`.
   3. `git -C <base> fetch origin {git.base_branch}`, then `git -C <base> log --oneline origin/{git.base_branch}..{git.base_branch}`. When the fetch or the log fails, do not push. When the log lists any commit besides the one from step 2, the push would carry it too: name those commits and push only on an explicit yes for them, whatever `git.push_without_asking` says.
   4. `git -C <base> push origin {git.base_branch}`. A rejected push (the base branch moved on GitHub): leave the commit in place, say so, and tell the owner the lines are saved on this Mac but not on GitHub yet.

   Whenever the lines end up not pushed, say plainly that console runs and other checkouts see them only once they are on GitHub.

### Step 6, Report a Pilcrino problem

Pilcrino problems go to the public Pilcrino issues board, https://github.com/pilcrino/pilcrino/issues, never to the blog's own repository. For each one the owner wants reported:

1. Draft a title and body. The body holds: what happened, at which stage, what the owner expected instead, the plugin version (`version` in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`), and, when Step 3 found it, a "Likely source" line naming the plugin file and section, for the maintainer. No draft text, no facts or research, no private URLs, no keys, tokens or passwords, and nothing from the blog the owner has not published. The issue is public.
2. Show the owner the full title and body before anything is sent.
3. On an explicit yes, file it exactly as shown. The text can hold backticks, `$` and quotes, which a shell would run or change, so never put the drafted text inside a shell command. `Write` the title to `<tmp>/retro-issue-title.txt` and the body to `<tmp>/retro-issue-body.md` (`<tmp>` = a fresh `mktemp -d`), then run `gh issue create -R pilcrino/pilcrino --title "$(cat <tmp>/retro-issue-title.txt)" --body-file <tmp>/retro-issue-body.md` (the output of `$(cat ...)` is not run again). Give the owner the issue link it prints.
4. When `gh` is not signed in, or filing fails, give the owner `https://github.com/pilcrino/pilcrino/issues/new?title=<title>&body=<body>` with both values URL-encoded, so they can file it in the browser themselves. Encode from the two files written in step 3, for example `node -e 'const f=require("fs");const e=p=>encodeURIComponent(f.readFileSync(p,"utf8").trim());console.log("https://github.com/pilcrino/pilcrino/issues/new?title="+e(process.argv[1])+"&body="+e(process.argv[2]))' <tmp>/retro-issue-title.txt <tmp>/retro-issue-body.md`, never by pasting the text into a command.

## Hard rules

- The only file this skill writes is `{profile_dir}/custom-instructions.md` in `<base>`, and only after the owner picks what to add. Never a plugin file, a post, `config.yaml`, a template override, or any other profile doc.
- Never commit anything but that file, never push a commit the owner was not told about, and never discard the owner's own changes.
- Files a Pilcrino issue only on an explicit yes, and only after the owner has seen its full text.
- Never invent friction that the signals do not support.
- Every finding is exactly one kind. If genuinely ambiguous, pick the kind the stronger evidence supports; don't list the same finding twice.
- No em-dash codepoint (U+2014) in any output.

## What this skill does NOT do

- Does not suggest edits to plugin files. A plugin fault is reported as a Pilcrino problem, never as an edit for the owner.
- Does not edit `config.yaml`; it says what setting to change.
- Does not run unattended on a timer. It runs when a human asks for it in the working session.
- Does not spawn subagents, runs inline.
