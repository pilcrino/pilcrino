# Images: <slug>

Written by: `suggest-images` skill (invoked by the editor at Stage 4a).
Sources: `{drafts_dir}/<slug>/outline.md` (image placement plan), `{drafts_dir}/<slug>/draft-v<N>.md` (`[IMAGE:]` placeholders), `{drafts_dir}/<slug>/facts.md` (for chart/diagram data), `${CLAUDE_PLUGIN_ROOT}/adapters/images/*.md` (per-type production specs).
Read by: human (creates the actual assets and saves them under `{assets_dir}/<slug>/`).

**Purpose:** every image slot in the finalized draft gets a concrete spec the human can execute without re-reading the post. One image slot = one detailed entry.

## Summary

- Total image count: `<N>` (1 featured + `<N-1>` in-post)
- Breakdown by type:
  - Remotion compositions: `<N>`
  - AI-generated (`ai-prompt`): `<N>`
  - Screenshots: `<N>`
- File destination: `{assets_dir}/<slug>/`

## Featured image

> **Frontmatter only.** This asset is referenced from the post's cover-image frontmatter field per the publish adapter's convention (`adapters/publish/<adapter>.md`) and rendered as a banner above the title. Never duplicate it as the first in-post `[IMAGE:]` placeholder; the post would render the same image twice.

- **Type:** `<images.featured_default from config.yaml, or the image-planner's choice from images.enabled>`. Must be one of `remotion | ai-prompt | screenshot`. There's no fixed default type anymore, `images.featured_default` (if set) must be a member of `images.enabled` (config-schema.md invariant 2); `remotion` remains a strong choice for a title-banner treatment, but the planner may pick any enabled strategy.
- **Dimensions:**
  - `remotion`: **1800 × 1200 (3:2)** native canvas (see `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md` for the exact layout constants), rendered at `--scale=2` (→ 3600 × 2400 PNG, ~350–450 KB). The blog post page renders the cover at native aspect (no crop); OG/Twitter previews crop to 1.91:1, so keep edge-anchored content inside the vertical safe zone.
  - `ai-prompt`: per `{profile_dir}/image-style.md`'s aspect-ratio default (typically 3:2 or 1.91:1); confirm in the matching spec block below.
  - `screenshot`: match the captured viewport, cropped to a clean 3:2 or 1.91:1 frame if used as featured.
- **Concept:** `<one-sentence description of what the image shows>`
- **Archetype:** `<the composition archetype chosen per the rotation rule (suggest-images §Featured-slot archetype: not used by the previous 2 POSTS per {ops_dir}/featured-log.md, this slug's own row excluded on a re-run); one line on why it fits this concept>`. The archetype governs composition only — palette, fonts, watermark, and the verbatim title band never vary.
- **Suggested filename:** `featured.png` (or the type-appropriate extension).
- **Alt text:** `<meaningful alt text, not "screenshot", not "image">`

### Production spec

Fill exactly one of the blocks below based on `Type`. Three blocks, one per image strategy: `remotion`, `ai-prompt`, `screenshot`. Any of the three can serve the featured slot; `screenshot` needs a pre-existing thing to capture, so it's rarely the planner's pick for a from-scratch concept.

#### If `remotion`

> Conform to `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md`, that adapter is the source of truth for canvas, palette, typography, watermark, card recipes, and arrow conventions. Featured images **must** use the adapter's title-anchored layout + `<BlogWatermark />` corner watermark.

