# PR monitor opt-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the blog-post-workflow PR monitor cron opt-in (`review.pr_monitor`, default `false`) and make the Gate 2 to finalize path work in one session without it.

**Architecture:** The plugin is mostly markdown instructions read by Claude; behaviour changes are text changes in `SKILL.md`, `personas/editor.md`, the adapters and `pr-monitor.md`, pinned by `need`/`absent` anchors in `tests/check_page_anatomy.sh`. The one data-risky part (moving a post's drafts folder into an archive that may already exist, and pulling over a local archive) becomes a small Node script with real tests, which the docs call.

**Tech Stack:** Markdown skill docs, Node 22 (`node:test`, no dependencies), bash anatomy checks, `gh`.

**Spec:** `docs/superpowers/specs/2026-10-23-pr-monitor-opt-in-design.md`

## Global Constraints

- Key: `review.pr_monitor`, boolean, default `false` (absent = `false`).
- With it `true`, today's monitor behaviour is unchanged except the self-stop on `false`.
- With it off, nothing reads or replies to GitHub comments or reviews.
- An owner merge counts as approval only when `mergedBy.login` equals `gh api user -q .login`.
- No em dashes or en dashes as sentence breaks anywhere (docs, copy, commit messages).
- Never edit anything outside this worktree. Branch: `feat/pr-monitor-opt-in`.
- Plugin version `0.59.0` in `.claude-plugin/plugin.json`, with a README changelog entry.
- Scripts are plain Node, no dependencies (the plugin ships no `node_modules`).

## Review Focus

1. `gh` offline or signed out when the session reads the PR state before acting on a reply: it must not treat "unknown" as merged or open-and-safe. Expected: say GitHub can't be reached and push nothing until it can. Pinned in Task 3.
2. A merge with no `mergedBy` (merge queue, bot, a deleted account): not the owner, so the approve-only prompt. Pinned in Task 4.
3. The setting flipped to `true` while a banner is already waiting with the monitor off: no cron appears mid-gate. Expected: it takes effect at the next Gate 2 entry or resume. Pinned in Task 2.
4. Approve typed while the staging checks are still inside the bounded wait: the reply waits for the re-check, then acts. Pinned in Task 3.
5. `retire` run twice (a crash after the merge, before the source was removed): the second run finishes without nesting or losing files. Pinned in Task 5's tests.

---

### Task 0: Commit the reviewed spec

- [ ] **Step 1:** `git add docs/superpowers && git commit -m "docs: PR monitor spec after three review rounds, and its plan"` (with the Co-Authored-By line). Do not push: the owner decides what happens to draft PR #26.

### Task 1: The config key

**Files:**
- Modify: `skills/blog-setup/scripts/validate-config.mjs:177` (the `typeErrors(review, …)` spec)
- Modify: `skills/blog-post-workflow/references/config-schema.md` (YAML block near line 157, the `review.plan_approval` description near 245, invariant 11 near 349)
- Test: `skills/blog-setup/scripts/validate-config.test.mjs`

**Interfaces:**
- Produces: `review.pr_monitor` is a valid boolean key; error text `review.pr_monitor must be true or false`.

- [ ] **Step 1: Write the failing tests** next to the test at line 191, using the existing `run(repo(ASTRO.replace(...)))` pattern:
  - `'review.pr_monitor true passes check 11'`: replace `'review:\n  plan_approval: ask'` with `'review:\n  plan_approval: ask\n  pr_monitor: true'`, assert exit 0.
  - `'review.pr_monitor false passes check 11'`: same with `false`, assert exit 0.
  - `'review.pr_monitor as a word fails check 11 in plain words'`: value `yes please`, assert exit non-zero and `/review\.pr_monitor must be true or false/`.
  - Absent is already covered by `'a complete Astro config passes all 16 checks, exit 0'` (the fixture has no `pr_monitor`); leave it.
- [ ] **Step 2:** `node --test skills/blog-setup/scripts/validate-config.test.mjs`. Expected: the two pass-cases FAIL with `review.pr_monitor is not a setting Pilcrino knows`.
- [ ] **Step 3:** Change the review spec to `{ plan_approval: ['ask', 'auto'], pr_monitor: 'boolean' }`. In `config-schema.md`: add `  pr_monitor: false           # OPTIONAL boolean, default false. true: watch the post's pull request on a timer and act on comments there; false: Gate 2 waits in the session` under `plan_approval` in the YAML block; add a paragraph starting `**\`review.pr_monitor\`** (\`true\` | \`false\`, default \`false\`)` after the `plan_approval` one, stating both behaviours and that the app's runs ignore it; add `pr_monitor` (boolean) to invariant 11's list.
- [ ] **Step 4:** Run the test file again, then `./tests/lint.sh`. Expected: all PASS (lint also parses the schema's YAML blocks).
- [ ] **Step 5:** Commit `feat(config): review.pr_monitor, off by default`.

### Task 2: Gate 2 starts the cron only when asked

**Files:**
- Modify: `skills/blog-post-workflow/SKILL.md` Step 15.1 (line ~1200), Step 15.2 `pause` bullet (~1210), Step 15.3 step 1 (~1217), Step 16 intro (~1321)
- Modify: `personas/editor.md` staging step 6 (~428) and §Gate 2 (~436 to 470, the "This gate is asynchronous" sentence and the banner)
- Modify: `adapters/publish/astro-git-pr.md:229`, `adapters/publish/markdown.md:91`, `skills/blog-post-workflow/references/pr-monitor.md` header (line 3)
- Test: `tests/check_page_anatomy.sh` (new block `# 0.59.0: PR monitor opt-in`)

**Interfaces:**
- Produces: the phrase `review.pr_monitor: true` as the only condition under which any doc says to `CronCreate`.

- [ ] **Step 1: Write the failing anatomy checks:**
  ```bash
  # 0.59.0: PR monitor opt-in
  need skills/blog-post-workflow/SKILL.md 'Start the PR-comment monitor cron only when `review.pr_monitor: true`'
  absent skills/blog-post-workflow/SKILL.md 'always start the PR-comment monitor cron'
  absent personas/editor.md 'starting the Gate-2 monitor cron are unconditional'
  need personas/editor.md 'tell me here what to change and I address it'
  need skills/blog-post-workflow/SKILL.md 'A change to `review.pr_monitor` takes effect at the next Gate 2 or resume'
  need skills/blog-post-workflow/references/pr-monitor.md 'Runs only when `review.pr_monitor: true`'
  # every CronDelete outside pr-monitor.md and the console-gated section is conditional
  for f in adapters/publish/astro-git-pr.md adapters/publish/markdown.md; do
    grep -n 'CronDelete\|monitor cron' "$f" | grep -v 'pr_monitor' | grep -q . && { echo "ANATOMY FAIL: $f: unconditional cron step" >&2; fail=1; }
  done
  ```
- [ ] **Step 2:** `bash tests/check_page_anatomy.sh`. Expected: FAIL on each new line.
- [ ] **Step 3: Edit the docs.**
  - Step 15.1: replace the "always start" sentence with the conditional one above; with it off, no `CronCreate`, the banner is shown and the session waits for APPROVE, REQUEST CHANGES, PAUSE or "merge it". Drop "Gate 2 no longer blocks on an in-session answer" for the off case. Keep the retro nudge in the banner, and add it to Step 15.5's closing message when finalize ran in this session.
  - Add the "takes effect at the next Gate 2 or resume" sentence (Review Focus 3).
  - `pause`, Step 15.3 step 1, `astro-git-pr.md:229`, `markdown.md:91`: `CronDelete` only when a cron was started (`review.pr_monitor: true`); otherwise skip silently.
  - `editor.md` step 6: opening the review surface stays unconditional; the monitor cron is started only under `review.pr_monitor: true`. §Gate 2: the "asynchronous" sentence applies only with the monitor on. Banner: "On approve" item 1 reads `Stop the review-surface monitor cron (only when \`review.pr_monitor: true\` started one)`; with the monitor off, the comments sentence is `Until then, tell me here what to change and I address it.`
  - `pr-monitor.md` header: add `Runs only when \`review.pr_monitor: true\`` (opt-in, default off).
  - Step 16 intro: "While the post's PR is open and `review.pr_monitor: true`, a cron…".
- [ ] **Step 4:** `bash tests/check_page_anatomy.sh && ./tests/lint.sh`. Expected: `ANATOMY OK`, lint clean.
- [ ] **Step 5:** Commit `feat(workflow): Gate 2 starts the PR monitor only under review.pr_monitor: true`.

### Task 3: The in-session Gate 2 loop (monitor off)

**Files:**
- Modify: `skills/blog-post-workflow/SKILL.md` Step 15.2 (add a `**Monitor off (\`review.pr_monitor\` false or absent).**` paragraph before the existing PR-path one, which becomes "Monitor on")
- Modify: `adapters/publish/astro-git-pr.md` §Staging steps 8 and 9 (~207 to 212) and §On review-loop edit (~216 to 221)
- Modify: `adapters/publish/wordpress-rest.md` §On review-loop edit (~232 to 247)
- Test: `tests/check_page_anatomy.sh`

**Interfaces:**
- Consumes: Task 2's off branch in Step 15.1.
- Produces: the named rules `**Worktree first.**`, `**Staging re-check (monitor off).**` and `**PR state before each reply.**`, referenced by Tasks 4 and 5.

- [ ] **Step 1: Write the failing anatomy checks:**
  ```bash
  need skills/blog-post-workflow/SKILL.md '**Monitor off (`review.pr_monitor` false or absent).**'
  need skills/blog-post-workflow/SKILL.md '**PR state before each reply.**'
  need skills/blog-post-workflow/SKILL.md "I can't reach GitHub right now, so I haven't changed anything"
  need skills/blog-post-workflow/SKILL.md '**Worktree first.**'
  need skills/blog-post-workflow/SKILL.md 'never `mkdir` the worktree path'
  need skills/blog-post-workflow/SKILL.md '**Staging re-check (monitor off).**'
  need skills/blog-post-workflow/SKILL.md 'staging deploy failed'
  need adapters/publish/wordpress-rest.md 'The post is live in WordPress, so I left it alone; make this change in WordPress.'
  need adapters/publish/astro-git-pr.md 'no reply on the PR and no `handled:` marker'
  ```
- [ ] **Step 2:** Run the anatomy check. Expected: FAIL on each.
- [ ] **Step 3: Edit the docs.**
  - **PR state before each reply:** before acting on any Gate 2 reply, `gh pr view <n> -R <repo> --json state,mergedBy`. MERGED: Task 4's route. Command fails (offline, signed out): reply `I can't reach GitHub right now, so I haven't changed anything. Tell me again once you're online.` and push nothing (Review Focus 1). OPEN: act on the reply.
  - **Worktree first:** every off-path entry that touches the branch (resume, approve, change request) resolves the recorded worktree as `pr-monitor.md` step 1 does, verifies `git -C "$WT" rev-parse --abbrev-ref HEAD` is the recorded branch, and stops with one plain sentence when it can't; it must never `mkdir` the worktree path.
  - **Change requests in chat:** the adapter's `## On review-loop edit`, with no reply on the PR and no `handled:` marker; result reported in chat. `wordpress-rest`: read the WordPress status first (the `pr-monitor.md` step 2 call); `publish` → the exact sentence above, no sync.
  - **Staging re-check (monitor off):** before the banner and after each in-chat push, wait for the PR head's checks, bounded at 10 minutes (`timeout 600 gh pr checks <n> -R <repo> --watch`), then run §Staging steps 8 and 9 once against the then-current head. No verified preview for any reason → banner says `staging deploying` or `staging deploy failed`, `Layout: pending`, and the session re-checks once at each later reply before acting on it; an approve arriving mid-wait waits for that re-check (Review Focus 4). Approve with the preview still unverified goes ahead; the closing message says `Layout: not checked`. `wordpress-rest`: no wait (its preview exists at once). `markdown`: unchanged.
- [ ] **Step 4:** Anatomy and lint pass.
- [ ] **Step 5:** Commit `feat(workflow): Gate 2 runs in the session when the monitor is off`.

### Task 4: An owner merge counts as approval (monitor off)

**Files:**
- Modify: `skills/blog-post-workflow/SKILL.md` Step 2 routing table (rows at ~215 to 220), Step 15.3 (merged-PR approve), Step 16.5 steps 2 and 7
- Test: `tests/check_page_anatomy.sh`

**Interfaces:**
- Consumes: Task 3's `**PR state before each reply.**`; Task 5's `retire` and `pull` commands (Task 4 docs refer to them by name; Task 5 lands the script and the doc wiring).
- Produces: the named rule `**Owner merge (monitor off).**`.

- [ ] **Step 1: Write the failing anatomy checks:**
  ```bash
  need skills/blog-post-workflow/SKILL.md '**Owner merge (monitor off).**'
  need skills/blog-post-workflow/SKILL.md 'gh pr view <pr_number> -R <repo> --json mergedBy -q .mergedBy.login'
  need skills/blog-post-workflow/SKILL.md 'gh api user -q .login'
  need skills/blog-post-workflow/SKILL.md 'merged the pull request. Say "approve" here and I'"'"'ll finish the post.'
  need skills/blog-post-workflow/SKILL.md 'PR MERGED by the owner, `review.pr_monitor` off'
  need skills/blog-post-workflow/SKILL.md '**Finalize first (monitor off).**'
  ```
- [ ] **Step 2:** Run the anatomy check. Expected: FAIL.
- [ ] **Step 3: Edit the docs.**
  - **Owner merge (monitor off):** a MERGED PR is approval only when the two commands above print the same login. An empty or different `mergedBy` (merge queue, bot, another account: Review Focus 2) → `<login or "Someone else"> merged the pull request. Say "approve" here and I'll finish the post.`, with no REQUEST CHANGES offered. Owner merge → Step 15.3 with the console-merge entry's adjustments (a) to (d), then the merge-date check, then the "Merged" closing message. Writes no `approved_head`.
  - Step 2 table: new row `finalize` / `gate_2_final` / `PR MERGED by the owner, \`review.pr_monitor\` off` → the owner-merge finalize. Split the "resume the PR monitor" row: on → as today; off → **Worktree first**, **Staging re-check**, banner, wait. Off with `wordpress-rest` status `publish` → the external-publish finalize, as the monitor does today.
  - Step 15.3: an approve on a PR already MERGED runs the console-merge adjustments (a) to (d); here the in-session approve writes `approved_head` as usual.
  - Step 16.5 **Finalize first (monitor off):** a post not archived yet whose PR is MERGED by the owner runs the owner-merge finalize before step 3; `wordpress-rest` with status `publish` and the post not finalized runs the external-publish finalize (`wordpress-rest.md` §On Gate 2 approval, sync skipped). Step 7 never offers to delete a branch whose PR is still open.
- [ ] **Step 4:** Anatomy and lint pass.
- [ ] **Step 5:** Commit `feat(workflow): with the monitor off, the owner's own merge approves the post`.

### Task 5: Archive operations that never nest or collide

**Files:**
- Create: `skills/blog-post-workflow/scripts/archive-draft.mjs`
- Test: `skills/blog-post-workflow/scripts/archive-draft.test.mjs` (CI already runs `node --test skills/blog-post-workflow/scripts/*.test.mjs`)
- Modify: `skills/blog-post-workflow/SKILL.md` Step 15.3 step 3 and the recovery row at ~219 ("Step 15.3 PR finish from the `mv`"), Step 16.5 step 3
- Modify: `adapters/publish/astro-git-pr.md:247` (the `mv` in §On Gate 2 approval step 3), and the matching step in `markdown.md` / `wordpress-rest.md` if they restate the `mv`

**Interfaces:**
- Produces, CLI (stdout one JSON line, exit codes as listed):
  - `node archive-draft.mjs retire --src <drafts>/<slug> --dest <drafts>/_archive/<slug>` → `{"action":"moved"|"merged"|"already-retired"}`; exit 0. Exit 2: neither folder exists. Exit 1: verification failed (source and backup kept, both paths in the message).
  - `node archive-draft.mjs pull --repo <blog root> --archive <drafts>/_archive/<slug> --base <branch>` → `{"pulled":true,"archiveRestored":bool,"changed":[repo-relative paths]}`; exit 0. Exit 3: not on `<base>`. Exit 4: the pull is blocked by files outside the archive, JSON `{"blocked":[paths]}`, nothing changed. Exit 1: any other git failure, git's stderr passed through.
- Exported for tests: `retire(src: string, dest: string): {action: string}`, `pullWithArchive(opts: {repo: string, archive: string, base: string}): {pulled: boolean, archiveRestored: boolean, changed: string[]}`.

- [ ] **Step 1: Write the failing tests** (temp dirs via `mkdtempSync`; git tests use a bare `origin` plus a clone, as `competitor-profiles.test.mjs` does):
  - `retire moves the folder when the archive is absent`: dest exists afterwards with the source files, src gone, action `moved`.
  - `retire merges into an existing archive without nesting`: dest pre-seeded with `checklist.md` "early" and `README.md`; src has `checklist.md` "final", `research/_raw/serp.json`, `_backup/post.md`. After: dest `checklist.md` reads "final", `README.md` still there, both local-only files present, no `dest/<slug>` dir, no `*.backup-*` sibling left, src gone, action `merged`.
  - `retire twice finishes the job` (Review Focus 5): run once with src partly copied into dest by hand, then retire; then retire again → `already-retired`, exit 0.
  - `retire with neither folder exits 2`.
  - `pull restores a local archive the merge also carries`: origin's base has `_archive/s/checklist.md` "early"; the clone has an untracked local `_archive/s/` with `checklist.md` "final" and `research/_raw/a.json`. After: exit 0, the clone is at origin's head, `checklist.md` reads "final", `a.json` exists, `changed` lists `<archive>/checklist.md`, no `.aside-` folder left.
  - `pull off the base branch exits 3 and changes nothing`.
  - `pull blocked by another file exits 4 and lists it`: an untracked `src/content/blog/s.md` that the merge adds.
- [ ] **Step 2:** `node --test skills/blog-post-workflow/scripts/archive-draft.test.mjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** in the style of `competitor-profiles.mjs` (header comment naming the spec, `spawnSync` git helper, `UsageError`). `retire`: dest absent → `renameSync`; dest present → `cpSync(dest, dest + '.backup-' + stamp, {recursive:true})`, `cpSync(src, dest, {recursive:true, force:true})`, check every file under src exists in dest byte-equal, then `rmSync(src)` and the backup; on mismatch exit 1 keeping both. `pull`: branch check; `git pull --ff-only origin <base>`; on failure parse git's "would be overwritten" path list; all under the archive → `renameSync(archive, archive + '.aside-' + stamp)`, pull again, `cpSync(aside, archive, {recursive, force})`, verify, remove aside, `changed` from `git status --porcelain -- <archive>`; any path outside → exit 4 untouched.
- [ ] **Step 4:** Run the test file. Expected: all PASS.
- [ ] **Step 5: Wire the docs.** Step 15.3 step 3 and `astro-git-pr.md:247` say `**Retire the source.**` and run `node "${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/scripts/archive-draft.mjs" retire …` in place of the `mv`. The ~219 recovery row reads `Step 15.3 PR finish from **Retire the source**`. Step 16.5 step 3 runs `archive-draft.mjs pull` first; exit 4 falls through to today's cmp-and-remove rules for the listed files, then runs `pull` again; `changed` files are committed (`chore(content): <slug> archive final`) and pushed under `git.push_without_asking`. Anatomy checks:
  ```bash
  need skills/blog-post-workflow/SKILL.md '**Retire the source.**'
  need skills/blog-post-workflow/SKILL.md 'scripts/archive-draft.mjs" retire'
  need skills/blog-post-workflow/SKILL.md 'scripts/archive-draft.mjs" pull'
  need adapters/publish/astro-git-pr.md 'scripts/archive-draft.mjs" retire'
  absent skills/blog-post-workflow/SKILL.md 'Step 15.3 PR finish from the `mv`'
  ```
- [ ] **Step 6:** `node --test skills/blog-post-workflow/scripts/*.test.mjs && bash tests/check_page_anatomy.sh && ./tests/lint.sh`. Expected: all pass.
- [ ] **Step 7:** Commit `feat(workflow): archive-draft retire and pull, so a merged PR's archive never nests or blocks a pull`.

### Task 6: Monitor self-stop, setup question, retro, README, version

**Files:**
- Modify: `skills/blog-post-workflow/references/pr-monitor.md` §Each firing step 1
- Modify: `skills/blog-setup/SKILL.md` §Two standing decisions (~2942 to 2985), the summary and the YAML block
- Modify: `skills/blog-retro/SKILL.md:49` (PR review feedback source)
- Modify: `README.md` (feature text that says the monitor always runs; changelog), `.claude-plugin/plugin.json`
- Test: `tests/check_page_anatomy.sh`

- [ ] **Step 1: Write the failing anatomy checks:**
  ```bash
  need skills/blog-post-workflow/references/pr-monitor.md 'When `review.pr_monitor` is now `false`, `CronDelete` this cron and exit.'
  need skills/blog-setup/SKILL.md '### Three standing decisions (every blog)'
  need skills/blog-setup/SKILL.md 'Watching the pull request → `review.pr_monitor`'
  need skills/blog-setup/SKILL.md '"No, I'"'"'ll approve here" (default) → `false`'
  need README.md '### 0.59.0 - The pull request monitor is opt-in'
  need .claude-plugin/plugin.json '"version": "0.59.0"'
  ```
  and delete the old `need .claude-plugin/plugin.json '"version": "0.58.2"'` line.
- [ ] **Step 2:** Run the anatomy check. Expected: FAIL.
- [ ] **Step 3: Edit.**
  - `pr-monitor.md` step 1: after the `done`/`closed` self-heal, read `review.pr_monitor` from `{ops_dir}/config.yaml`; add the sentence above.
  - Setup: third decision with the spec's question and both answers and read-backs verbatim (spec §Setup); detailed path asks it after plan approval; quick path omits the key (default off) and shows `Watching the pull request: no` in the summary, where a correction is kept; YAML block gains `pr_monitor: <true | false>` under `review:`.
  - Retro: PR review feedback is the primary source only when `pr-monitor.json` shows the monitor ran (`last_poll` present); otherwise the conversation is primary and PR feedback is read as reinforcement.
  - README: fix every line that says the monitor always runs (grep `monitor`); changelog entry `### 0.59.0 - The pull request monitor is opt-in` at the top: the key and default, what Gate 2 does with it off, the owner-merge rule, the archive script. Bump `plugin.json` to `0.59.0`.
- [ ] **Step 4:** Full suite: `./tests/lint.sh && node --test skills/blog-setup/scripts/*.test.mjs skills/blog-post-workflow/scripts/*.test.mjs adapters/publish/scripts/*.test.mjs`. Expected: all pass.
- [ ] **Step 5:** Commit `feat: PR monitor opt-in, setup question, docs (0.59.0)`.

### Task 7: Acceptance run on a throwaway blog

Text anchors prove the words are there, not that Claude follows them. This task runs the real flow. Use a throwaway GitHub repo with an Astro blog set up by `/pilcrino:blog-setup` from this branch (`claude --plugin-dir <this worktree>`), never a live blog, never `~/.pilcrino`.

- [ ] **Case A, default off:** run a short post to Gate 2. Pass: no `CronCreate` in the transcript, the banner says `tell me here what to change`, a chat change is pushed with no PR comment, `approve` finalizes in-session, and the archive is in `_archive/<slug>/` with no nested folder.
- [ ] **Case B, owner merge then resume:** second post to Gate 2, merge on GitHub, end the session, `resume <slug>` in a fresh one. Pass: finalize with no banner, merge-date check ran, archive pulled and restored, raw captures present.
- [ ] **Case C, on:** set `review.pr_monitor: true`, third post to Gate 2. Pass: cron created; then set it to `false` and wait one firing. Pass: the cron deleted itself.
- [ ] Record results (pass/fail per case, transcript paths) in the PR description. Any fail goes back to the owning task.
