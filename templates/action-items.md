# Action items: <slug>

Compiled by: blog-post-workflow skill (editor role) at Stage 4b, from a grep of `{drafts_dir}/<slug>/draft-v<N>.md` markers + `{drafts_dir}/<slug>/images.md` count.

> **Path convention after Gate 2 finalize:**
> - **History / spec (read-only):** `{drafts_dir}/_archive/<slug>/`, the archived working files (outline, facts, images.md, draft-v<N>.md, review history).
> - **Live post (where you edit):** `{content_dir}/<slug>.md` (or the WordPress equivalent), marker fixes, `[IMAGE:]` replacements, `[VERIFY:]` resolutions all land here.
> - **Asset folder:** `{assets_dir}/<slug>/`, contains `README.md` (copy of images.md) plus the image files you create.
>
> If you read this file before Gate 2, the draft is still at `{drafts_dir}/<slug>/draft-v<N>.md` (pre-move). The shell snippets below use variables so either phase works: set `POST=...` to the live path after finalize, or the draft path before.

Read by: the human operator before publishing.

**Purpose:** the single page the human works through after Gate 2. Every item here is required before publish. Estimated total time: `<N>` minutes.

## 0. Pre-flight

Paths shown below are pre-finalize. After Gate 2, swap `{drafts_dir}/<slug>/` → `{drafts_dir}/_archive/<slug>/` for the history files, and the draft becomes `{content_dir}/<slug>.md` (or the WordPress equivalent), the live post you edit.

- Draft (pre-finalize): `{drafts_dir}/<slug>/draft-v<N>.md` (humanized at Stage 3c). Post-finalize: `{content_dir}/<slug>.md`.
- Approved outline: `{drafts_dir}/<slug>/outline.md` → archived to `{drafts_dir}/_archive/<slug>/outline.md`
- Image plan: `{drafts_dir}/<slug>/images.md` → archived to `{drafts_dir}/_archive/<slug>/images.md` + copied to `{assets_dir}/<slug>/README.md`
- Review history: `{drafts_dir}/<slug>/review.md` + any `review-v<N>.md` → archived to `{drafts_dir}/_archive/<slug>/`
- Total word count: `<N>`
- Author: `<author slug from {profile_dir}/authors.md, or "we">`

## 1. Create images (`<N>` total)

Image spec (post-finalize): `{drafts_dir}/_archive/<slug>/images.md` (also copied to `{assets_dir}/<slug>/README.md` by the finalize step). Pre-finalize: `{drafts_dir}/<slug>/images.md`. Estimated time: `<N>` minutes.

- [ ] Featured image: `featured.png` (or the type-appropriate extension), see images.md §Featured, type: `<remotion | ai-prompt | screenshot>`
- [ ] Image 1: `<filename>`, see images.md §Image 1, type: `<remotion | ai-prompt | screenshot>`
- [ ] Image 2: `<filename>`, see images.md §Image 2, type: `<remotion | ai-prompt | screenshot>`
- [ ] ... (one entry per in-post image)

**Remotion slots** (`<N>` total): build per `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md`. For each: add `<Still>` to `{remotion_dir}/src/Root.tsx`, write `src/<id>.tsx`, iterate with `npx remotion still <id> --output=out/preview-...png`, then final export at `--scale=2` directly to the asset path below. Each `remotion` entry in images.md carries its composition ID + exact render command.

- [ ] Remotion: `<id>` → `<filename>` (composition built, registered, exported)
- [ ] ... (one entry per `remotion` slot, or "none" if no Remotion images planned)

**AI-generated slots** (`<N>` total, `ai-prompt`): rendered automatically at Stage 4a.5 — verify each render; a `failed` slot is a build TODO via its pasteable `Prompt:` block in images.md (`${CLAUDE_PLUGIN_ROOT}/adapters/images/ai-prompt.md`).

- [ ] AI: `<filename>` (generated, reviewed, saved)
- [ ] ... (one entry per `ai-prompt` slot, or "none")

Save all to: `{assets_dir}/<slug>/`

