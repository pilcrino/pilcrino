# PR monitor: opt-in, off by default

## Why

After Gate 2 the blog-post-workflow always starts a recurring cron that polls the post's pull request (`skills/blog-post-workflow/SKILL.md` Step 15.1). The owner approves in chat almost every time, so the cron mostly fires idle polls (about a dozen on one recent post) and clutters the session. Monitoring should be something the owner turns on, not the default.

## The setting

```yaml
review:
  pr_monitor: false   # OPTIONAL boolean, default false
```

- `false` or absent: no monitor. Gate 2 waits in the session.
- `true`: today's behaviour, unchanged (cron every ~15 minutes with idle backoff, `references/pr-monitor.md`).

It sits in the existing optional `review:` block next to `plan_approval`. `skills/blog-setup/scripts/validate-config.mjs` type-checks it as a boolean (the same invariant that checks `review.plan_approval`).

Existing blogs get the new default without editing their config: there are no outside users, so no migration or notice is owed.

## Behaviour with the monitor off

**Gate 2 (Step 15.1).** No `CronCreate`. The banner is shown and the session waits for the owner's reply in chat: APPROVE, REQUEST CHANGES or PAUSE, plus the existing "merge it" route (Step 15.6). This is the same in-session handling that already exists, minus the async signals.

**GitHub is not read.** Comments, inline diff comments, review bodies and review approvals on the PR are ignored entirely. Nothing polls for them and nothing replies to them. The owner's decision (23 Oct 2026): "nothing, ignore".

**Banner wording.** Everything that promises the monitor goes when it is off:
- "On approve" list: drop "Stop the review-surface monitor cron".
- "leave comments on the review surface or here and I address them" becomes "tell me here what to change and I address it".
- The Preview note "staging deploying, the monitor surfaces the URL when ready" changes (see Staging preview below).
- The retro nudge stays. With the monitor off, finalize runs in this same session, so the nudge also belongs in Step 15.5's closing message as it does on the console path.

**Change requests in chat.** Handled by the adapter's `## On review-loop edit` (edit in the worktree, commit, push to the post's branch), with no reply posted on the PR and no `handled:` marker: there is no PR comment to answer. The result is reported in chat. `wordpress-rest` first reads the post's WordPress status (`pr-monitor.md` §Each firing step 2's call): when it is `publish`, the post is live and may carry edits made in wp-admin, so no re-sync runs (it would overwrite them and set the post back to draft); the session says the post is live in WordPress and changes go there. After a push, the staging preview and layout check run again (below) and the banner's Preview and Layout lines are re-shown.

**Staging preview and layout check.** Today the monitor finds the staging URL and runs the layout check per commit (`pr-monitor.md` §Each firing step 2a) when CI was not ready at banner time. With the monitor off nothing would come back for it. Instead, before showing the banner (and again after each in-chat change push), the session waits for the PR head's checks to finish, bounded (my call: about 10 minutes, e.g. `gh pr checks --watch` with a timeout), then runs adapter §Staging steps 8 and 9 once. Whenever the head commit has no verified preview after the wait, whatever the reason (timeout, checks done but no marker comment yet, a failed deploy), the banner says so in plain words (`staging deploying` or `staging deploy failed`) with `Layout: pending`, and the session re-checks once each time the owner replies, before acting on the reply, against the then-current head. Approve with the preview still unverified goes ahead (the owner decides) and the closing message repeats `Layout: not checked`. This applies to `astro-git-pr` with `preview_comment_marker` set and to `wordpress-rest` (whose preview exists at once, so no wait). `markdown` is unchanged (no site preview).

