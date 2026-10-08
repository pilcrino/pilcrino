# Console contract — headless autopilot runs

The single source of truth for how `blog-post-workflow` autopilot runs and the
operator console (`console/` in this repo) talk to each other. Both sides cite
this file; change it only with a matching change on both sides, in one PR.

## Invocations the console may spawn

| Mode | Argument to `/pilcrino:blog-post-workflow` | When |
|---|---|---|
| `autopilot` | `autopilot <slug>` | Fresh write of a queued post |
| `autopilot-cont` | `autopilot-cont <slug>` | After verification PASS: perform staging side effects (open PR / create WP draft) from Step 14.5 onward |
| `autopilot-revise` | `autopilot-revise <slug>` | Operator submitted feedback at the approval gate; read `{drafts_dir}/<slug>/feedback.md`, revise, re-stage |
| `autopilot-fix` | `autopilot-fix <slug>` | Verification FAIL: read `{drafts_dir}/<slug>/verification-report.md`, repair, exit for re-verification |

All spawned as `claude -p "/pilcrino:blog-post-workflow <argument>"
--dangerously-skip-permissions --output-format stream-json --verbose
--model <model> [--effort <effort>] --agents <json>`, detached, cwd = the
post's git worktree, stdout+stderr → the run log.
`--output-format stream-json` (with the `--verbose` flag it requires) makes
the run log JSONL instead of plain text — `console/src/streamlog.ts`'s
`extractReadableLines` turns it back into operator-readable lines for the
dashboard's log panel and every other log-tailing surface (parked-card log
tail). Old
plain-text logs still parse: non-JSON lines pass through raw. Environment:

- `CONSOLE_RUN_STATE` — absolute path of the run's events file. Presence of
  this var IS autopilot mode.
- `CONSOLE_VERIFICATION` — `on` | `off` (see handshake below).
- `CONSOLE_RULES` is the absolute path of a generated read-only Markdown list
  of the operator's standing rules, rendered fresh for each run. Set only when the blog
  has at least one rule, so an unset var means "no rules", not an error. The run
  READS it and nothing else: it is a run sidecar under the console's state dir,
  never a file in the blog repo, and the run never writes a rules file of its
  own. The console creates standing rules itself, when the operator submits
  feedback marked standing; the run derives none.
- `CONSOLE_POST` is the absolute path of a JSON file holding this post, with
  exactly six string keys: `slug`, `title`, `angle`, `author`,
  `requirements` (the owner's requirements for this one post, as typed on the
  post in the console; `""` when there are none) and `pageType` (one of
  `alternatives`, `vs`, `review`, `best-for`, `for-role`, `export`, `how-to`,
  `other`; `""` for a post added by hand). The console writes it from
  its post table at every spawn and always sets the var. A run sidecar under
  `runs/` in the console's state dir, read-only, never a file in the blog repo.
  The run takes the post from here, never from `blog-ops/content-plan.md`.

`--model` and `--effort` are the Editor row of the console's Agents screen.
`--agents` redefines each plugin subagent under its `pilcrino:<name>` key with
that row's model and effort, copying `description`, `tools` and the body from
`agents/<name>.md` (`console/src/agent-definitions.ts`). A namespaced key
replaces the plugin's definition for that session, so this workflow dispatches
the same `pilcrino:*` names and needs no change. `--effort` is omitted for a
model without effort levels. The vision pass
(`console/src/verification/vision.ts`) carries the Visual check row's
`--model`/`--effort` the same way.

## Other invocations the console spawns

Two more headless invocations exist outside the four autopilot modes above.
Neither runs with `CONSOLE_RUN_STATE` set, so neither is autopilot mode:
nothing above (event vocabulary, park reasons, verification handshake)
applies to them.

