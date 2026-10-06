# Reading competitor profiles

Competitor profiles belong to the base branch. Refreshes (the console's
Competitors screen, `research-competitor`) land on `origin/{git.base_branch}`,
and a post branch can be months behind it. A post run never reads a profile
from its own working tree. Spec:
`docs/superpowers/specs/2026-10-06-competitor-profiles-from-base-design.md`.

## List mode (intake)

Run from the repo root of the working tree:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/scripts/competitor-profiles.mjs \
  --dir {competitors_dir} --base {git.base_branch}
```

It fetches the base branch (60 second limit, no prompts), pins one commit and
prints JSON: `source` (`origin/<base>` or `worktree`), `commit`, `fetched`,
`dirExists`, `methodology`, and `profiles[]` with `slug`, `name`, `file`,
`lastVerified`, `path`. It writes nothing.

## Snapshot mode (Stage 1.5c)

The same command plus `--out {drafts_dir}/<slug>/research/profiles`. It
writes every profile and `methodology.md` from the pinned commit into
`{drafts_dir}/<slug>/research/profiles/`, replacing any earlier copy whole.
From then on every read of a profile in this run opens
`{drafts_dir}/<slug>/research/profiles/<file name>`. The folder moves to
`_archive` with the draft, as the record of the profile text the post used.

## Rules

1. **Match** each named competitor against `name` (the H1) or `slug`,
   case-insensitive. No match: hard stop, "No `<Name>` profile on `<source>`".
2. **Date.** `lastVerified: null` is a hard stop: "`<Name>` profile on
   `<source>` has no valid Last verified date". Otherwise compute
   `(today - lastVerified).days` with `date +%Y-%m-%d`; more than 14 is a hard
   stop: "`<Name>` profile on `<source>` last verified `<date>` (`<N>` days,
   contract 14)".
3. **Content at intake** (such as checking a claimed feature gap): run
   `git show <commit>:<file>` when `commit` is set. Read `file` from the
   working tree only when `source` is `worktree`.
4. **Script failure.** A non-zero exit is a hard stop with the stderr text:
   interactive halt; autopilot park `other` with it. Never fall back to the
   working-tree copy.
5. **Config.** Intake runs list mode once whenever `modules.competitors` is on,
   even when the post names no competitor, and checks this first:
   `dirExists: false` or `methodology: false` is a hard stop naming config
   invariant 12 or 5 and "run /blog-setup" (autopilot: park `other`).
6. **Park detail** (autopilot `competitor_profile_stale`): the hard-stop text
   from rule 1 or 2, then "Refresh it on the Competitors screen, then Retry."
   When `source` is `worktree`, add "(read from the working tree: no
   origin/<base> ref)". When `fetched` is false, add "(fetching origin/<base>
   failed, so this may be an older copy)".
7. **Identity.** `brief.md` "Competitors to mention" keeps `Profile path =
   {competitors_dir}/<slug>.md` as the profile's identity. It is never opened;
   the snapshot file with the same file name is.