**Merged or published outside the session.** Nothing watches for it. With the monitor off, the owner's own merge on GitHub counts as approval (owner's decision, 23 Oct 2026): the PR is opened under the owner's account and GitHub never lets an author approve their own PR, so the merge is the owner's decision to publish. It counts only when the owner merged it: `gh pr view <n> -R <repo> --json mergedBy -q .mergedBy.login` equals `gh api user -q .login`. A merge by anyone else is not approval: the session says who merged it and asks the owner to say "approve" here, with no REQUEST CHANGES offered. Every entry below finalizes on an owner merge:
- Before acting on any Gate 2 reply (the session is still open and waiting), the session reads the PR state. MERGED by the owner: finalize as below and say the post is merged, so any further change is a new edit to the published copy, not a push to the old branch. A reply asking for a change is never applied to a merged branch.
- Approve on a PR that is already MERGED: run Step 15.3 with the console-merge entry's adjustments (a) to (d): no cron to delete, a rejected archive push on the merged branch is not an error, no date commit on the branch, and the merge-date check after a merge (Step 15.6 step 6) runs before the "Merged" closing message. The owner's in-session approve is the proof of approval here, so it writes `approved_head` as any in-session approve does. (Builder: confirm `approved_head` is harmless on a merged PR, since Step 15.6 will find nothing to merge.)
- Resume (Step 2) finds the PR MERGED: finalize directly (next section).
- `published <slug>` (Step 16.5) on a post not archived yet whose PR is MERGED: run the same finalize first (Step 15.3 with the console-merge entry's adjustments), then the rest of 16.5. Finalize completes before 16.5 step 7 offers to remove the worktree and branch, so cleanup never removes the folder finalize still needs. A post whose PR is still open: 16.5 says it is not merged yet and stops, as today, except for `wordpress-rest`, whose go-live test is the WordPress status (Step 16.5 step 2): a post published in wp-admin and not finalized yet runs the external-publish finalize (`wordpress-rest.md` §On Gate 2 approval, which skips the content sync so admin edits stay) before the rest of 16.5, and step 7 does not offer to delete a branch whose PR is still open.
- **Archive on a merged PR.** The merged base branch already carries the PR's early archive snapshot at `{drafts_dir}/_archive/<slug>/` (`astro-git-pr.md` §Staging step 6c), and `{drafts_dir}` is not ignored by git. Two collisions follow, both latent today in the monitor's merged path and now on the main path: (1) the base was already pulled, so finalize's `mv {drafts_dir}/<slug>/ {drafts_dir}/_archive/<slug>/` lands on an existing folder and nests as `_archive/<slug>/<slug>`; (2) the base is pulled after finalize, and git refuses because the local archive's untracked files are in the way. The fix changes two operations and adds no branch requirement to finalize, so the app's cleanup resume (run from the post's worktree) is unaffected:
  - **Retiring the source** (finalize step 3 in `SKILL.md` Step 15.3 and the adapters, and the Step 2 recovery row for a crash between `status: done` and the move): destination absent, `mv` as today; destination present, back up the destination folder, copy the source's contents over it (`cp -R src/. dest/`, which keeps the local-only `research/_raw/*.json` and `_backup/`), check every source file now exists at the destination, then remove the source. The recovery row runs this same operation, so a crash at any point resumes it safely and never nests.
  - **The pull after a merge** (Step 16.5 step 3, which the merge-date check also uses): when git refuses because files under `{drafts_dir}/_archive/<slug>/` are in the way, move that local folder aside, pull, copy it back over the pulled archive, then delete the aside copy. The terminal checklist and `pr-monitor.json` then show as changes to tracked files and are committed and pushed under `git.push_without_asking`, like Pilcrino's other own files.
- A merge counted as approval writes no `approved_head`: there is nothing left to merge, so Step 15.6 never needs it.
- WordPress published in wp-admin: Step 15.3 already checks for it (`wordpress-rest.md` §On Gate 2 approval step 1). No change.

**Worktree first.** Every off-path entry that touches the post's branch (resume, approve, a change request) first resolves the recorded worktree exactly as `pr-monitor.md` §Each firing step 1 does today (recreate from the local branch, else the remote branch), and verifies it is a git worktree on that branch before any write. When it cannot be recovered (branch gone, e.g. deleted after a merge), it stops with one plain sentence and writes nothing; it never `mkdir`s the worktree path. Today only the monitor and the review-loop edit do this, and finalize assumes the worktree exists.

**Resume (Step 2 routing table).** The row that today says "Step 16 (resume the PR monitor; re-create the cron if it is gone)" splits on the setting: off re-presents the Gate 2 banner (with the staging re-check) and waits; on is unchanged. A new row, monitor off only: `finalize` + `gate_2_final`, `mode: pr`, `status` not terminal, PR MERGED on origin by the owner (the `mergedBy` check above) → Step 15.3 finalize directly with the console-merge entry's adjustments (a) to (d), merge-date check, then the "Merged" closing message; no banner, so REQUEST CHANGES is never offered on a merged branch. Merged by someone else: the approve-only prompt above. `wordpress-rest` with the post's WordPress status `publish`: the external-publish finalize, as today's monitor does. With the monitor on, the existing "already MERGED with proof of approval" row is unchanged.

**PAUSE.** Sets `status: paused` as today; `CronDelete` only when a cron exists.