| Invocation | Command | Spawned by | Notes |
|---|---|---|---|
| Cleanup finalize resume | `/pilcrino:blog-post-workflow resume <slug>` | `console/src/cleanup.ts`, the resume gate at the top of `runCleanupFor` | Spawned for a post in `cleaning` whose finalize bookkeeping is still pending: its `{drafts_dir}/<slug>/checklist.md` frontmatter is not `status: complete` (`isFinalizePending`). Detached, under the run id `<slug>-cleanup-resume` (a `.json` record carrying the pid, plus `.log` and `.exit`, in `runs/`); `cwd` is the post's worktree when it exists, else the blog root. The console then waits for its exit file: each later tick finds the `.exit` file (any exit code lets cleanup go on to the archive check) or, while it is missing, probes the recorded pid; a pid that is gone without an exit file (a reboot, a killed `sh -c` wrapper) lets cleanup go on too, so a lost resume never holds a post in `cleaning`. `CONSOLE_RUN_STATE` UNSET: the post is already published, so this is interactive-mode bookkeeping finalize (Stage 4c), not an autopilot run. Do not mistake it for a fifth autopilot mode. Keeps `--dangerously-skip-permissions`: no untrusted input, already-published human-approved content. |
| Competitor read | `/pilcrino:research-competitor autopilot` | `console/src/competitor-read.ts`, from the Competitors screen's Add or Refresh | **Owner-started only, one at a time.** Detached; `cwd` is a throwaway detached worktree `.worktrees/_competitor-<name>` off `origin/<base>`, removed when the job ends. `CONSOLE_RUN_STATE` unset; `CONSOLE_COMPETITOR_REQUEST` (request JSON) and `CONSOLE_COMPETITOR_RESULT` (result JSON path) set. The prompt carries `UNTRUSTED_INPUT_FRAMING` before the slash command (`READ_SESSION_PROMPT`, competitor-read.ts): this is the most exposed of the console's spawns, with the widest browser grant, and it reads live third-party web pages through the Pilcrino browser. De-privileged: no `--dangerously-skip-permissions`; `Read` scoped to the worktree, the plugin and the request file; `Edit` scoped to the worktree's competitors folder and the result file; `Bash(date:*)`, `ToolSearch` and the Pilcrino browser's `mcp__plugin_pilcrino_pilcrino-browser__*` tools, which drive the console's own Chrome profile and write their captures to files under the job's scratch directory; git, curl, WebFetch and Playwright denied; `--permission-mode dontAsk` pinned. The agent never commits: the console checks the result and the changed paths, then commits only the profile and its `methodology.md` row and pushes `HEAD:<base>`, retrying up to 3 times from a fresh fetch, never rebasing. Job state and logs live in `~/.pilcrino/<blog-key>/competitors/`, outside `runs/`. |

Every console `claude -p` spawn that can browse (the autopilot modes above,
the competitor read, the post ideas research run and the site check's vision
review) passes `--mcp-config <resolved per-job file> --strict-mcp-config`: the console writes
one MCP config per job that registers only the Pilcrino browser server, under
the name `plugin_pilcrino_pilcrino-browser` (the same tool names an
interactive session sees for the plugin's own server), with
its output roots set to that job's own worktree or scratch directory, so a
session sees that server and no other MCP server. The post ideas research run
(`/pilcrino:plan-content autopilot`, `console/src/research-run.ts`) drives the
Pilcrino browser through the same `mcp__plugin_pilcrino_pilcrino-browser__*` tools as the
competitor read. Before either starts, the console's browser gate checks the
sites it needs (Google and Reddit for research, none for a competitor read,
which only needs Chrome to start) and fails the job with
`browser_unavailable`, `login_required` or `blocked` instead of spawning it.

Both are spawned as `claude -p "<command>" ... --output-format stream-json
--verbose`, detached, without `CONSOLE_RUN_STATE`/`CONSOLE_VERIFICATION` set:
that variable's presence is what distinguishes an autopilot run from these
two. Only the cleanup finalize `resume` keeps `--dangerously-skip-permissions`
(interactive-mode bookkeeping on already-published, human-approved content,
no untrusted input). The competitor read is de-privileged instead: no
`--dangerously-skip-permissions`, a narrow `--allowedTools`/`--disallowedTools`
pair scoped to exactly what its skill needs, and `--permission-mode dontAsk`
pinned so that allowlist is authoritative regardless of the operator's
ambient default permission mode.

## Cleanup's archive check

`cleaning` is the post status between the merge and `published`. When a post
is finalized after its merge (or its WordPress go-live), `finalizePublished`
(`console/src/publish.ts`) sets the post to `cleaning` with
`cleanup_attempts` 0 and regenerates `content-plan.md`, where it now reads
`published`; the dashboard shows it as "Cleaning up".
Every tick, `runCleanups` (`console/src/cleanup.ts`) gives each `cleaning`
post one `runCleanupFor` attempt, one post at a time (the archive check takes
the git lock). The attempt first passes the finalize resume gate (§Other
invocations, Cleanup finalize resume): while a resume is pending or running it
answers `waiting` and does nothing else. After that, before it sweeps
anything, it re-verifies that the post's draft archive actually reached git.
Its first act is `classifyArchive`, which returns one of four `ArchiveHealth`
values. The workflow side of this contract is summarised in `quality-gates.md`
§After Gate 2 approval + Finalize; everything below is operator diagnostics.

**Which tree it classifies.** Not the operator's checkout, and not the post's
worktree. `classifyArchive` takes the console's git lock and calls
`ensureBaseWorktree` (`console/src/worktree.ts`), which fetches and
`reset --hard`s the console-owned `.worktrees/_console-base` tree to
`origin/<base branch>` on every call; it then classifies
`{drafts_dir}/_archive/<slug>/` **inside that tree**. The verdict is therefore
about what reached `origin/<base branch>`: the main checkout's branch,
staleness and uncommitted state have nothing to do with whether a published
post's archive landed in git, and reading the archive there once parked a post
`archive_missing` whose archive was sitting intact in `origin/main`.

**The four states** (`classifyArchiveDir`, same file — pure, and handed nothing
but that one directory path):

- `healthy` — the directory exists, holds at least one non-dotfile entry (a
  lone `.DS_Store` does not count), contains `checklist.md`, and that
  checklist's **leading frontmatter block** carries `status: complete` on a
  line of its own. All four conditions, nothing else. The frontmatter
  restriction is deliberate: a `status: complete` string further down the body
  (the `# status values:` legend) must not pass a post.
- `partial` — the directory exists and is non-empty, but it has no
  `checklist.md`, or the checklist cannot be read, or its frontmatter is short
  of `status: complete`. A finalize that crashed after the `mv` but before
  stamping the checklist lands here and must never read as healthy — see
  `classifyArchiveDir`'s "NON-TERMINAL IS NEVER HEALTHY" comment.
- `absent` — the directory is missing or unreadable, or holds nothing but
  dotfiles.
- `unknown` — the question could not be answered on this tick: the git lock
  timed out, or the base worktree could not be created, fetched or
  `reset --hard`ed. It is **not** a fourth shade of incomplete and carries no
  information about the archive at all.

The post's worktree is not an input to the classification. An earlier version
returned `healthy` for a non-terminal checklist whenever the worktree's
`blog-ops/drafts/<slug>/` was gone; that shortcut was removed before this work,
and the reasoning is preserved in the function's own comment.

**What each outcome does:**

- `healthy` → cleanup proceeds: post-stats snapshot, deletion of the slug's run
  rows and sidecars (events, `.log`, `.vision.log`, `.rules.md`) and of the
  finalize resume's own `.json`/`.log`/`.exit`, then `git worktree prune` (a
  failed prune is logged, not fatal), then the row goes from `cleaning` to
  `published` with its park reason, detail and resume time cleared.
