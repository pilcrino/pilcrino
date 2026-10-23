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

**Change requests in chat.** Handled by the adapter's `## On review-loop edit` (edit in the worktree, commit, push to the post's branch), with no reply posted on the PR and no `handled:` marker: there is no PR comment to answer. The result is reported in chat. After a push, the staging preview and layout check run again (below) and the banner's Preview and Layout lines are re-shown.

**Staging preview and layout check.** Today the monitor finds the staging URL and runs the layout check per commit (`pr-monitor.md` §Each firing step 2a) when CI was not ready at banner time. With the monitor off nothing would come back for it. Instead, before showing the banner (and again after each in-chat change push), the session waits for the PR head's checks to finish, bounded (my call: about 10 minutes, e.g. `gh pr checks --watch` with a timeout), then runs adapter §Staging steps 8 and 9 once. On timeout the banner says `staging deploying` / `Layout: pending`, and the session re-checks once the next time the owner replies, before acting on the reply. This applies to `astro-git-pr` with `preview_comment_marker` set and to `wordpress-rest` (whose preview exists at once, so no wait). `markdown` is unchanged (no site preview).

**Merged or published outside the session.** Nothing watches for it. The owner says "approve" (or runs `published <slug>`), and finalize must tolerate it:
- Approve on a PR that is already MERGED: run Step 15.3 with the console-merge entry's adjustments (a) to (d): no cron to delete, a rejected archive push on the merged branch is not an error, no date commit on the branch, and the merge-date check after a merge (Step 15.6 step 6) runs before the "Merged" closing message. The owner's in-session approve is the proof of approval here, so it writes `approved_head` as any in-session approve does. (Builder: confirm `approved_head` is harmless on a merged PR, since Step 15.6 will find nothing to merge.)
- WordPress published in wp-admin: Step 15.3 already checks for it (`wordpress-rest.md` §On Gate 2 approval step 1). No change.

**Resume (Step 2 routing table).** The row that today says "Step 16 (resume the PR monitor; re-create the cron if it is gone)" splits on the setting: off re-presents the Gate 2 banner (with the staging re-check) and waits; on is unchanged. The "already MERGED with proof of approval" row is unchanged and needs no cron either way.

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

- `skills/blog-post-workflow/SKILL.md`: Step 2 routing rows, Step 15.1, 15.2, 15.3 (merged-PR approve), 15.5 (retro nudge), Step 16 intro.
- `skills/blog-post-workflow/references/pr-monitor.md`: header (opt-in), new self-stop on `false`.
- `skills/blog-post-workflow/references/config-schema.md`: key, description, invariant 11.
- `skills/blog-setup/scripts/validate-config.mjs` (+ `validate-config.test.mjs`): boolean check.
- `personas/editor.md`: step 6 ("starting the Gate-2 monitor cron is unconditional"), Gate 2 text ("This gate is asynchronous"), banner.
- `adapters/publish/astro-git-pr.md`, `markdown.md`, `wordpress-rest.md`: "Stop the monitor cron" becomes conditional; Preview line note.
- `skills/blog-setup/SKILL.md`: third standing decision, summary, YAML block.
- `skills/blog-retro/SKILL.md`: PR review feedback is primary only when the monitor ran; with it off, corrections are in the conversation.
- `README.md`: feature text that says the monitor always runs, plus a changelog entry.
- `.claude-plugin/plugin.json`: minor bump to 0.59.0.
- `tests/`: whatever anatomy checks pin the changed sentences (`tests/check_page_anatomy.sh` greps `pr-monitor.md`), plus a validate-config case for the new key.

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