## Behaviour with the monitor on

Unchanged, with one addition: each monitor firing reads `review.pr_monitor` from `config.yaml` after its state-file check, and when it is now `false` it `CronDelete`s itself and exits. Turning the setting off mid-review therefore stops a running monitor at its next firing.

## Setup

`skills/blog-setup/SKILL.md` §Two standing decisions becomes three on the detailed path. The new one, asked as a menu after plan approval:

> "After a post is ready, Pilcrino opens a pull request and waits for you to approve it here. It can also check that pull request every 15 minutes or so and act on comments people leave there. Do you want that?"
> - "No, I'll approve here" (default) → `false`. Read back: "Pilcrino waits for you in the session; comments on GitHub are not read."
> - "Yes, watch the pull request" → `true`. Read back: "Pilcrino checks the pull request on a timer and answers comments there."

Quick path: not asked, omitted from `config.yaml` (default off), shown in the summary where a correction is kept, the same as `plan_approval`.

## The app

No change. The app has had no PR monitor of its own for a while. What it still polls covers only posts the owner already approved (merge recovery) and WordPress go-live; neither reads comments. Runs the app starts are console-gated and never create the cron (`SKILL.md` §Gate 2 and monitoring, `console-contract.md`), so the setting has no effect there and the app does not show it. A later app re-pin to the new plugin tag is routine, not part of this work.

## Files the change touches

- `skills/blog-post-workflow/SKILL.md`: Step 2 routing rows, Step 15.1, 15.2, 15.3 (merged-PR approve), 15.5 (retro nudge), Step 16 intro, Step 16.5 (finalize a merged, unarchived post before cleanup).
- `skills/blog-post-workflow/references/pr-monitor.md`: header (opt-in), new self-stop on `false`.
- `skills/blog-post-workflow/references/config-schema.md`: key, description, invariant 11.
- `skills/blog-setup/scripts/validate-config.mjs` (+ `validate-config.test.mjs`): boolean check.
- `personas/editor.md`: step 6 ("starting the Gate-2 monitor cron is unconditional"), Gate 2 text ("This gate is asynchronous"), banner.
- `adapters/publish/astro-git-pr.md`, `markdown.md`, `wordpress-rest.md`: "Stop the monitor cron" becomes conditional; Preview line note.
- `skills/blog-setup/SKILL.md`: third standing decision, summary, YAML block.
- `skills/blog-retro/SKILL.md`: PR review feedback is primary only when the monitor ran; with it off, corrections are in the conversation.
- `README.md`: feature text that says the monitor always runs, plus a changelog entry.
- `.claude-plugin/plugin.json`: minor bump to 0.59.0.
- `tests/`: validate-config accepts `true`, `false` and an absent key and rejects a non-boolean (today the validator rejects `review.pr_monitor` as unknown, so a rejection-only test proves nothing). Anatomy checks in `tests/check_page_anatomy.sh` that pin the new contract: Step 15.1 starts the cron only under `review.pr_monitor: true`, the resume row splits on it, the monitor's self-stop on `false`, the worktree-first rule, the WordPress live-post guard, the `mergedBy` owner check, the PR-state read before each Gate 2 reply, and the two archive operations (retire-into-existing never nests; the pull moves the local archive aside and copies it back). Merged-finalize cases to cover: base already pulled, pulled afterwards, a crash between `status: done` and retiring the source (the archive keeps raw captures and `_backup/`), a merge by another account, and the app's cleanup resume from the post's worktree. Each must fail when the old unconditional cron sentence is restored.

## Goals

- Default off: no cron after Gate 2 unless `review.pr_monitor: true`.
- With it off, the whole Gate 2 to finalize path works in one session, including a preview that was not ready yet and a PR merged on GitHub before the owner says approve.
- With it on, nothing changes.

## Non-goals

- Reading, answering or acting on GitHub comments or reviews when off.
- A per-post override ("watch this one").
- Any app change.
- Changing who may merge (Step 15.6 rules stay as they are).

## Anti-goals

- A cron that still starts somewhere with the setting off (resume, a re-entered Step 14.5, an adapter step).
- A banner that tells the owner to comment on GitHub when nothing reads GitHub.
- A post whose Preview or Layout line says "pending" with nothing ever coming back to fill it.

## Left to the builder

- Exact banner wording beyond the lines above, and where the on/off branch sits in each file.
- The wait mechanism and timeout for the staging checks, within "bounded, about 10 minutes".
- Test shape.