- **Tool:** Remotion (React → PNG), project at `{remotion_dir}/`. Studio: `npx remotion studio --port=3003`.
- **Composition `<Still>` ID:** `<id from composition-id.mjs, e.g. my-post--cost-chart>`
- **Component file:** `{remotion_dir}/src/<id>.tsx`
- **Canvas dimensions:**
  - Featured: **1800 × 1200** (matches the adapter's canvas constants); render at `--scale=2` for the final PNG.
  - In-post: 1800 × 1200 (preferred, matches the hero series) or a smaller variant if the adapter defines one, be explicit.
- **Mandatory layout primitives (FEATURED image only):**
  - Title = the blog post title **verbatim** (the exact `title:` from the post frontmatter; never reword, summarize, shorten, or swap in a punchier headline), positioned per the adapter's title-band constant, centered. A long title wraps faithfully or its exact tail continues on the subtitle line; the words never change.
  - Optional subtitle below the title band, styled per the adapter's typography spec.
  - `<BlogWatermark />` (import from `./BlogWatermark`), positioned per the adapter's watermark spec. Never inline a watermark, never reposition.
  - Background and safe margin per the adapter's canvas spec.
- **In-post images carry NO title and NO subtitle.** They sit under a section heading in the post, so a title band would be redundant. Never spec a title-band title or a subtitle for an in-post slot; reclaim that whole top band for the diagram. (Watermark, background, and safe margin still apply to in-post Remotion images.)
- **Visual spec (detailed):**
  - Title text: **featured** = the post title verbatim (exact frontmatter `title:`); **in-post** = none
  - Subtitle text: **featured** = optional (or "none"); **in-post** = none
  - Layout: `<top-to-bottom or left-to-right description of every section>`
  - Copy: `<exact strings the composition should render: URLs, prices, status text, etc.>`
  - Palette: per `{profile_dir}/image-style.md` (this blog's locked color tokens) and `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md` §Color conventions (usage guidance, e.g. accent colors used sparingly).
  - Typography: per `{profile_dir}/image-style.md` (this blog's font tokens for headings / body / code).
  - Icons / SVG assets: list any `<Img src={staticFile(...)} />` assets needed; check `{remotion_dir}/public/` for assets that already exist before creating new ones.
  - Arrows / connectors: per `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md` §Arrow conventions, if the diagram needs directional flow.
  - Card recipe to use (if any): see `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md` §Card design language for the available recipes.
- **Source data (if any):** `<facts.md entry <line> | first-party product data | hardcoded illustrative values acceptable in featured/diagram contexts>`
- **Values stated in text at:** `<"first words of the sentence before the placeholder" | "table in this section" | caption needed>` (data slots only; `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Data in images)
- **Reference composition to mimic:** `<closest existing composition already built in {remotion_dir}/src/, or the starter scaffold's sample composition if this is the first custom one>`. **Featured slot: the reference is for CODE CONVENTIONS ONLY** (theme imports, layout helpers, watermark usage) — the composition must follow this slot's `Archetype:`, never copy a prior cover's layout. In-post diagrams may mimic the reference's layout freely (consistency is a feature there).
- **Iteration command** (preview, throwaway, outputs to `{remotion_dir}/out/`, not committed):
  ```
  REPO=$(git rev-parse --show-toplevel) && cd "$REPO/{remotion_dir}" && npx remotion still <id> --output=out/preview-<name>-v1.png
  ```
- **Final export command** (only after sign-off; writes directly to the blog assets folder of the CURRENT tree). `REPO` is derived dynamically so this works whether you run in the main checkout OR a git worktree, never hardcode an absolute repo path (a hardcoded `/Users/...` path silently exports into the main repo when you are working in a worktree):
  ```
  REPO=$(git rev-parse --show-toplevel) && cd "$REPO/{remotion_dir}" && npx remotion still <id> --scale=2 \
    --output="$REPO/{assets_dir}/<slug>/<filename>.png"
  ```
- **Why this and not a real screenshot:** `<one line, usually "nothing to screenshot yet" or "featured image illustrates the post's thesis, not a single screen">`

#### If `ai-prompt` (codex-automated; generated at Stage 4a.5)

- **Tool:** `codex / gpt-image via ${CLAUDE_PLUGIN_ROOT}/skills/generate-image-codex/SKILL.md (no API key; on failure the Prompt below is the manual paste-anywhere fallback)`
- **Prompt:**
  ```
  <the full prompt text: subject, style, composition, lighting, color palette (per {profile_dir}/image-style.md)>
  ```
- **Aspect ratio:** `<e.g. 3:2 for featured, 16:9 for an in-post chart>`
- **Negative prompt** (if the tool supports it):
  ```
  <things to exclude: text artifacts, watermarks, extra limbs, etc.>
  ```
- **Style reference (if any):** `<link to a reference image, or a style-guide entry in {profile_dir}/image-style.md>`
- **Source data (if any):** `<facts.md entry <line>, if the image needs to represent real numbers>`
- **Values stated in text at:** `<"first words of the sentence before the placeholder" | "table in this section" | caption needed>` (data slots only; `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Data in images)
- **Why this and not remotion/screenshot:** `<one line>`

#### If `screenshot`

- **Source:** `<this blog's own product/site UI>` or `External: <product / site name>`
- **URL to capture:** `<URL>`
- **What to include in frame:** `<specific UI elements to show>`
- **What to crop out:** `<personal info, unrelated panels, etc.>`
- **Zoom / device:** `<desktop 1200w | laptop 1440w | mobile 390w>`
- **Capture tool:** `<e.g. a screenshot/screen-recorder browser extension>`
- **Capture date** (external only): `<YYYY-MM-DD, so future readers know how stale the screenshot is>`
- **Annotations required** (if any):
  - `<e.g., "colored rectangle around the status column">`
  - `<e.g., "arrow pointing from the link text to the status badge">`
- **Annotation style** (if annotations needed): color per `{profile_dir}/image-style.md`'s accent color (default) or `<#RRGGBB>` if contrast requires; stroke 3 px; rounded 6 px corners; font matches the captured UI if labels are used. If a UI element needs highlighting, note it here; the annotation overlay is produced as a `remotion` annotated-mockup, not in this slot.

### Watermark

- **`remotion` slots:** use the shared `<BlogWatermark />` component (logo + wordmark per `{profile_dir}/image-style.md`; sizing, opacity, and position per `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md`). Never inline a watermark, never reposition. The component is the single point of brand-mark control.
- **Own-site/product UI screenshots:** skip the watermark, the UI chrome is already self-branding.
- **External screenshots:** this blog's logo bottom-left at 55–80% opacity, applied post-capture.

---

## In-post images

Each image below corresponds to an `[IMAGE: ...]` placeholder in `draft-v<N>.md`. One entry per placeholder, in draft order. The featured asset above is **not** an in-post entry.

**Placement rule:** in-post images sit *after* the section heading + the section's first body paragraph (so the heading introduces the section, the paragraph frames the point, and the image illustrates it). The exception is an image that closes evidence cited in the prior section's prose, that may sit before the next H2.

**Table-redundancy rule:** never spec a chart-style image (`remotion` or `ai-prompt`) whose content is already presented as a markdown table in the same section, unless the chart adds something the table can't (color coding, callout arrows, computed totals, derivative chart shape).

**Values-in-text rule:** every data image's numbers, labels and values also appear as text in the same section (preceding sentence, table or caption). Alt text does not count. Fill `Values stated in text at:` for each data slot.

### Image 1, after H2 "<heading>" + 1 paragraph

- **Draft placeholder (verbatim):** `[IMAGE: <as written in draft>]`
- **Type:** `<remotion | ai-prompt | screenshot>`
- **Concept:** `<one-sentence description>`
- **Suggested filename:** `<kebab-case descriptive name>.<jpg|png>`
- **Alt text:** `<meaningful alt text, 50–125 chars typical>`

#### Production spec

`<fill the matching block from the Featured-image spec patterns above, EXCEPT: in-post images have NO title and NO subtitle for remotion (set both to "none"); the title band does not apply here>`

---

### Image 2, after H2 "<heading>" + 1 paragraph

`<...same shape...>`

---

<!-- repeat for each [IMAGE:] placeholder in the draft -->

## File destination (copy these paths when saving)

```
{assets_dir}/<slug>/
├── featured.png           (or the type-appropriate extension)
├── <image-1-filename>
├── <image-2-filename>
└── ...
```

Asset folder is created automatically by the Phase 4 finalize step (Gate 2 approval).

## Tools reference

1. **Remotion compositions:** project at `{remotion_dir}/`. Adapter: `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md`. Studio: `npx remotion studio --port=3003`. Register a `<Still>` in `src/Root.tsx`, write the component in `src/<id>.tsx`, iterate via `npx remotion still <id> --output=out/preview-...png` (throwaway), final export via `npx remotion still <id> --scale=2 --output={assets_dir}/<slug>/featured.png`. Use `<BlogWatermark />`, the title-band constant, and the fonts/palette locked in `{profile_dir}/image-style.md`.
2. **AI-generated (`ai-prompt`, automated via codex — no API key):** adapter `${CLAUDE_PLUGIN_ROOT}/adapters/images/ai-prompt.md` (+ `codex.md` for dispatch). Needs no API key (codex authenticates itself).
3. **Screenshots:** any screenshot/screen-recorder tool the human prefers; markup via the same tool or a lightweight image editor; annotations at 3 px stroke, color per `{profile_dir}/image-style.md`. Record source URL + capture date for external screenshots. Output format: PNG.
4. **Watermark + polish:** for `remotion` slots, use the shared `<BlogWatermark />` component (no manual pass needed). For external screenshots, finish with this blog's logo at 55–80% opacity bottom-left. Output format: **PNG** for `remotion` and `screenshot`; match the tool's native output format for AI-generated images.

## Naming conventions (from `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md`)

- Lowercase, kebab-case, descriptive
- Good: `broken-link-example.png`
- Bad: `image1.png`, `screenshot.jpg`, `IMG_0042.PNG`

## What the human does

1. Create each image per its production spec.
2. Save to `{assets_dir}/<slug>/` using the suggested filenames.
3. Verify file sizes (<200 KB for featured, <500 KB for in-post is a good rule of thumb).
4. Once all images exist locally, tick the "Create images" section in `action-items.md`.

## Editor notes

<Anything the suggest-images skill wants to flag for the human, e.g., "the outline image slot after H2 'FAQ' was ambiguous; I suggested a remotion diagram but a screenshot could work, your call.">
