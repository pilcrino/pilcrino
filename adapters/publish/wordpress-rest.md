# WordPress REST publish adapter

Read by: `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/SKILL.md` at Stage 4b.5 (staging), during the review loop, at Gate 2 approval, and on abandon — for any blog whose `config.yaml` sets `publish.adapter: wordpress-rest`. The workflow dispatches to this doc by the exact H2 section names below. Also read by `${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/SKILL.md` at setup time (existing-blog research), which runs `## Site inspection (setup-time)` below exactly once, before any post workflow exists for this blog.

## Config inputs

| Variable | Source |
|---|---|
| `{content_dir}` | `publish.wordpress.content_dir` — canonical finalized markdown lives here in the workspace repo (WordPress is not the source of truth; the repo is) |
| `{assets_dir}` | `publish.wordpress.assets_dir` — local store for generated images pre-upload |
| `publish.wordpress.base_url` | e.g. `https://yourblog.com` |
| `publish.wordpress.username` | WordPress username for the application password |
| `publish.wordpress.app_password_env` | env var NAME holding the WordPress application password, never the secret itself |
| `publish.wordpress.default_status` | always `draft` in v1 — this adapter never sets a WordPress post beyond `draft`; the human publishes in WP admin |
| `publish.wordpress.frontmatter_template` | the frontmatter contract this post's frontmatter follows: `${CLAUDE_PLUGIN_ROOT}/adapters/publish/frontmatter/wordpress.md` — defines `title`, `excerpt`, `tags`, `authors`; §Staging step 5 below reads those fields to build the create/update request |
| `publish.wordpress.apply_inbound_links_live` | `true`/`false`, default `false` — when true AND this post's WordPress status is `publish` (see `## On Gate 2 approval`), the planned inbound-link rows are applied to LIVE target posts via REST instead of left as a hand-apply action item |
| `{route_prefix}` | `blog.route_prefix` (default `/blog/`) — this blog's post URL prefix; used only by the live inbound-link application below to build/verify the published post's URL |

Every `curl` command below authenticates with HTTP Basic auth using the WordPress username + the application password (resolved from `publish.wordpress.app_password_env` via bash indirect expansion, `${!WP_APP_PASSWORD_ENV}` — never inline the literal secret in a command line or in any logged output):

```bash
WP_USER="{publish.wordpress.username}"
WP_APP_PASSWORD_ENV="{publish.wordpress.app_password_env}"
WP_BASE="{publish.wordpress.base_url}"
```

**If `${!WP_APP_PASSWORD_ENV}` is EMPTY, STOP — do not improvise a way to fetch
it.** Under the console the run inherits the console's environment, which a
`launchd` agent gets from its plist and NOT from your interactive shell. An
empty value is an INSTALLATION fault, not something to route around: sending
`-u "$WP_USER:"` produces a 401 that is indistinguishable from a revoked
password, and reaching into the operator's shell profile (`zsh -lic 'printf %s
"$WP_APP_PASSWORD"'`) makes every run silently depend on a file no part of
this contract mentions — it works until it doesn't, and hides the real defect.
PARK with `wp_auth_failed`, detail `"$<name> is not set in this process"`. The
fix is `console/scripts/install-agent.sh`, which propagates
`publish.wordpress.app_password_env` into the agent's `EnvironmentVariables`;
the console's `wp_auth` preflight check reports the same condition up front.

## Site inspection (setup-time)

Run exactly once by `${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/SKILL.md` (existing-blog research phase), never by `blog-post-workflow` — produces `{profile_dir}/site-conventions.md` (shape: `${CLAUDE_PLUGIN_ROOT}/templates/site-conventions.md`), the per-blog data file every later stage reads instead of guessing at this site's conventions. Requires the WordPress config block already resolved (`publish.wordpress.*`) and its auth already verified — this section never establishes its own credential.

**Auth reuse (load-bearing):** every call below runs read-only, under the SAME application-password credential the wizard already verified once (§Staging step 2's probe below, or the wizard's own equivalent one-shot check at the same point in the setup flow). This section never runs a fresh probe of its own, and never retries a failed call. **On any 401/403 from any call below: STOP immediately — do not retry, do not attempt a second auth check.** Follow the lockout guidance documented at §Staging step 2 below verbatim.

1. **Fetch 1-2 recent posts, in edit context (so `content.raw` is present):**
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" \
     "$WP_BASE/wp-json/wp/v2/posts?context=edit&per_page=2&_fields=content,categories,link"
   ```
   Zero posts returned (brand-new site, nothing to inspect yet) is not a failure — every field below is written as "none yet — no existing posts to inspect" (or a value the human states directly), and the rest of this section is skipped.

2. **Parse block grammar from `content.raw`.** Every `<!-- wp:<name> -->` occurrence names one block type in use. `wp:paragraph` / `heading` / `list` / `list-item` / `image` / `quote` / `code` / `table` are WordPress core blocks — nothing to report beyond "core blocks." Any OTHER `wp:<namespace>/<block>` prefix (a `/` in the name) names a third-party block library — that namespace IS the plugin/theme that registers it; record the concrete name in `## Platform`. This is per-blog DATA written into the blog's own repo, not shared plugin behavior — no other file in this plugin may hardcode a specific block-library name as behavior.

