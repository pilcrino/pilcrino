---
name: generate-images
description: Dispatches every image slot in a blog post's {drafts_dir}/<slug>/images.md plan to its type's adapter (adapters/images/<type>.md). Renders `remotion` and `ai-prompt` (codex) slots to files under {assets_dir}/<slug>/, idempotently (skips slots whose file already exists on disk, so a resume run only produces the missing subset); records the pending disposition for `screenshot` slots (a human executes those). Enforces the asset-directory ownership guard (`.staged-by-blog-workflow` sentinel; halts if a published post already owns the slug, or if the asset dir exists without the sentinel). Returns a JSON manifest of per-slot outcomes. Invoked by the `image-builder` agent with `slug=<slug>` at Stage 4a.5.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# generate-images

You dispatch every image slot for one blog post to its strategy's adapter and return a JSON manifest of outcomes. Invoked by `${CLAUDE_PLUGIN_ROOT}/agents/image-builder.md` with `slug=<slug>`.

Derive `REPO=$(git rev-parse --show-toplevel)` before touching any path below; every path in this doc is relative to `$REPO`. Never hardcode an absolute path, a hardcoded path silently reads/writes the main checkout when the actual work is happening in a git worktree.

## 1. Read inputs

- Read `blog-ops/config.yaml` (the config preamble): resolve `{drafts_dir}`, `{assets_dir}`, `{profile_dir}`, `{remotion_dir}`, `{content_dir}`, and the `images.enabled` value.
- Read `{drafts_dir}/<slug>/images.md`, your work list: the `## Featured image` block plus every `### Image N` entry under `## In-post images`.

If either file is missing, stop and report which one; never fabricate a manifest from an incomplete read.

## 2. Ownership guard (BEFORE any render)

Check the following guards in order; stop at the first match.

1. **Published-post guard (checked first).** If `{content_dir}/<slug>.md` (or the WordPress-equivalent published post) exists on `origin/{git.base_branch}` (run `git fetch origin "$BASE"`, then `git cat-file -e "origin/$BASE:{content_dir}/$SLUG.md"`) AND is not in draft state: a published post already owns this slug. A copy in the working tree alone is the in-progress post, not a published one. Return the manifest with top-level `"halt": true` and every result array empty. Do not render, do not touch the asset dir.
2. **Asset dir absent.** If `{assets_dir}/<slug>/` does not exist: create it, then write a sentinel file `{assets_dir}/<slug>/.staged-by-blog-workflow` containing `<slug>` and the current UTC timestamp (`date -u +%Y-%m-%dT%H:%M:%SZ`). Proceed to Step 3.
3. **Asset dir present with sentinel.** If `{assets_dir}/<slug>/` exists AND contains `.staged-by-blog-workflow`: it's ours (a prior run of this skill created it, or is resuming). Proceed to Step 3.
4. **Asset dir present without sentinel.** If `{assets_dir}/<slug>/` exists WITHOUT the sentinel (a manually created folder, a published post's assets, or an unrelated abandoned run): STOP. Do not render into it, do not delete anything. Return the manifest with top-level `"halt": true` and every result array empty.

## 3. Validate every slot's type

For every slot (featured + each in-post entry), confirm its `Type:` is a member of this blog's `images.enabled` (config). A slot whose `Type:` is NOT in `images.enabled` is a planner bug, the image-planner should never assign a disabled type: record it under `failed` with reason `"type '<type>' not in images.enabled"` and continue with the rest of the slots. A single bad slot never halts the whole run.

## 4. Dispatch per slot

For every remaining valid slot, dispatch to the matching adapter procedure at `${CLAUDE_PLUGIN_ROOT}/adapters/images/<type>.md`:

| `Type:` | Adapter | Produces a file? | Manifest bucket on success |
|---|---|---|---|
| `remotion` | `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md` | yes | `rendered` |
| `ai-prompt` | `${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md` | yes | `rendered` |
| `screenshot` | `${CLAUDE_PLUGIN_ROOT}/adapters/images/screenshot.md` | no | `screenshot_pending` |

**Idempotent resume (file-producing types only).** Before dispatching a `remotion` or `ai-prompt` slot, check whether `{assets_dir}/<slug>/<Suggested filename>` already exists on disk and is non-empty. If it does, skip generation entirely and record the slot directly under `rendered` (treat it as already done); do not re-render, do not re-call the API, do not re-run codex. A resume run therefore produces only the missing subset of file-producing slots, this is the pipeline's crash-resume guarantee (spec §6.3): if a prior run rendered 3 of 5 file-producing slots before an interruption, re-running this skill renders only the other 2.

`screenshot` slots are never subject to this file-existence check, they never produce a file through this skill regardless of prior runs; a resume simply re-records them under `screenshot_pending`.

**Per-slot failure isolation.** If a `remotion` or `ai-prompt` generation attempt fails, record the slot under `failed` with a reason and continue dispatching the remaining slots, never abort the whole run because one slot failed. `ai-prompt` failures use the prompt-intact fallback contract (`${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md` §Disposition): the slot is recorded under `failed` (so the caller knows the automated attempt didn't produce a file) AND its `Prompt:` field remains a valid, pasteable prompt in `images.md` (so a human can still produce the image by hand), this is one slot in one bucket whose spec stays fully actionable, never a pipeline blocker. For `ai-prompt`, "codex not on PATH / not logged in" is a normal failure reason (headless or cron sessions may lack a codex login).

## 5. Return the manifest

Your final message is ONLY this JSON (no prose):

```json
{
  "slug": "<slug>",
  "rendered": ["featured.png", "<in-post-filename>.png", "<ai-prompt-filename>.png"],
  "prompt_pending": [],
  "screenshot_pending": ["<screenshot-filename>.png"],
  "failed": [{"filename": "<name>", "reason": "<why>"}],
  "halt": false
}
```

On a halted run (Step 2 stopped you): `{ "slug": "<slug>", "rendered": [], "prompt_pending": [], "screenshot_pending": [], "failed": [], "halt": true }`.

`prompt_pending` is a legacy bucket (pre-v0.4.0, when `ai-prompt` was the manual strategy): no slot type maps to it anymore, keep it in the JSON always empty. A failed codex generation goes under `failed`.

## What you don't do

- You don't inspect the rendered PNGs for visual correctness, that mandatory eyeball pass belongs to the calling `image-builder` agent (and to each file-producing adapter's own checklist, which the agent runs). You dispatch and report outcomes; you don't grade them.
- You don't touch `{drafts_dir}/<slug>/images.md`, it is a read-only work list for this skill.
- You don't update `action-items.md` or `checklist.md`, the editor/orchestrator does that after reading your manifest.
