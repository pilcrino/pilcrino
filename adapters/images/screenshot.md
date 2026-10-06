# Screenshot image adapter (manual)

Read by: the image-planner (planning time, so it knows what fields a `#### If screenshot` block needs), and `${CLAUDE_PLUGIN_ROOT}/skills/generate-images/SKILL.md` (dispatch time, for the disposition this slot type gets).

## What this adapter produces

Nothing, automatically. `screenshot` is always a manual capture: a human (using whatever screenshot/screen-recorder tool they prefer) captures a real UI or page and saves it. This adapter defines the instruction format the image-planner must fill into a slot's `#### If screenshot` block, and the disposition `generate-images` records for a slot of this type.

## Disposition

Every `screenshot` slot is recorded under `screenshot_pending` in the `generate-images` manifest. Never `rendered` (no file is produced by any automated step), never `failed` (unless the slot's `Type:` itself is invalid, a planner bug handled at the dispatcher's validation step, not here). No Bash/Write/Edit action is taken against this slot by `generate-images`, the capture instructions are already complete in `images.md`.

## Manual capture instructions format

The image-planner fills these fields in a slot's `#### If screenshot` block:

- **Source:** this blog's own product/site UI, or `External: <product / site name>`.
- **URL to capture:** the exact URL to load.
- **What to include in frame:** the specific UI elements the screenshot must show. Be concrete ("the pricing table with all three tiers visible"), a vague target ("the pricing page") produces an inconsistent capture.
- **What to crop out:** personal info, unrelated panels, browser chrome (if not itself relevant), ads.
- **Zoom / device:** desktop (e.g. 1200w), laptop (e.g. 1440w), or mobile (e.g. 390w) viewport.
- **Capture tool:** whichever screenshot/screen-recorder tool the human prefers.
- **Capture date** (external sources only): `YYYY-MM-DD`, so a future reader knows how stale the screenshot is, a UI this blog doesn't control can change without notice.
- **Annotations required (if any):** each callout as its own bullet, e.g. "colored rectangle around the status column", "arrow pointing from the link text to the status badge".
- **Annotation style (if annotations needed):** color per `{profile_dir}/image-style.md`'s accent color by default, or an explicit hex if contrast requires it; 3px stroke; 6px rounded corners; font matches the captured UI if labels are used. If a UI element needs a highlight box, note it here, the annotation overlay itself is produced as a `remotion`-composited layer on top of the raw capture (see `${CLAUDE_PLUGIN_ROOT}/adapters/images/remotion.md` §Card design language and §Arrow conventions for the available recipes), never drawn by this adapter directly.

## Watermark

- **Own-site/product UI screenshots:** skip the watermark, the UI chrome is already self-branding.
- **External screenshots:** this blog's logo, bottom-left, at 55-80% opacity, applied post-capture, per `{profile_dir}/image-style.md`.

## What the human does with a `screenshot_pending` slot

1. Open the slot's entry in `{drafts_dir}/<slug>/images.md`, follow the capture instructions verbatim.
2. Crop and annotate per the spec.
3. Save to `{assets_dir}/<slug>/<Suggested filename>` verbatim, never append an extra extension.
4. Tick the "Create images" section in `action-items.md` once every pending slot in the post has a file on disk.