- `partial`/`absent`, and the post's worktree still has
  `blog-ops/drafts/<slug>/` → an **additive** rescue into the
  `{drafts_dir}/_archive/<slug>/` of the console-owned `_console-base`
  worktree — the same tree the classification was read from, NOT the operator's
  checkout: `copyMissingFiles` copies only files the archive lacks and never
  overwrites one it already has, because the archive's own copies are the ones
  finalize was working on and are closer to final state. `markRescued` then
  appends a `RESCUED by console cleanup …` line to the archived `checklist.md`
  so the result is not read as an archive finalize produced cleanly —
  best-effort only: it silently does nothing when the archive has no
  `checklist.md`, which is one of the `partial` shapes where the marker would
  matter most, so absence of the marker is not evidence of a clean archive.
  **The rescue then commits and pushes for itself**, from the base worktree,
  pathspec-scoped to that one slug directory and pushed as `HEAD:<base branch>`
  (`commitInTree`, `console/src/tree-commit.ts`), with the
  `rescued-by-console: <slug>` trailer on that very commit. The copy, the
  marker and the commit all happen inside ONE hold of the git lock, because
  `ensureBaseWorktree` `reset --hard`s that shared tree on every call and a
  reset between the copy and the `add` would discard the rescued files. It does
  NOT depend on anything committing the operator's checkout. A SUCCESSFUL
  PUSH IS NOT SUFFICIENT: still inside
  that same lock hold, the rescue target is **re-classified** with
  `classifyArchiveDir`, and cleanup proceeds as for `healthy` only when that
  second verdict is `healthy` too. Anything else is a failed rescue (next
  bullet).
- **A rescue that pushes but leaves the archive non-terminal is a FAILED
  rescue** — and this is the COMMON case, so expect most rescues to park.
  `copyMissingFiles` is additive, and the base worktree normally already holds
  the staging snapshot's `checklist.md` at `status: open`, so zero files copy,
  `markRescued` appends its line, `commitInTree` commits that line, and the
  archive is exactly as non-terminal as it was found. A cleanup that finished
  over that would leave a published post whose archive stays incomplete forever
  with no failure card — the rescue was assumed to be the backstop for an
  archive that never reached the base branch, and completing silently here is
  what made that assumption false. The files ARE preserved on
  `origin/<base branch>` in this case (unlike the push-failure one below), and
  the park's `detail` says so: the job is to finish the archive by hand — stamp
  the checklist terminal — not to hunt for lost files.
- **A rescue whose push fails is a FAILED rescue**, not a rescue with a caveat,
  and takes the park branch below. A committed-but-unpushed rescue is not safe
  in that tree: `ensureBaseWorktree` runs `reset --hard origin/<base branch>` on
  **every** call, and the next tick's `classifyArchive` — for this post or any
  other — calls it. The rescued files are tracked in the commit that reset
  discards, so they leave the working tree with it; an `add` that succeeded
  before a failed `commit` dies the same way, and only a failed `add` leaves
  untracked survivors. So a non-fast-forward rejection (origin moved between
  the reset and the push; `commitInTree` has no rebase and no retry) must not
  finish cleanup clean. The log says where NOT to look:
  `do NOT go looking in <base worktree path>: that copy is discarded by the
  next ensureBaseWorktree reset. The surviving copy is the post's worktree at
  <path>.`