## 2. `[VERIFY:]` markers , auto-resolved at Stage 3d

These were resolved automatically at Stage 3d (marker auto-resolution), so there is normally nothing to do here. This section is the audit log of what the editor did, plus any residual that was deliberately left for you.

Stage 3d resolution log (one row per marker the writer left):

| # | Line | Claim | Outcome | Source / note |
|---|---|---|---|---|
| 1 | `draft-v<N>.md:<line>` | `<claim>` | `<resolved \| kept-general \| deleted \| competitor-routed>` | `<allowlist URL cited, or "claim deleted", or "routed to Stage 1.5c profile refresh">` |

Outcome key:
- `resolved`, marker replaced with the confirmed claim + an allowlist/primary citation. Nothing to do.
- `kept-general`, claim was true-in-spirit but not citable as stated; rewritten to a defensible general version, marker dropped. Nothing to do.
- `deleted`, claim could not be confirmed from any allowlist/primary source; the minimal span was removed (the removed text is logged). Skim the surrounding paragraph if you want to confirm it still reads well.
- `competitor-routed` (module: competitors), a `[VERIFY:]` on a competitor's price/feature (which the writer should never have used). NOT web-resolved. **Action required:** refresh `{competitors_dir}/<slug>.md` per `methodology.md` (Stage 1.5c), then the claim can be cited from `facts.md`. A residual `[VERIFY:]` marker is still in the draft for these, resolve before publish.

If Stage 3d found zero `[VERIFY:]` markers: "None."

## 3. `[EXTERNAL_LINK_NEEDED:]` markers , auto-resolved at Stage 3d

Same as §2: Stage 3d either linked the claim to an allowlist/primary source or (if no source existed) deleted the claim. This is the audit log.

| # | Line | Claim | Outcome | Source / note |
|---|---|---|---|---|
| 1 | `draft-v<N>.md:<line>` | `<claim>` | `<resolved \| kept-general \| deleted>` | `<allowlist URL cited, or "claim deleted">` |

If Stage 3d found zero `[EXTERNAL_LINK_NEEDED:]` markers: "None."

## 4. Fill `[INTERNAL_LINK_NEEDED:]` markers