3. **Extract a table-of-contents block, if any.** Scan the parsed blocks for one whose position (near the top, right after the intro paragraph) and content (a linked list of the post's own headings) match a TOC pattern — a core `wp:list` of anchor links, or a third-party block surfaced by step 2's namespace scan. If found in either inspected post, copy its `<!-- wp:... --> … <!-- /wp:... -->` markup EXACTLY (verbatim, inner attributes included) into `## Table of contents`. If neither post has one, write "none" there.

4. **Fetch the full category taxonomy:**
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" \
     "$WP_BASE/wp-json/wp/v2/categories?per_page=100&_fields=id,name,count"
   ```
   List every returned `name` in `## Categories`' taxonomy list. Cross-reference `{profile_dir}/blog.md` §Content pillars (if it already exists) to draft the per-cluster mapping table; leave a row's category blank with a note where no existing category obviously fits — a human confirms this table before it's treated as final.

5. **Detect the SEO plugin generically.** Fetch the site's public homepage (`curl -sf "$WP_BASE/"`, no auth — not a REST call, so it does not fall under the auth-reuse rule above) and look for signatures: a `<meta name="generator" content="...">` tag naming a plugin, plugin-specific asset paths under `/wp-content/plugins/<slug>/`, or a plugin-specific meta/Open-Graph tag set distinguishable from WordPress core's own (bare) output. Name whichever plugin the signatures actually point to in `## SEO plugin` — a real name here is per-blog data, not something any other file in this plugin may hardcode as behavior. If no signature is found, write "none detected." Then determine the focus-keyword mechanism: most third-party SEO plugins do NOT expose their meta-box fields on the standard `wp/v2/posts` schema unless the site has added a REST filter for it — if you can't confirm a working REST field by inspecting the `posts` response schema (`curl -sf "$WP_BASE/wp-json/wp/v2/posts" | jq '.[0] | keys'`, no auth needed for a published post), record "not settable via standard REST" per `## SEO plugin` so the workflow knows to emit a manual action item instead of attempting a REST write.

6. **Read the permalink format from the fetched posts' `link` field.** The URL path between the site root and the post slug is the format (e.g. `/<slug>/`, `/blog/<slug>/`, `/YYYY/MM/<slug>/`). Note whether it ends in `/`. This MUST agree with `blog.trailing_slash` in `config.yaml` — if they disagree, flag it loudly to the human instead of silently picking one; whichever one is wrong needs fixing.

7. **Post furniture.** Fetch the same two posts' public HTML (`curl -sf "<link>"`, no auth needed) and inspect it for an author box, a related-posts block, and any disclosure/affiliate boilerplate near the top or bottom of the article body. Record what's found in `## Post furniture`, noting per element whether it's theme/plugin-automatic (nothing this workflow needs to emit) or content the post body itself must carry.

8. **Write the resolved template.** Fill the resolved `site-conventions.md` (per the layered `{templates}` rule: `blog-ops/templates/site-conventions.md` if the blog has one, else `${CLAUDE_PLUGIN_ROOT}/templates/site-conventions.md`) with the findings above, and save the result to `{profile_dir}/site-conventions.md`. Present it to the human for confirmation before treating it as final — the same "never silently accept" rule the wizard's other pre-filled docs follow.

## Relationship to the git repo

**This adapter still uses the shared git staging (the same branch/worktree/PR mechanics `adapters/publish/astro-git-pr.md` §Staging (Stage 4b.5) steps 6a-6h describe) to commit the finalized markdown into `{content_dir}`** (the PR path is the only publish path; its GitHub precondition is checked at Step 0, per `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §GitHub precondition) — every blog's workspace repo, WordPress included, is the canonical home for the markdown. When following those shared steps, `{content_dir}` and `{assets_dir}` bind to THIS adapter's config block, never the Astro one (a WordPress blog's config has no `publish.astro` block): `$POST = {content_dir}/<slug>.md` and `$ASSETS = {assets_dir}/<slug>`, both bound from `publish.wordpress.content_dir` / `publish.wordpress.assets_dir`. The WordPress-specific steps below (auth probe, media upload, draft create/update) are ADDITIONAL platform steps this adapter defines; they run inside the same Stage 4b.5 staging pass, after the markdown is finalized into `{content_dir}` in the main tree and alongside the git worktree commit.

**PR completeness (when the async PR path is viable):** because this adapter defers to `astro-git-pr.md` §Staging steps 6a-6h VERBATIM, that section's Remotion-composition-source commit and its early research/draft archive snapshot (both added at §Staging step 6c there) apply to this adapter's PR unchanged — nothing WordPress-specific needs restating. The Remotion `.tsx` source files and the archive live in the SAME workspace repo as `{content_dir}` regardless of publish adapter (they are never uploaded to WordPress), so the shared worktree commit is where they ship.

## Staging (Stage 4b.5)

The ordering below is fixed: the WordPress draft is created HERE, at staging, before review — it is the staging preview, mirroring an Astro site's CI-built preview. **This is unconditional, no human approval needed** (standing instruction): never pause to ask before creating the draft.

1. **Finalize the markdown.** `cp` the latest `{drafts_dir}/<slug>/draft-v<N>.md` → `{content_dir}/<slug>.md` in the main tree. Replace `[IMAGE:]` placeholders and set the featured cover exactly as `adapters/publish/astro-git-pr.md` §Staging steps 2 and 3a describe (same file-existence-aware embed logic, same featured-missing halt), then run that same doc's §Staging step 3b visual backstop over every resolved embed before continuing — the finalized markdown is the canonical artifact regardless of publish adapter; only the downstream publish target differs.
2. **Auth probe.** Verify the application password works before doing anything else. Run this probe AT MOST ONCE per run — never retried, never polled:
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" "$WP_BASE/wp-json/wp/v2/users/me" >/dev/null
   ```
   A non-zero exit means the credentials or `WP_BASE` are wrong — stop and report; do not attempt any upload. **Lockout guidance (referenced by every other section in this file that touches auth, including `## Site inspection (setup-time)` below):** on a 401/403, do not retry — a failed WordPress login may have already tripped the host's or a security plugin's login-attempt limiter, keyed to your IP and username. Retrying immediately only extends the lockout. Tell the human to wait it out or clear the limiter in the site's security dashboard, then re-run once, by hand, when ready.
3. **Convert markdown to Gutenberg block markup (PRIMARY).**

   **Build `--extra-blocks` safely when this blog has a recorded TOC.** Read `{profile_dir}/site-conventions.md` §Table of contents. If its fenced block is the literal word `none` (or the file doesn't exist yet), skip this whole sub-step and omit `--extra-blocks` entirely from the command below. Otherwise, the recorded markup was copied byte-for-byte from a real post's `content.raw` and routinely contains double quotes and newlines that would break a hand-pasted inline JSON string — extract the fenced block verbatim into a temp file, then build the JSON with `jq --rawfile`, matching this file's existing jq discipline (see step 5 below); never paste TOC markup into an inline JSON string by hand. The extraction MUST be scoped to the `## Table of contents` section specifically — grabbing the first fenced block in the whole file is only correct by coincidence, since an earlier section (e.g. `## Platform`) may itself contain a fence (the fence below is 4 backticks specifically so the 3-backtick fence marker it greps for can appear literally inside it without closing early):
   ````bash
   awk '/^## Table of contents/{s=1} s&&/^## /&&!/^## Table of contents/{exit} s&&/^```/{f=!f; next} s&&f' "{profile_dir}/site-conventions.md" > /tmp/toc-markup.txt
   # Remove any stale /tmp/extra-blocks.json BEFORE the guard below, so a leftover file from a
   # different blog's (or an earlier run's) staging pass can never leak into this one when the
   # guard condition is false and the jq step underneath is skipped entirely.
   rm -f /tmp/extra-blocks.json
   # empty extraction, or the extraction is literally "none" -> no recorded TOC: skip --extra-blocks entirely (both the flag below and this jq step)
   if [ -s /tmp/toc-markup.txt ] && [ "$(cat /tmp/toc-markup.txt)" != "none" ]; then
     jq -n --rawfile toc /tmp/toc-markup.txt '[{position:"after-intro", markup:$toc}]' > /tmp/extra-blocks.json
   fi
   ````
   ```bash
   if [ -s /tmp/extra-blocks.json ]; then
     python3 "${CLAUDE_PLUGIN_ROOT}/adapters/publish/scripts/md-to-gutenberg.py" \
       "{content_dir}/<slug>.md" \
       --extra-blocks /tmp/extra-blocks.json \
       > "{drafts_dir}/<slug>/<slug>.html"
   else
     python3 "${CLAUDE_PLUGIN_ROOT}/adapters/publish/scripts/md-to-gutenberg.py" \
       "{content_dir}/<slug>.md" \
       > "{drafts_dir}/<slug>/<slug>.html"
   fi
   # --extra-blocks is entirely omitted (both branches above collapse to the
   # same command minus the flag) when {profile_dir}/site-conventions.md
   # doesn't exist yet for this blog, or when its §Table of contents fence
   # literally reads "none" — the guard here checks for the FILE, not the
   # condition directly, so it stays correct even if the jq step above was
   # skipped for any other reason (e.g. a future guard added there): no
   # file on disk means no flag here. An explicit if/else (not a variable
   # splice) is required here: zsh (this environment's shell) does not
   # word-split an unquoted variable the way bash does, so a
   # `$EXTRA_BLOCKS_ARGS` expanding to `--extra-blocks /tmp/extra-blocks.json`
   # would reach argparse as ONE argument and fail — silently routing every
   # TOC-carrying post to the classic-block fallback below.
   ```
   Emits native `wp:paragraph` / `wp:heading` / `wp:list` + `wp:list-item` /
   `wp:image` / `wp:quote` / `wp:code` / `wp:table` blocks — WordPress's block
   editor renders these with the theme's native styling (spacing, heading
   typography, image blocks) instead of one legacy "Classic" block, and a
   TOC plugin's heading detection (illustrative examples only — this script
   never hardcodes a theme/block-library name) works correctly against the
   emitted `wp:heading` blocks. `--extra-blocks` is the hook for
   conventions-driven insertions this script has no business knowing about
   itself — it accepts either a JSON file path or an inline JSON string; the
   file-path form used above is what keeps the quote/newline-laden TOC
   markup out of a shell-quoted inline argument. `{content_dir}/<slug>.md` still carries its
   frontmatter block at this point (nothing upstream strips it before this
   step), so the script's own defensive strip fires here every time (with a
   stderr warning) — that warning is expected and safe to ignore in this
   adapter's normal flow; it exists as a general safety net for any caller
   that forgets to pre-strip (see the fallback's explicit awk strip below,
   needed there because `marked`, unlike `pandoc`, does not strip frontmatter
   itself).

   **Fallback (classic-block pandoc/marked path) — use ONLY if the script
   above is unavailable or errors:**
   ```bash
   pandoc -f gfm -t html "{content_dir}/<slug>.md" -o "{drafts_dir}/<slug>/<slug>.html"
   # pandoc's gfm reader strips the YAML frontmatter block natively — no separate strip step needed
   # fallback-of-the-fallback when pandoc is unavailable: strip frontmatter first (marked does not)
   awk 'BEGIN{fm=0} NR==1&&/^---$/{fm=1;next} fm==1&&/^---$/{fm=0;next} fm==0{print}' "{content_dir}/<slug>.md" | npx marked > "{drafts_dir}/<slug>/<slug>.html"
   ```
   **Warning: this fallback posts raw HTML, which WordPress's block editor
   wraps as ONE legacy "Classic" block — the post loses the theme's native
   block styling and native TOC-plugin heading detection.** Only take this
   path as a last resort, and say so explicitly when reporting to the human
   (e.g. "posted via the classic-block fallback — native styling and TOC will
   not apply; consider re-running the Gutenberg converter and re-syncing").
4. **Upload media.** For every image file under `{assets_dir}/<slug>/` (featured + every resolved in-post image; `[IMAGE:]` embeds already point at these files after step 1), upload it and capture its numeric media ID + `source_url`:
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" \
     -F "file=@{assets_dir}/<slug>/<file>" \
     "$WP_BASE/wp-json/wp/v2/media"
   ```
   Capture `id` + `source_url` from the upload RESPONSE of each `POST /media` call, immediately, per file. **Never re-derive a media ID from a later `slug=` lookup:** WordPress makes duplicate attachment slugs unique (`featured` → `featured-2`, `featured-3`, …), so a `slug=featured` query returns some *other* post's image — this exact failure produced a cross-post featured-image collision on 2026-07-18. **Parse the upload response leniently:** WordPress media responses embed rendered HTML fields that can contain raw control characters, which a strict JSON parser rejects — use e.g. Python `json.loads(..., strict=False)`, or request `_fields=id,source_url` on any unavoidable follow-up fetch to skip the control-char-laden fields entirely. **Skip-before-upload (per-file idempotency):** before uploading each file, check `wp_media_ids[]` (below) for an entry whose `file` matches this filename AND whose recorded `sha256` matches the on-disk file's current hash — only then reuse its recorded `id`/`source_url` and skip the upload. A filename match with a DIFFERENT hash means the file was regenerated (e.g. a review-loop edit under the same name): re-upload it — WordPress mints a NEW attachment rather than overwriting by filename, so UPDATE that `file`'s `wp_media_ids[]` entry in place to the new `id`/`source_url`/`sha256`, and repoint every reference to it (`featured_media` if it is the featured image, and the in-post `source_url` substitution below) to the new values. A missing entry means a first upload. In the body produced by step 3 (block markup, or HTML if the fallback ran), replace each local image reference with its uploaded `source_url` — `[IMAGE:]` embeds map to the uploaded media's source URL, never a local path (the Gutenberg converter emits the markdown image URL as-is into the `wp:image` block's `<img src>`, so this is a plain substring substitution against that same text either way). Record every upload into `wp_media_ids[]` (below) as one object per file — `{"file": "<filename>", "id": <id>, "source_url": "<source_url>", "sha256": "<sha256-of-bytes>"}` — written to `pr-monitor.json` immediately after EACH successful upload, not batched at the end (a crash mid-batch must not lose the uploads that succeeded); the featured image's media ID is also recorded separately for `featured_media`.
5. **Create the draft — first time only.** Create only when there is no stored `wp_post_id` in `pr-monitor.json` AND a slug lookup returns empty (this double check keeps a resumed run safe after a crash: a post ID may be recorded but the state file lost, or vice versa):
   ```bash
   # lookup first — does a workflow-created draft for this slug already exist?
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" \
     "$WP_BASE/wp-json/wp/v2/posts?slug=<slug>&status=draft"
   # empty array AND no stored wp_post_id -> create
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" -X POST \
     -H 'Content-Type: application/json' \
     "$WP_BASE/wp-json/wp/v2/posts" \
     -d '{"slug":"<slug>","title":<title>,"status":"draft","excerpt":<excerpt>,"content":<blocks>,"featured_media":<id>,"categories":[<category_id>]}'
   ```
   `<title>` and `<excerpt>` come from the post's frontmatter — the same values an Astro adapter would put in its frontmatter template; WordPress just receives them as REST fields instead of YAML. `<blocks>` is the media-URL-rewritten body from step 4 (Gutenberg block markup by default, or classic-block HTML if step 3's fallback ran — either way it's a plain string for the `content` field). Capture the response's `id` as `wp_post_id`.

   The same request also carries `tags` and `author`, both sourced from the post's frontmatter per `adapters/publish/frontmatter/wordpress.md` §WP REST field mapping: `tags` resolves each frontmatter tag name to a term ID (`GET /wp-json/wp/v2/tags?search=<name>`; if no exact match, create it with `POST /wp-json/wp/v2/tags`), then passes the resolved ID array. In v1, `author` always defaults to the authenticated user (`publish.wordpress.username`); a per-author WP-user mapping is a possible future config extension. These two fields sit in the same JSON body as `title`/`excerpt`/`content`/`featured_media` — the minimal shapes shown above illustrate the required fields; a real request includes `tags`/`author` alongside them whenever that data is available.

   **Category resolution (never ship "Uncategorized").** `<category_id>` above resolves the post's Category — set at intake (`templates/brief.md`'s Category field, resolved against `{profile_dir}/site-conventions.md` §Categories when it exists, carried unchanged through `plan.md`/`outline.md`) — to a WordPress term ID:
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" \
     "$WP_BASE/wp-json/wp/v2/categories?search=<category name>"
   # exact case-insensitive `name` match in the response -> reuse that id
   # no match -> create it, then use the new id
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" -X POST \
     -H 'Content-Type: application/json' \
     "$WP_BASE/wp-json/wp/v2/categories" -d '{"name":"<category name>"}'
   ```
   Same auth-reuse rule as every other call in this file: reuse the step 2 probe, never a fresh one. Set `categories:[<category_id>]` in BOTH this create body and the update body in `## On review-loop edit` step 2 below — a post whose brief planned a category must never ship left in WordPress's default "Uncategorized" term. If intake left Category as "none" (free-text with no `site-conventions.md` to resolve against, or the human had no preference), skip this resolution and omit `categories` from the body entirely — WordPress's "Uncategorized" default is only acceptable when no category was ever planned.

   Real titles/block markup contain quotes and newlines that break the string-pasted `-d` literal shown above — build the JSON body safely instead, e.g. `jq -n --arg slug "<slug>" --arg t "<title>" --arg e "<excerpt>" --rawfile c "{drafts_dir}/<slug>/<slug>.html" --argjson id <id> --argjson catid <category_id> '{slug:$slug, title:$t, status:"draft", excerpt:$e, content:$c, featured_media:$id, categories:[$catid]}'`, and pipe its output to `-d @-`. Omit `--argjson catid` and the `categories` key from the jq filter when no category was planned (see above).
6. **Apply the planned inbound links to existing posts' markdown (before Gate 2).** Follow `adapters/publish/astro-git-pr.md` §Staging step 5 VERBATIM for the complete per-row procedure — ownership check (grep + checklist Notes) → Link-only diff verification → dirty-file guard → write-ahead record → clean-file edit → `<edited inbound posts>` admission, including that section's Soundness invariant and its resume-reconstruction rule. This adapter does not re-derive or duplicate any of that mechanics; it only binds the config differently: `{content_dir}` and `{assets_dir}` resolve from `publish.wordpress.*` (never `publish.astro.*` — a WordPress blog's config has no `publish.astro` block), so `$P = {content_dir}/<existing-slug>.md` there. These edits land in `{content_dir}` in the repo (and ship in the same commit/PR as the rest of the staged post, when the async PR path is viable per §Relationship to the git repo) — never in WordPress directly. If the outline planned no inbound links, skip this step entirely.

   **v1 scope limit: edited EXISTING posts cannot be auto-synced to the live WordPress site.** This adapter tracks only the CURRENT post's WordPress post ID (`wp_post_id` in `pr-monitor.json`); the existing posts touched here have no recorded WP post ID, so there is nothing to PATCH via the REST API. Each existing post that reaches `<edited inbound posts>` therefore becomes an action item (see §Action-items sections §4b below): the human hand-applies the same link edit to the live WP post in wp-admin.
7. **Record state.** Write/update `{drafts_dir}/<slug>/pr-monitor.json` (schema below) with `wp_post_id`, `wp_media_ids[]`, and `wp_preview_url` (the draft's admin preview link — read whichever field the `posts` response exposes, or construct `<base_url>/wp-admin/post.php?post=<id>&action=edit` and preview from there).
8. **Gate 2 banner carries both artifacts.** The Gate 2 banner's `Preview:` line shows the PR diff URL (prose review) AND `wp_preview_url` (rendered review) side by side.

### `pr-monitor.json` additions for this adapter

```json
{
  "slug": "<slug>",
  "wp_post_id": 0,
  "wp_media_ids": [{"file": "<filename>", "id": 0, "source_url": "", "sha256": ""}],
  "wp_preview_url": "",
  "wp_upload": "ok"
}
```

On any upload failure (non-2xx from any call above), set `"wp_upload": "failed"` instead and record the HTTP status / error body; do NOT halt the rest of staging (the markdown is already finalized in the repo regardless of WordPress's availability) — report to the human with retry instructions. Resume re-runs steps 2-5 and 7 idempotently (the WP-facing calls; step 6's inbound-link edits are separately idempotent via the resume-reconstruction rule in `astro-git-pr.md` §Staging step 5, which this adapter defers to): media upload is safe to retry per-file (a retry after a partial failure uploads only files with no matching `file` entry in `wp_media_ids[]` — step 4's skip-before-upload check), and step 5's lookup-before-create prevents a duplicate post. If a resume genuinely lost the recorded entries (state file gone), re-upload ALL the files rather than attempting any slug-based re-lookup (see step 4's warning); orphaned duplicate attachments from a lost state file are cheap, a wrong cross-post media ID is not.

## On review-loop edit

Every addressed review comment (from the git PR, or the console) re-syncs the SAME WordPress draft by its stored `wp_post_id` — **never a second create.**

There is one path, the PR path. (A no-PR "console-gate path" used to be described here; it is gone with the Gate 2 mode it belonged to, per `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §GitHub precondition.) The staging cleanup already removed the main-tree copy (`astro-git-pr.md` §Staging step 6h), so edit `$worktree/{content_dir}/<slug>.md`, the worktree copy, per `adapters/publish/astro-git-pr.md` §On review-loop edit, then commit+push in the worktree there. Only THEN re-convert from that same worktree copy and re-sync the WordPress draft by its stored `wp_post_id` (steps 1-2 below).

1. Re-run §Staging steps 3-4 against the copy just edited above (re-convert to Gutenberg block markup, then re-run step 4's hash-aware skip-before-upload: a file whose `sha256` still matches its `wp_media_ids[]` entry is skipped; a regenerated file under the same name has a new hash, so it re-uploads and its entry's `id`/`source_url`/`sha256` are updated and references repointed, per step 4).
2. Update the existing post by its stored ID:
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" -X POST \
     -H 'Content-Type: application/json' \
     "$WP_BASE/wp-json/wp/v2/posts/<wp_post_id>" \
     -d '{"slug":"<slug>","title":<title>,"status":"draft","excerpt":<excerpt>,"content":<blocks>,"featured_media":<id>,"categories":[<category_id>]}'
   ```
   Same body shape as create — including `tags`, `author`, and `categories` (§Staging step 5's category resolution) — just POSTed to `/posts/<id>` instead of `/posts`. `status` stays `draft` — this step never changes it. `categories` is set here on EVERY re-sync, not just the first create, so a category correction made after the draft already exists still reaches WordPress and the post never drifts back to "Uncategorized".
3. Reply on the review surface exactly as `adapters/publish/astro-git-pr.md` §On review-loop edit describes (marker-based dedup), additionally noting the WordPress preview was re-synced.

## On Gate 2 approval

**Final sync + bookkeeping, plus an opt-in live inbound-link pass.** This adapter never sets a WordPress post's status beyond `draft` on its own — approval does not publish it; the human publishes from WP admin themselves. An ambiguous "publish" instruction anywhere in the run's launch args or standing instructions never flips `status` to `publish` — only a human clicking Publish in wp-admin does. But the human MAY have already clicked Publish in wp-admin before ever saying `approve` (external-publish detection — `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/pr-monitor.md` §Each firing checks for exactly this, and `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/SKILL.md` Step 15.1/15.2 carry the same signal for the console path); step 1 below is what detects that and adjusts the rest of this sequence.

1. **Check whether the post was already published externally.** `GET $WP_BASE/wp-json/wp/v2/posts/<wp_post_id>?_fields=status` — a normal authenticated call by the already-recorded ID, **not a probe**: the probe-once rule (§Staging step 2) governs only the one-shot credential-verification call made once per run; a routine status read by a stored, already-verified ID is safe and expected to run every time this finalize sequence executes (and pr-monitor.md's cron firing runs the identical call on every tick when `wp_post_id` is present).
   - **`status: publish`** (external-publish detected — the human already clicked Publish in wp-admin, possibly editing the post further there) → the live post is now authoritative. **SKIP the rest of this step entirely** — do NOT re-run §Staging steps 3-4 or the update call. Overwriting the human's in-admin edits with the last staged markdown snapshot would silently discard them. Continue to step 2.
   - **`status` is anything else (normally `draft`)** → this is a normal Gate 2 approval reached via review, not an external publish. Re-run §Staging steps 3-4 one final time against the approved markdown (idempotent — picks up any last-minute edit), then §On review-loop edit's update call (step 2) to sync the draft one more time. Continue to step 2.
2. **Live inbound links (opt-in).** Runs ONLY when BOTH are true: `publish.wordpress.apply_inbound_links_live: true` in config, AND step 1 found `status: publish`. Follow "### Live inbound-link application" below for the full per-row procedure. In every other case (flag `false`, OR the post is still `draft`), skip this step — §Action-items §4b below already carries the hand-apply fallback with prefilled curl commands; nothing here runs automatically.
3. Run `adapters/publish/astro-git-pr.md` §On Gate 2 approval verbatim for the git side (archive-in-PR, worktree left in place, human merges) — that sequence is unchanged by the publish adapter; it archives the markdown's working files, not the WordPress post.
4. Update `pr-monitor.json`: set `status: done` (matching the terminal value the git-side bookkeeping uses), and keep `wp_post_id` / `wp_media_ids[]` / `wp_preview_url` as the permanent record of what was published where.
5. Report completion: the markdown lives at `{content_dir}/<slug>.md`; the WordPress post is at `wp_preview_url` (still `draft`) or its live URL (external-publish path, already `publish`). When still `draft`, the human's remaining action is opening it in WP admin and clicking Publish (action-items §7); when already `publish`, there is nothing left to click.

### Live inbound-link application (opt-in, `publish.wordpress.apply_inbound_links_live`)

**Safety note: this writes directly to LIVE, already-published WordPress posts.** If that makes you uncomfortable, leave `apply_inbound_links_live: false` (the default) — the hand-apply action items in §Action-items §4b below cover the exact same edits, applied by a human in wp-admin instead. Every automatic edit below is idempotent (safe to re-run) and recorded in the checklist Notes both before and after it happens, so a crash mid-pass leaves a clear, resumable trail of what was and wasn't applied.

Two further caveats, both accepted trade-offs of an opt-in feature rather than bugs to fix:

(a) **The idempotency check only recognizes canonical link forms.** If a human already hand-added a link to this target in a non-canonical form — `http://` instead of `https://`, single quotes instead of double (`href='...'`), or a URL carrying a `#fragment` — step 2's boundary-anchored pattern won't match it, and this pass will insert a SECOND link alongside the existing one. The pattern covers the canonical forms this adapter itself emits, not every way a human might have typed the same URL by hand.

(b) **Each pass is a whole-`content.raw` read-modify-write, not a targeted patch.** Between step 1's `GET` and step 4's `POST`, a simultaneous wp-admin edit to the SAME target post is clobbered — last write wins, and there is no merge. The window is brief (one fetch, one edit, one write, per row) and the feature is opt-in (`apply_inbound_links_live: false` by default) specifically because this race exists; leave it off if concurrent manual editing of target posts is likely during a finalize run.

For each row in the outline's "Inbound internal links" section (existing-post slug + section/context + anchor, targeting THIS post, whose slug is `<slug>`):

1. **Resolve the target post by slug:**
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" \
     "$WP_BASE/wp-json/wp/v2/posts?slug=<existing-slug>&context=edit&_fields=id,content,status"
   ```
   `context=edit` is what makes `content.raw` present (same reason `## Site inspection (setup-time)` step 1 uses it). If the slug returns no post, or the returned `status` is not `publish`, skip this row: record an action-item note "target post `<existing-slug>` not found or not live; hand-apply the inbound link once it's published" and continue to the next row.
2. **Idempotency check (boundary-anchored, adapted for rendered HTML).** WordPress stores rendered `<a href="...">` markup in `content.raw`, not the markdown link syntax `astro-git-pr.md` greps for, so the concrete pattern differs while keeping the same boundary-anchoring principle that doc's ERE `\({route_prefix}<slug>/?\)` relies on: slugs never contain `/` or `"`, so the closing quote — with an optional trailing slash before it — is the word boundary a bare substring match lacks (without it, a short slug like `run` would false-match an existing link to `{route_prefix}running-shoes/`). Grep the fetched `content.raw` for either the absolute form WordPress normally renders, or the root-relative form (in case a prior manual edit used one):
   ```
   href="($WP_BASE)?{route_prefix}<slug>/?"
   ```
   (ERE, quote-anchored on both sides; escape any regex metacharacters literally present in `$WP_BASE`, e.g. the dots in a domain name, before using it in the pattern — an unescaped `.` would match any character instead of a literal dot. `{route_prefix}` and `<slug>` need no such escaping: both are interpolated literally, and kebab-case slugs contain no ERE metacharacters — same as the equivalent note in `astro-git-pr.md`'s step 6a pattern definition.) A match means the link already exists — record "already present, skipped" in the checklist Notes and continue to the next row (idempotent no-op).
3. **Insert the anchor.** Not found → build the full target URL: `$WP_BASE{route_prefix}<slug>`, plus a trailing `/` iff this blog's `blog.trailing_slash: true` (same rule `astro-git-pr.md` §Staging step 5c uses, just rendered as an absolute URL here instead of a root-relative markdown link). FIRST record the write-ahead note in checklist Notes: `live inbound link planned: <existing-slug> (wp id <id>) -> this post` — write-ahead, same discipline as `astro-git-pr.md` §Staging step 5c (record, then edit, so a crash between the two is recoverable: the next run's idempotency check at step 2 above re-derives correctly, either finding the link already there or falling through to re-apply). THEN edit `content.raw`: insert `<a href="<full URL>"><anchor></a>` at the contextual spot named by the outline's row (preferring to extend an existing related-posts sentence over bolting on a new one, same editorial preference as the astro adapter), producing the new content string.
4. **POST the update:**
   ```bash
   curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" -X POST \
     -H 'Content-Type: application/json' \
     "$WP_BASE/wp-json/wp/v2/posts/<id>" \
     -d @<(jq -n --arg c "<new content.raw, with the anchor inserted>" '{content:$c}')
   ```
   Build the body via `jq -n --arg` (or `--rawfile` from a temp file when the content is large) as elsewhere in this document — never a hand-quoted inline string; real post content contains quotes and newlines that break that.
5. **Record the result.** Update the checklist Notes write-ahead entry from step 3 to its final form: `live inbound link applied: <existing-slug> (wp id <id>) -> this post, anchor "<anchor>" in <section/context>; before: "<~80 chars around the insertion point, pre-edit>"; after: "<same span, post-edit>"`. This before/after pair is the audit trail a human can spot-check without re-fetching the live post.

If the outline planned no inbound links, skip this whole subsection. If any row's REST call fails (non-2xx), do not halt the rest of finalize — record the failure in the checklist Notes with the HTTP status, and fall back to that one row's hand-apply action item (§Action-items §4b below) exactly as if the flag were off for that row alone.


## On abandon

Delete the workflow-owned WordPress draft and its uploaded media, tracked by the IDs recorded in `pr-monitor.json` — the WordPress analogue of the `.staged-by-blog-workflow` sentinel rule (never delete anything lacking its recorded ownership ID).

```bash
# delete the draft (force=true skips WordPress's trash, since this is a workflow-owned draft, not a human-authored one)
curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" -X DELETE \
  "$WP_BASE/wp-json/wp/v2/posts/<wp_post_id>?force=true"
# delete every uploaded media item
for id in <each wp_media_ids[].id>; do
  curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" -X DELETE \
    "$WP_BASE/wp-json/wp/v2/media/$id?force=true"
done
```

Only run this against the `wp_post_id` / `wp_media_ids[]` that `pr-monitor.json` actually recorded for THIS slug — never delete a WordPress post/media item discovered by any other means (e.g. a slug-lookup hit belonging to a different, unrelated draft). If `pr-monitor.json` is missing or has no `wp_post_id` (staging never completed), there is nothing to delete. Additionally run `adapters/publish/astro-git-pr.md` §On abandon for the git side (leave the worktree in place, leave the branch/PR for the human) — that run already includes its "Inbound-link edits (both paths)" bullet, which reverts §Staging step 5's edits in the main tree.

## Action-items sections

The literal content this adapter supplies for `action-items.md` §6/§7 (per `${CLAUDE_PLUGIN_ROOT}/templates/action-items.md` §6-7's pointer sentence), for `publish.adapter: wordpress-rest`. This adapter also branches the generic §4b row wording (below), since — unlike `astro-git-pr` — an edit to an existing post's markdown does not by itself reach the live site.

### §4b, Inbound links (branch)

**When `publish.wordpress.apply_inbound_links_live: true` AND this post's WordPress status is `publish`** (see `## On Gate 2 approval`): rows applied by "### Live inbound-link application" read: "applied live to the published `<existing-slug>` post via REST (wp id `<id>`); before/after recorded in checklist Notes — nothing further to do." A row that fell back there (target not found / not live / REST call failed) keeps the hand-apply wording below instead.

**Otherwise (flag `false`, or this post is still `draft`):** each row applied at §Staging step 6 above reads: "applied to `<existing-slug>.md` in the repo; hand-apply to the live WP post in wp-admin (auto-sync of prior posts is out of v1 scope)," with the exact commands prefilled so the human can paste-and-run rather than improvise:
```bash
# 1) fetch the target post's raw content
curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" \
  "$WP_BASE/wp-json/wp/v2/posts?slug=<existing-slug>&context=edit&_fields=id,content"
# 2) insert the anchor by hand into the returned content.raw at "<section/context>":
#    <a href="$WP_BASE{route_prefix}<slug><trailing slash iff blog.trailing_slash: true>">"<anchor>"</a>
# 3) POST the edited content back (build the body with jq, never a hand-quoted string):
curl -sf -u "$WP_USER:${!WP_APP_PASSWORD_ENV}" -X POST \
  -H 'Content-Type: application/json' \
  "$WP_BASE/wp-json/wp/v2/posts/<id>" \
  -d @<(jq -n --arg c "<edited content.raw>" '{content:$c}')
```
If the outline planned none, the template's default "None." stands.

### §6, none

WordPress has no author-map file to reconcile (unlike the Astro adapter's optional `authors_map_check`) — write "§6. N/A for the WordPress adapter." and continue to §7.

### §7, Publish

- [ ] Open the WordPress draft preview: `<wp_preview_url>`.
- [ ] Read it once more in the WP admin preview (title, excerpt, featured image already synced by this adapter).
- [ ] **Conditional — focus keyword.** If `{profile_dir}/site-conventions.md` §SEO plugin names a keyword-based plugin (not "none detected" and not "N/A"): set the focus keyword in `<SEO plugin name from site-conventions.md>` to exactly: `<target keyword>` (from `brief.md`/`plan.md`, verbatim — not a paraphrase, not the title). If that section's "Settable via standard REST?" field records "no — not exposed on the standard `wp/v2/posts` schema", this is a manual step: set it yourself in the WP editor's SEO panel/meta box before publishing — this adapter never attempts that write via REST. If §SEO plugin records "none detected" or the file doesn't exist yet for this blog, skip this item entirely.
- [ ] Click **Publish** in WP admin. This workflow never does that step for you.
- [ ] After publishing, verify the live post per action-items §8.