- **Four ways a rescue fails**, none of which counts as a silent success:
  `partial`/`absent` with no drafts directory to rescue from; **a rescue that
  threw** (a failed copy, an unusable base worktree, a lock timeout); **a rescue
  that could not reach origin**; and **a rescue that pushed but left the archive
  non-terminal**. What distinguishes them is WHERE the surviving copy is and
  therefore what a human has to do: in the first three the post's worktree is
  the only copy and the job is recovery, while in the fourth the files are
  already on `origin/<base branch>` and the job is finishing the archive
  (stamping `checklist.md` terminal). In all four the console parks the post
  `archive_missing` with a detail that names which one happened (read it
  rather than assuming) and the retained worktree's path, and returns early,
  deliberately skipping the stats
  snapshot, the sidecar sweep and the prune: this run's `.log` is the evidence
  the manual recovery needs. The worktree is retained in all four, as it is on
  every cleanup outcome.
- `unknown` → `runCleanupFor` bumps the row's `cleanup_attempts`, logs
  `archive state for "<slug>" is unknown (base worktree unreadable); leaving
  it for a later tick (attempt N of 15)` and answers `waiting` **before** the
  rescue-or-park branch. Nothing is verified, rescued, parked or swept this
  tick, and the post stays `cleaning`, so the next tick tries again. Bounded
  at `MAX_CLEANUP_ATTEMPTS` (15, counted on the row's `cleanup_attempts`); on
  the fifteenth it parks `archive_state_unknown` instead, **never**
  `archive_missing`, which asserts something about an archive nothing was
  learned about (see below).

**The park is durable.** `park` (`console/src/publish.ts`) sets the row to
`parked` with the reason and the detail, and appends a `parked` event to the
post's latest run, so the events file keeps the audit trail too. The row is
the alarm, and it stays: `computeStatus` (`console/src/reconcile.ts`) carries
a prior `cleaning` forward unconditionally, and a prior `parked` under one of
`CLEANUP_PARK_REASONS` (`console/src/contract.ts`: `archive_state_unknown`,
`archive_missing`) forward as well, both ahead of the status derived from the
post's latest run, which would otherwise replace the park on the next tick.
The console reads `content-plan.md` back exactly once, when a blog is connected and its post table is empty; otherwise it only writes it. The dashboard's park card leads with the plain words for the
reason, shows the raw detail (with the worktree path) under them, and offers
one way out: "Retry cleanup".

**Retry cleanup** is `POST /api/cleanup/:id/retry`, Bearer-guarded like every
mutating route. For a post parked under `archive_state_unknown` or
`archive_missing` it sets the row back to `cleaning` with `cleanup_attempts`
0 and clears the park reason and detail, so the next tick runs the whole of
`runCleanupFor` again, resume gate included. Any other status or reason
answers 409 (`not_cleanup_park`); an unknown id answers 404. `syncRunsToQueue`
may re-stamp the run's last `parked` event onto the `cleaning` row as its park
reason and detail; the status stays `cleaning`, and a successful cleanup clears
those fields when it sets `published`.

**An `unknown` classification RETRIES, up to fifteen ticks, then parks.** A
transient lock timeout or a momentary network failure therefore costs one
tick, and the post is then verified, rescued or parked, and swept normally.
Only `unknown` classifications count against the bound: a failed rescue parks
at once.

**The retry is bounded because a post that never leaves `cleaning` is not
free.** It is retried every tick for as long as it stays there, its run
sidecars are never swept (`gcRunSidecars`, `console/src/run-gc.ts`, only
touches runs whose post is `parked`, `failed` or `published`), and if the
cause is a stale-but-live-pid lockfile rather than a network failure, every
tick burns `withLock`'s full wait (120s by default). So at
`MAX_CLEANUP_ATTEMPTS` cleanup stops retrying and parks
**`archive_state_unknown`** with a detail saying the archive state could not
be determined after N attempts.

**The bound is deliberately loose.** The dominant cause of `unknown` is
`ensureBaseWorktree`'s `git fetch` failing (network, credentials, GitHub),
where multi-minute outages are routine; what the bound prevents is mild and
slug-local, while a PREMATURE park costs a human's attention. Fifteen ticks is
~15 minutes at the default 60s interval, longer when the lock-wait cause makes
each attempt burn up to 120s first. Data safety is identical at any value:
retention is unconditional, so the retry and the park both keep the worktree.
To diagnose, read the per-tick `classifyArchive: base worktree unavailable for
"<slug>"` lines on the console server's stderr for the underlying git or lock
error, make `.worktrees/_console-base` fetchable and resettable again
(network, credentials, disk, or a stale lock file at `cfg.gitLockPath`), then
press "Retry cleanup" on the park card.

While it is still retrying, the on-disk state is the inverse of the `healthy`
branch: the slug's run rows and sidecars are all still in `cfg.runsDir` (plus
the `<slug>-cleanup-resume.json` / `.exit` / `.log` family, when a finalize
resume ran), and the row reads `cleaning` with a non-zero `cleanup_attempts`.
A park leaves those sidecars too, deliberately, but sets the row to `parked`.
From then on `gcRunSidecars` may age the regular run sidecars out, on the
run's own `startedAt` after 30 days. That clock is NOT measured from
publication (terminal status is only a gate), so for a post whose write runs
started well before the merge, the evidence can disappear much sooner than 30
days after it went live.