Internal links where the outline's existing-posts table didn't offer a fit. Pick the closest existing published post OR add to the backlog if no fit exists. Insert as root-relative `[anchor]({route_prefix}<slug>)` (with a trailing slash appended iff `blog.trailing_slash: true`), never `https://yourblog.com{route_prefix}...` (per `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Internal linking).

`<N>` markers:

- [ ] `draft-v<N>.md:<line>`, topic: "`<topic>`", candidate post slug: `<slug>` → insert as `{route_prefix}<slug>` (append `/` iff `blog.trailing_slash: true`)
- [ ] ...

If zero: "None."

## 4b. Add inbound links from existing posts to this one

From the outline's "Inbound internal links" section. Edit each existing post file to add a contextual link pointing at this new post's URL. Do this before/at publish.

- [ ] `{content_dir}/<existing-slug>.md`, add anchor "`<anchor>`" → `{route_prefix}<this-slug>` (append `/` iff `blog.trailing_slash: true`) in `<section/context>`
- [ ] ...

If the outline planned none: "None."

## 5. Final manual read

- [ ] Read the whole draft aloud, catches AI tells the editor missed (awkward rhythm, overly formal connectors, "it's important to note that" variants)
- [ ] Grammarly score target: 80–85 (not 99, perfection is an AI signal). If over 95, deliberately loosen one or two sentences
- [ ] If `modules.product` is enabled: scan for hallucinated product features against `{profile_dir}/product.md`, anything the post claims the product does must exist
- [ ] If `modules.competitors` is enabled: verify competitor pricing / feature claims (pricing changes quarterly; note the `Last verified` dates in `facts.md`)

## 6-7. Publish-adapter-specific steps

§6/§7 are supplied by the publish adapter (`adapters/publish/<adapter>.md` §Action-items sections). That covers any one-time author-map setup (astro adapter, if configured) and the full publish sequence (branch/stage/commit/push, or the WordPress REST create/update) for the configured `publish.adapter`.

## 8. Post-publish (within 24 hours)

`<blog-url>` below is filled by Stage 4b from config `blog.url` (e.g. `baselinenotes.com`) when this file is written — the workflow's placeholder grep then naturally enforces it.

- [ ] Verify the live URL: `https://<blog-url>{route_prefix}<slug>` (append a trailing `/` iff `blog.trailing_slash: true`)
- [ ] Submit URL to Google Search Console → URL Inspection → Request Indexing
- [ ] Submit URL to Bing IndexNow (via Bing Webmaster Tools or the CLI)
- [ ] Check featured image Open Graph preview: `https://www.opengraph.xyz/?url=https%3A%2F%2F<blog-url>%2Fblog%2F<slug>%2F`
- [ ] Check mobile rendering at a narrow viewport
- [ ] If the publish adapter's frontmatter template emits a JSON-LD FAQ schema: validate at `https://search.google.com/test/rich-results?url=https%3A%2F%2F<blog-url>%2Fblog%2F<slug>%2F`

## 9. Trigger Phase 5 repurpose (when ready)

After the post is live, run the standalone repurpose skill for X thread / X short / LinkedIn / newsletter:

```
/repurpose-blog-post <slug>
```

The skill writes four platform-native outputs under `{drafts_dir}/_archive/<slug>/repurpose/`. Copy each into your scheduler. See `${CLAUDE_PLUGIN_ROOT}/skills/repurpose-blog-post/SKILL.md` for the full contract.

## 10. Archive cleanup (automatic at Gate-3 finalize)

The finalize step already moved `{drafts_dir}/<slug>/` → `{drafts_dir}/_archive/<slug>/`. Verify:

```bash
ls {drafts_dir}/<slug>/          # should NOT exist
ls {drafts_dir}/_archive/<slug>/ # should exist, contains all the working files
```

If the draft directory still exists, Gate 2 finalize didn't complete, re-run the finalize sequence from the main skill's Gate 2 step.

---

## Marker grep summary (raw, for re-verification)

```
[VERIFY:]             , <N> hits
[EXTERNAL_LINK_NEEDED:], <N> hits
[INTERNAL_LINK_NEEDED:], <N> hits
[IMAGE:]              , <N> hits (should match the in-post `### Image ` entry count in images.md; total images = hits + 1 featured)
```

Grep command the editor ran at Stage 4b (against the pre-finalize draft):
```bash
grep -nE '\[(VERIFY|EXTERNAL_LINK_NEEDED|INTERNAL_LINK_NEEDED|IMAGE):' \
  {drafts_dir}/<slug>/draft-v<N>.md
```

The Stage 4b parser splits each `[VERIFY:]` hit on the literal ` | source:` separator: text before the pipe = the claim, text after = the source clause. The two halves populate the table in §2. If a `[VERIFY:]` lacks the `| source:` clause entirely (writer bug), the row's source column reads `MISSING (writer omitted source clause; please flag)` and the human should grep the draft history for the writer's intent.

Re-run against the **live post** before publishing (after Gate 2 the draft has moved):
```bash
POST={content_dir}/<slug>.md
grep -nE '\[(VERIFY|EXTERNAL_LINK_NEEDED|INTERNAL_LINK_NEEDED|IMAGE):' "$POST"
```

Expected output: zero hits. Every `[VERIFY:]`, `[EXTERNAL_LINK_NEEDED:]`, `[INTERNAL_LINK_NEEDED:]`, and `[IMAGE:]` must be resolved in the live post before it ships. **Marker fixes land in the live `$POST` file, not in the archived draft.**

`[IMAGE:]` placeholders MUST be replaced with real Markdown image syntax before publishing:

```markdown
![<alt text>](<relative or adapter-appropriate path into {assets_dir}/<slug>/<filename>>)
```

- [ ] All `[IMAGE:]` placeholders replaced with real Markdown image syntax and the path points to a file that exists in the asset folder