A `runCleanupFor` that THROWS is a different signal: the post stays
`cleaning`, `runCleanups` logs the error and goes on to the next post, and the
next tick tries again. A throw does not count against `MAX_CLEANUP_ATTEMPTS`.

**Nothing here removes the worktree, on any of the four outcomes.**
`runCleanupFor` has no removal path at all ("THE WORKTREE IS NEVER REMOVED
HERE", its own doc), and `removeWorktree` (`console/src/worktree.ts`) has no
automatic caller anywhere: deletion is an operator action, because a worktree
can hold the only copy of a post's research, plan, drafts and generated assets.
Deletion belongs on an operator-facing surface in the console; the console
displays a post's worktree path today but offers no delete control, so until one
ships a human removes it by hand.

**Archive git state belongs to the console, not to the workflow.** The
workflow never runs git of its own against the main checkout's tracked
`{drafts_dir}/_archive/`. The cleanup rescue writes into, commits from and
pushes from the console-owned base worktree, precisely because a rescue is the
last copy of a post's research, and leaving it in the operator's checkout
would put it where nothing commits it and a `git checkout .` would destroy
it. The console no longer sweeps other writes into the main checkout's
archive (`sweepArchiveDrift` went with the post-publish chain): output a
skill run by hand leaves there belongs to the working session that ran it.

The whole check exists because a finalize that skips the archive step is
otherwise unrecoverable — the incident is D3 in
`docs/superpowers/specs/2026-07-30-archive-integrity-design.md`. Read only that
document's problem statement: its design half predates this behaviour (three
states, a `healthy` verdict inferred from a missing drafts dir, and a cleanup
that removes the worktree), and the code described above supersedes it.

## Event vocabulary

Autopilot runs append ONE JSON object per line to `$CONSOLE_RUN_STATE` at every
transition. `ts` is ISO-8601. Unknown extra fields are allowed; unknown `type`
values are not.

| Event | Required fields | Meaning |
|---|---|---|
| `stage` | `stage` | Entered a workflow stage (checklist.md stage ids) |
| `agent_started` | `agent` | Subagent spawned |
| `agent_done` | `agent` | Subagent returned |
| `parked` | `reason` | Run stopped needing a human; `detail` optional |
| `pr_opened` | `pr`, `url`, `branch` | Review PR exists. `pr` MUST be the real PR number and `url` its GitHub URL: never `0`, never a WordPress preview URL (see below) |
| `ready_for_verification` | `slug` | Post staged, PR NOT opened; run exits. TERMINAL — never follow it with `done` |
| `rule_learned` | `rule` | RETIRED: never emit it. Once a standing rule derived by `autopilot-revise`; the console now creates the rule at feedback submit. The console still parses it so old events files read cleanly, and ignores it. NOT terminal |
| `done` | — | Mode's terminal success. MUTUALLY EXCLUSIVE with `ready_for_verification` |
| `error` | `message` | Unhandled failure |
| `paused_limit` | `resume_at` | SYNTHETIC — appended by the console, never by the run, when a usage-limit death is detected |
| `api_retry` | — | SYNTHETIC — appended by the console, never by the run, when a dead run's log shows a dropped API connection (`terminal_reason: api_error`); derives `queued` so the scheduler restarts it |
| `interrupted_retry` | (none) | SYNTHETIC: appended by the console, never by the run, when a dead run's log has no top-level `result` line (the process was killed: app restart, signal, crash, reboot). Derives `queued`; the console restarts the SAME mode as the run that died (`autopilot-revise` re-reads `feedback.md`, `autopilot-cont` re-opens the PR, `autopilot-fix` re-reads the report). Every mode must therefore be safe to run again after a kill at any point |
| `verify_retry` | `by` | SYNTHETIC: appended by the console, never by the run, when verification is re-armed on a parked run. `by: "operator"` for Check again (`POST /api/verify/:postId/retry`, uncapped, resets `verify_retries`); `by: "console"` for the automatic retry of a `verification_error` park after 15 min, 1 h and 4 h (`console/src/verification/verify-retry.ts`) |
| `verify_skipped` | `by` | SYNTHETIC: appended by the console when an operator waives a FAILED site check (`POST /api/verify/:postId/skip`), never by the run. The console spawns `autopilot-cont` exactly as it does after a PASS; Gate 2 approval is unchanged |

### `pr_opened` carries a real PR number, always

`pr: 0` used to be legal here: it meant "WP draft created, no PR path", back when
Gate 2 had a local/console-gate mode. That mode is gone (`references/config-schema.md`
§GitHub precondition makes the PR path the ONLY publish path, hard-stopping at
Step 0 when GitHub is unusable), but the `pr: 0` allowance outlived it by one
release and produced a silent dead end: a `wordpress-rest` post reached
`awaiting_approval` with `pr: 0` in the queue, and Gate 2
(`console/src/publish.ts` `approvePost`) had nothing to merge, so every press of
Publish now failed. The branch was pushed, the WP draft existed, and no PR was
ever opened to carry either.

So: if `gh pr create` does not succeed, do NOT emit `pr_opened`. Emit `parked`
with reason `other` and the failing command's output as `detail`. A parked post
is visible and actionable in the console; a `pr: 0` post looks approvable and
is not. The console rejects a zero/missing `pr` at the approval route
(HTTP 409) rather than accepting an unpublishable post.

## Park reasons

`brief_insufficient`, `review_escalation`, `featured_screenshot_required`,
`competitor_profile_stale`, `research_fetch_failure`, `serp_blocked`,
`chrome_unavailable`, `captcha_or_login`, `wp_auth_failed`, `slug_collision`, `featured_image_missing`,
`image_ownership_conflict`, `mass_forbidden_phrases`,
`humanize_preservation_failed`, `subagent_failed`, `verification_failed`,
`verification_error`, `pr_conflicted`, `merge_failed`, `pr_create_failed`,
`staging_conflicted`,
`archive_missing`, `archive_state_unknown`, `limit_retries_exhausted`,
`api_retries_exhausted`, `interrupted_retries_exhausted`, `other`, `unexpected_error`

Parking never corrupts checklist state: a parked slug is always resumable
interactively via `/pilcrino:blog-post-workflow resume <slug>`.

### Who emits which park (RUN-side vs CONSOLE-side)

The list above is one flat
vocabulary, but the two sides of this contract do not both emit every reason —
an implementer needs to know which reasons THEIR side is responsible for
appending. A `parked` event lands in `$CONSOLE_RUN_STATE` either because the RUN
appended it (the autopilot run parks itself, per SKILL.md §Autopilot's
park-don't-ask policy table) or because the CONSOLE appended it (the console's
own orchestration writes a `parked` line via `console/src/publish.ts`'s
`park()` / `appendEvent`).

- **RUN-emitted** (the run parks itself and exits 0, leaving checklist.md in a
  valid stage): `brief_insufficient`, `review_escalation`,
  `featured_screenshot_required`, `competitor_profile_stale`,
  `research_fetch_failure`, `serp_blocked`, `chrome_unavailable`,
  `captcha_or_login`, `wp_auth_failed`, `slug_collision`,
  `featured_image_missing`, `image_ownership_conflict`,
  `mass_forbidden_phrases`, `humanize_preservation_failed`, `subagent_failed`,
  `other`, `unexpected_error`. These are exactly the reasons in the skill's
  park-don't-ask policy table (plus `brief_insufficient` from file-intake).
  Two of them are ALSO console-appended: before it spawns an `autopilot` run
  (the initial write, the only post run that browses), the console's browser
  gate (`console/src/browser-gate.ts`, called from `spawnRun` in
  `console/src/runner.ts`) asks the Pilcrino browser for the sign-in state of
  the sites the run needs and parks the post without spawning it:
  `captcha_or_login` when a site is signed out or challenging the browser,
  `chrome_unavailable` when the browser cannot start or cannot reach a site.
  The detail ends in every site's state (`Google: signed in, Reddit: signed
  out`), which the dashboard's Open browser button reads its sites from.
  The console never probes sign-in on a schedule: probing a signed-out site
  repeatedly trips its rate limits. The gate holds every answer per site,
  each with its own time, so a probe of other sites never replaces it.
  Within 15 minutes of a needed site being found not signed in (or of the
  browser failing to start), it parks from that held state without asking
  again; sites found signed in are confirmed once per tick. Preflight's Setup
  rows only render what is held. The browser is asked afresh only when the owner
  presses Check sign-in (`POST /api/browser/check`), Open browser or a post's
  manual start, each of which drops the held answer first.
- **CONSOLE-appended** (the run NEVER emits these — the console appends them
  from its own post-run/orchestration paths): `verification_failed`
  (`console/src/verification/verify.ts` on a vision/build-check FAIL, and
  `console/src/runwatch.ts` when an `autopilot-fix` run exceeds the 20-minute
  timeout — a recent change), `verification_error`
  (`verification/verify.ts` when the verification cycle itself crashes, or when
  the site cannot be built at all: the package install failed, or the build
  could not load the site's config or find a package; such a check never starts
  an autopilot-fix run),
  `pr_conflicted` (`console/src/feedback-resolve.ts` when the operator submits
  feedback on a PR that `gh pr view --json mergeable` reports `CONFLICTING`
  and the union-driver resolve cannot settle it. GitHub builds no
  `refs/pull/<n>/merge` for such a PR, so NO `pull_request` workflow runs and
  a push would rebuild no preview; the revision run is not started. The
  operator resolves the conflict by hand and clicks Approve again),
  `staging_conflicted` (`adapters/publish/astro-git-pr.md` Staging b2, when the rebase onto the base branch conflicts in a file staging may not resolve; detail `branch <name> conflicts with origin/<base> in: <paths>`. A human fixes the branch, then Reopen for approval),
  `merge_failed` (`console/src/publish.ts` when an APPROVED Gate 2 merge fails,
  including after `autoResolveMerge` has resolved the conflict locally and
  exhausted its retries of GitHub's "branch was modified" race; retried by the
  operator with Approve again, which re-runs the merge; nothing polls for it. An
  archive-push failure in the same code path parks `other` instead: it is not a
  statement about the PR, so Approve again is not its retry),
  `archive_missing` (cleanup classified this post's archive as `partial`
  or `absent` and could not rescue it — in one of FOUR ways: the post's worktree
  had no `blog-ops/drafts/<slug>/` to copy from; the rescue itself threw (a
  failed copy, an unusable base worktree, a lock timeout); the rescue's push was
  rejected, which leaves its base-worktree copy scheduled for destruction by the
  next `reset --hard`; or the rescue pushed but a re-classification found the
  archive STILL non-terminal — the common case, since the additive copy
  routinely changes nothing, and the one case where the files did reach
  `origin/<base branch>` and the job is stamping the checklist terminal rather
  than recovering anything. Both the classification and the rescue happen in the
  console-owned `.worktrees/_console-base` tree, NOT the main checkout. The
  park's `detail` names which of the four happened — read it rather than
  assuming files are simply absent. The worktree is retained on disk for manual
  recovery, as it is for every
  park reason and every non-park cleanup outcome; the console never removes it,
  unconditionally. The park is durable: the row stays `parked` until an
  operator acts. Full mechanism: §Cleanup's archive check. Once the archive
  is restored or finished by hand, the way out is "Retry cleanup" on the
  dashboard),
  `archive_state_unknown` (cleanup could not DETERMINE this post's archive
  state at all: `classifyArchive` answered `unknown` on all
  `MAX_CLEANUP_ATTEMPTS` (15, counted on the row's `cleanup_attempts`) of its
  retries because the console-owned
  base worktree stayed unreadable — a failing `git fetch`, an unusable tree, or
  a `cfg.gitLockPath` timeout. Deliberately NOT `archive_missing`: that reason
  asserts something about the archive and sends a human to recover files, while
  this one says nothing was learned about it and the job is fixing git or a
  stale lock. The archive was never verified and nothing was rescued; the
  worktree is retained, and the `console.error` lines from the failed attempts
  carry the underlying cause. Full mechanism: §Cleanup's archive check. Once
  git or the lock is fixed, the way out is "Retry cleanup" on the dashboard),
  `limit_retries_exhausted` (`console/src/runwatch.ts` when the usage-limit
  auto-resume loop hits `max_limit_resumes`),
  `api_retries_exhausted` (`console/src/runwatch.ts` when a post's transient
  api_error auto-retries hit `max_api_retries` — a connection that keeps
  dropping is a condition for a human, not a blip to ride out),
  `interrupted_retries_exhausted` (`console/src/runwatch.ts` when a post's
  killed runs were restarted `max_interrupt_retries` times, default 2).
- **Both sides** (overlap — a `parked` event with one of these reasons could
  have come from either side): `wp_auth_failed` is emitted by the run (auth
  probe fails during staging) AND appended by the console
  (`console/src/recover.ts` `detectWpGoLive` when a status-poll auth call
  fails); `other` is emitted by the run (any unclassified would-be question)
  AND appended by the console (`console/src/publish.ts` — e.g. a post with no
  PR number recorded, or a PR/merge failure during publish/approve).

`paused_limit` (Event vocabulary table) is likewise console-only/SYNTHETIC —
an event, not a park reason.

## Verification handshake

- `CONSOLE_VERIFICATION=on`: a fresh `autopilot` run completes staging file
  layout but performs NO staging side effects (no PR, no WP draft, no
  `pr-monitor.json`); it emits `ready_for_verification` and exits. The console
  verifies, then spawns `autopilot-cont`, which performs the side effects and
  emits `pr_opened`.

  **`ready_for_verification` IS the terminal event — do NOT also emit `done`.**
  Exiting cleanly after the hand-off is not a "mode's terminal success"; the
  mode has not succeeded yet, it has handed off. The console derives a run's
  status from its LAST event (`console/src/runwatch.ts` `deriveRunStatus`), so
  a trailing `done` reads as `awaiting_approval`: verification never fires,
  `autopilot-cont` is never spawned, and the post sits approvable-looking on
  the dashboard with a pushed branch but NO PR and NO WP draft. Emit exactly:

  ```
  {"type":"ready_for_verification","slug":"<slug>","ts":"<iso8601>"}
  ```

  and nothing after it. (The console now also scans back past a stray `done`
  to an unconsumed `ready_for_verification` and re-derives `verifying`, but
  that is a backstop for a contract violation, not a licence to emit both.)
- `CONSOLE_VERIFICATION=off` (or unset with `CONSOLE_RUN_STATE` set): the
  fresh run stages fully and emits `pr_opened` itself.

**What counts as "staging FILE LAYOUT" vs a "SIDE EFFECT" (the split the
handshake turns on).** The fresh run's worktree work — copying the draft to
`{content_dir}/<slug>.md`, resolving `[IMAGE:]` embeds, setting the cover,
and the worktree `git commit` + `git push` of the branch — is part of the
staging FILE LAYOUT and IS performed even under `CONSOLE_VERIFICATION=on`
(the branch must exist and be pushed for the console to check it out and
verify it). The deferred SIDE EFFECT is specifically the **PR-open**
(`gh pr create`) / **WP-draft-create** and the `pr-monitor.json` write — those
are what `autopilot-cont` performs after a verification PASS, and only those
are held back under `CONSOLE_VERIFICATION=on`. So "no staging side effects"
does NOT mean "no commit/push": the commit+push happen; the PR/WP-draft do not.

**`autopilot-revise` obeys the SAME handshake.** Like a fresh `autopilot`
run, an `autopilot-revise` run under `CONSOLE_VERIFICATION=on` re-stages the
file layout (re-commit + re-push its worktree branch) and then emits
`ready_for_verification` and exits — it must NOT emit `pr_opened` or perform
the PR-open / WP-draft side effect itself. The console verifies the revised
staging and spawns `autopilot-cont` to perform the side effect, exactly as
for a fresh run. Only under `CONSOLE_VERIFICATION=off` does a revise run
carry staging through to `pr_opened` (or, when the PR already exists, its
`done` per the mode's terminal).

## Gate 2 under the console

When `CONSOLE_RUN_STATE` is set, Gate 2 is **console-gated**: the run
never starts its own CronCreate PR monitor and never blocks on typed input.
(This is the CONSOLE's own approval surface — the dashboard Approve button —
not a second publish path. Staging still opens the PR.)
Approval is data: the console writes `{drafts_dir}/<slug>/approval.json`
(`{"gate": 2, "approved_by": "<operator>", "mode": "schedule"|"now",
"ts": "<ISO>"}`) before finalize; finalize verifies it exists. No launch arg,
event, or standing instruction substitutes for it. The console never sends
WordPress `status=publish`.

### The publish date is the console's to write, not the run's

The run writes a `date:` / `pubDate:` into the post's frontmatter when it drafts,
and that value is a placeholder. Immediately before merging the content PR, and
after the terminal-archive push (which is what fast-forwards the post worktree),
the console rewrites it to TODAY on the post's branch, commits it pathspec-scoped
to the one content file, and pushes:
`console/src/publish-date.ts`, `ensurePublishDateStamped`.

WHY IT CANNOT BE THE RUN'S. Under `astro-git-pr` the merge commit is the
published post, so the date a reader sees is whatever the branch carried at merge
time. A post drafted on the 1st and approved on the 27th shipped dated the 1st:
sorted into the archive as three weeks old and stale on arrival in every feed.
Gate 2 is the only moment that knows the real publication day, and Gate 2 belongs
to the console. `wordpress-rest` does not have the problem (wp-admin stamps the
real moment and ignores this field), but its repo copy is the canonical archive
of what shipped, so it is stamped on the same path.

A run must therefore NOT treat the drafted date as final, and must not re-assert
it after Gate 2. Nothing else about the file is touched.

NOT FINDING A DATE IS NOT A FAILURE. No worktree, no content file at
`{content_dir}/<slug>.md`, no date key, or a value that does not start
`YYYY-MM-DD`: each is logged and the merge proceeds with the drafted date,
because refusing to merge an approved, reviewed PR over a frontmatter field is
the worse outcome. A push that actually FAILS parks the post (`other`,
deliberately not the reclaimable `merge_failed`, since a mergeable PR says
nothing about whether the date reached the branch), and the merge is never
attempted.
