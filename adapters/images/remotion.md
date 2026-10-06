# Remotion image adapter

Read by: `${CLAUDE_PLUGIN_ROOT}/skills/generate-images/SKILL.md` (Step 4 dispatch) and the `image-builder` agent, for any `images.md` slot with `Type: remotion`. Also read by `templates/images.md` production-spec blocks for §Color conventions, §Arrow conventions, and §Card design language, and by the image-planner when it needs to know what a `remotion` slot can express before assigning that type.

**Prerequisite:** this blog's Remotion project exists at `{remotion_dir}` (scaffolded by `blog-setup` from `scaffold/remotion-starter/`), exporting this blog's locked visual tokens from `src/theme.ts` and the shared watermark component from `src/BlogWatermark.tsx`. This adapter never hardcodes a hex value, a font stack, or a pixel constant, everything routes through those two files so a wizard re-run (or a brand refresh) updates every composition without touching this doc.

**Optional background reading:** if `~/.claude/skills/remotion-best-practices/SKILL.md` exists on this machine (a general-purpose Remotion skill covering `<Still>`, `<Composition>`, `staticFile`, and the other underlying primitives this adapter assumes), `Read` it once before writing this run's first composition, it's genuinely useful background for anyone not already fluent in Remotion itself. This is best-effort only: this adapter documents solely the conventions layered on top of Remotion for this blog, so proceed normally and never hard-fail or block on that file's absence.

## Project layout

```
{remotion_dir}/
├── public/                 ← static assets (icons, logos); check here before adding a new one
├── src/
│   ├── Root.tsx             ← register every new <Still> here
│   ├── theme.ts              ← CANVAS, TITLE_TOP, SAFE_MARGIN, palette, fonts, watermark
│   ├── BlogWatermark.tsx     ← shared watermark component
│   └── <id>.tsx    ← one file per composition
└── out/                     ← preview renders only; never committed, never read by publish
```

## Theme tokens (import, never inline)

`src/theme.ts` exports:

- `CANVAS` — `{ width: 1800, height: 1200 }`, this blog's native canvas.
- `TITLE_TOP` — `110`, px from top; the featured-slot title band position.
- `SAFE_MARGIN` — `120`, px inset from every edge; keep primary content inside it.
- `palette` — `{ background, surface, border, text, muted, primary, accent, warn }`.
- `fonts` — `{ sans, mono }`.
- `watermark` — `{ text, opacity }`.

Every composition imports these from `./theme` (or the correct relative path) rather than inlining a color, font stack, or canvas dimension. This is what keeps every image, across every post and every image strategy, in one visual family, and it's what a wizard re-run (re-reading `{profile_dir}/image-style.md`) can safely rewrite without touching individual composition files.

## Worktree-safe invocation

Every command below resolves the repo root dynamically:

```bash
REPO=$(git rev-parse --show-toplevel)
```

Never hardcode an absolute path (`/Users/...` or otherwise). A hardcoded path silently reads/writes the MAIN checkout when the actual work is happening in a git worktree, this has caused real data loss before; always derive `REPO` fresh.

## Featured vs. in-post layout (decide first)

Classify the slot before writing any JSX, it changes the whole layout:

- **Featured** (the `## Featured image` slot, `Suggested filename` typically `featured.png`): the post's frontmatter `title:` rendered **verbatim** (never reworded, shortened, summarized, or swapped for a punchier headline) at `TITLE_TOP`, centered, full canvas width. An optional one-line subtitle sits below the title band. `<BlogWatermark />` is present. The composition filling the remaining vertical band follows the slot's `Archetype:` from `images.md` (chosen by the image-planner via the rotation ledger) — object-metaphor, split-contrast, big-number, negative-space, etc. — NOT a default card-and-arrow diagram. The archetype varies composition only; title band, watermark, safe margin, palette, and fonts are identical across every cover. When mimicking a reference composition, take its code conventions (theme imports, helpers, watermark usage), never its layout.
- **In-post** (every `### Image N` slot under `## In-post images`): **NO title, NO subtitle.** The diagram starts near the top safe margin and fills the whole canvas. If a slot's `images.md` production spec somehow lists a title or subtitle for an in-post entry, ignore it, this rule wins; an in-post image carrying a title is the most common single defect in this pipeline.

### Vertical layout budget (featured slot)

Budget the vertical space before writing any JSX, a composition that looks fine in isolation can still silently overflow the canvas once title, watermark, and diagram are all accounted for:

- **Title bottom:** roughly `TITLE_TOP` plus one title line (~120px) with no subtitle, or `TITLE_TOP` plus title-and-subtitle (~150px) when a subtitle is present. For this project's default tokens (`TITLE_TOP=110`), that's y≈230 without a subtitle, y≈260 with one.
- **Subtitle line** (featured only, if used): fixed at `TITLE_TOP + 86`, one line, never wrapped.
- **Watermark top:** roughly `CANVAS.height - 100`, y≈1100 for the default 1200px canvas height.
- **Vertical centering:** aim the diagram's visual center of mass at the midpoint of the remaining band (title bottom to watermark top), roughly y≈650-700 for the defaults above. A composition crammed near the title or crammed near the watermark reads as unbalanced even when nothing technically overlaps.
- **Stacked-card budget:** for N cards stacked vertically in that band, `(N-1) × CARD_GAP + N × CARD_H` must fit inside `watermark top − title bottom` (≈840-870px for the defaults above). Example working values for 3 stacked cards: `CARD_H≈256, CARD_GAP≈280`. If a card's content (a product mockup, a multi-line label) pushes the stack over budget, tighten the gap and intra-card padding first; only shrink a font below its §Typography floor as a last resort, and never the title.

## Color conventions

All colors below are theme-token references, never literal hex values:

- Canvas background: `palette.background`.
- Card/panel surfaces: `palette.surface`, with a `1px solid palette.border` edge (see §Card design language).
- Primary text (titles, card titles, body copy): `palette.text`.
- Secondary/muted text (subtitles, captions, mono detail rows, inactive labels): `palette.muted`.
- `palette.primary` and `palette.accent` are highlight colors, use them **sparingly**. Reserve `palette.accent` for exactly one "this is the answer / the chosen path / the outcome" role per composition, if everything is accent-colored, nothing reads as emphasized.
- `palette.warn` is reserved for a genuine warning/failure/error state (a broken branch, a caution callout), never used decoratively.
- Don't dim an inactive element with `opacity < 1`, it crushes text/border contrast and reads as broken rather than "inactive". Convey "inactive / disabled / not applicable" with `palette.muted` text and a lighter border tint instead, plus an explicit state label if needed.

## Typography

- `fonts.sans`: titles, card titles, body/table text, section tags, status labels, brand names.
- `fonts.mono`: URLs, IDs, prices, percentages, counts, any value that reads as "data" rather than prose.
- The title (featured slots only) is the largest text in the composition, centered at `TITLE_TOP`.
- Treat the theme's type scale as a floor, not a target to shrink from. When content threatens to overflow, widen the card or canvas region and tighten padding/gaps first; only reduce a font size as a last resort, and never shrink the title.
- No em-dash (U+2014) in any rendered text or alt text, substitute comma, colon, period, or parens. No circled/enclosed Unicode glyphs or a literal check/cross character as text, headless renderers frequently drop them; draw a check/X inside a small styled badge instead.

## Card design language

A card is the workhorse layout primitive for **in-post diagrams**. Featured covers use cards only when the slot's chosen archetype genuinely calls for them (`diagram-lite`, or a `split-contrast` built from two panels) — an `object-metaphor`, `big-number`, `pattern-break`, or `negative-space` cover defaulting to a card grid is the composition-sameness bug this distinction exists to prevent. Standard recipe, all values from theme tokens:

```tsx
{
  background: palette.surface,
  border: `1px solid ${palette.border}`,
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 6px rgba(15,23,42,0.04)",
  padding: "26px 28px",
}
```

- **Neutral variant**: the standard recipe above, the default for most cards in a diagram.
- **Emphasis / outcome variant**: swap the background toward a light `palette.accent` tint and the border to `2px solid palette.accent`. Use this for exactly the one card representing the outcome the image is arguing for (the matched option, the recommended path, the passing state), never for more than one card per composition, or the emphasis is lost.
- **Warning/failing variant**: border and status text tinted toward `palette.warn`, used for a card representing a failure or broken state.
- Every element inside a card needs visible breathing room: no label touching its own card's edge, no two cards touching or overlapping, no card touching the watermark.
- A long string (a URL, a full sentence) that would overflow a single-line pill gets a wrapped, multi-line card instead, never an oversized single-line pill.

## Realistic illustration inside media-surface tiles

The rest of this adapter stays deliberately flat, but **inside a media-surface tile** — a product mockup, a video thumbnail, a browser-chrome frame, anything simulating a real visual surface rather than an abstract diagram element — a gradient-based illustration reads as a believable photo-like surface without sourcing any actual imagery:

- **Container:** a rounded rectangle (12-16px radius), `1px solid palette.border`, with a subtle vertical gradient backdrop from `palette.surface` toward a slightly darker neutral, plus a small inset shadow near the bottom for a "resting on a surface" feel.
- **Ground shadow:** one `<ellipse>` near the bottom of the tile's SVG content, filled with a radial gradient fading to transparent, sells the "floating object on a plain background" look.
- **Volume on multi-part objects** (a device with two halves, a container with a lid): layer 2-3 `<radialGradient>` stops per part, light-to-dark from one corner toward the opposite one, to fake depth without a real photo.
- **Perspective:** a slight 3/4 view (one element rotated a few degrees behind the main one) reads as a real object; a flat front-on view reads as an icon instead.
- **Brand badges inside a tile:** never draw a real third-party wordmark or logo. A small neutral rounded-rect strip (a plain colored bar at low opacity) reads as "this carries a brand mark" without being one.

Gradients stay confined to these tiles. Cards, pills, arrows, and badges elsewhere in the composition remain flat, per the rest of this adapter.

## Annotated screenshots (sub-style)

Some in-post slots need an annotated screenshot of a real UI (an email, a third-party product page, a settings screen) rather than a from-scratch diagram. Two rules layer on top of the standards above:

- **Callout rectangles:** `3px solid palette.warn`, rounded corners (~6px), no fill. Place directly around the element being called out.
- **Pill labels:** white background, `1.5px solid palette.warn` border, `palette.warn` text, semibold, soft warn-tinted shadow. Position outside the rectangle (left or right side, whichever has room), vertically centered on the rect's midpoint. Wrap this as a reusable `<AnnotationBox x y w h label labelSide>` component so every annotated screenshot in this project shares one implementation instead of each composition hand-rolling its own callout.
- **Canvas size may deviate from the standard `CANVAS` dimensions** for this sub-style only, when the underlying UI screenshot needs a different aspect ratio (e.g. a tall narrow email capture). When it does, scale the title font and watermark proportionally, they're guides for this non-hero case, not hard rules.

## In-post stacked comparisons

Before/after and "two options compared" in-post images use this language, not nested annotation boxes, step pills, or full card treatments:

- **Centered section tag:** a pill with a tinted background (`palette.warn` tint + text for the bad/before side, `palette.accent` tint + text for the good/after or neutral side), bold, uppercase, generous horizontal padding, centered in a full-width wrapper.
- **~40px gap** between a section tag and the content block it introduces, a tag sitting flush against its block reads as cramped.
- **A full-width 1px `palette.border` divider** between the two stacked sections.
- **Stack top-to-bottom, not side-by-side**, whenever either half needs more width than a half-column can give it.
- **Stay sparse.** A light chip or two plus a thin connector communicates the comparison better than bordered cards with sub-labels stacked on top of each other.

## Arrow conventions

For any diagram that needs directional flow (a source fanning to destinations, sequential steps):

- **Active/primary path** (the path a reader should follow to "the answer"): `palette.accent`, thick stroke (`strokeWidth={4}`), solid, rounded line caps, arrowhead marker in the same color.
- **Alternative/not-taken path**: `palette.muted` (or `palette.border` for an even lighter touch), thinner stroke (`strokeWidth={2.5}`), dashed (e.g. `strokeDasharray="6 8"`), arrowhead marker in the same muted color.
- **Sequential step connector** (1→2→3→4, no "chosen vs. not chosen" meaning): `palette.muted`, `strokeWidth={2.5}`, solid.
- Map every point with fixed helper functions off a defined plot box or layout grid, never hand-place coordinates by eyeballing pixel offsets.
- **Horizontal flow rows** (`node → arrow → node → arrow → node`): give every arrow a FIXED identical length and a FIXED identical gap on both sides between nodes. Never use a flex-grown connector between variable-width nodes, uneven leftover space produces one long floating arrow next to a squished one.
- Use the accent stroke for at most one path per diagram, same "accent = the thing that matters" discipline as §Color conventions.

## Data charts (if a slot needs axes)

- Two pure helper functions (`xAt(value)`, `yAt(value)`) map a data value to a pixel position off a fixed plot box; never hand-place a point.
- Axis lines: `palette.border`, solid; gridlines a step lighter, optionally dashed.
- Tick labels: `fonts.mono` for numbers/figures, `fonts.sans` for axis titles.
- This blog's own series: `palette.accent`; a comparison/competitor series: `palette.muted`. Same accent-means-emphasized semantics as the rest of this adapter.
- Decide the axis range before the first render, range is a design choice, not a data fact: pick a max that keeps every series legible, not crushed flat against an axis.

## Icons and static assets

Check `{remotion_dir}/public/` for an existing asset before creating a new one. Reference via `<Img src={staticFile("<name>")} />`. List every icon/SVG asset a slot needs in the `images.md` production spec's "Icons / SVG assets" field so the render doesn't stall on a missing file mid-run.

## Step 1: One composition per image

For the post's `remotion` slots, get every slot's names in one call, in
`images.md` order:

    node ${CLAUDE_PLUGIN_ROOT}/adapters/images/scripts/composition-id.mjs <slug> <Suggested filename> [<Suggested filename> ...]

It prints, per slot, `id`, `file` and `identifier`. Never derive these by
hand. Create `{remotion_dir}/src/<file>` whose component is
`export const <identifier>`, and register it in `{remotion_dir}/src/Root.tsx`:

```tsx
import { <identifier> } from "./<id>";

<Still
  id="<id>"
  component={<identifier>}
  width={CANVAS.width}
  height={CANVAS.height}
/>
```

An existing `<file>` is this post's (only this post can produce an id
starting with `<slug>--`): a resume reuses it.

`component` takes the component REFERENCE (the imported identifier, e.g. `component={SampleDiagram}` per `scaffold/remotion-starter/src/Root.tsx`), never a JSX element (`component={<SampleDiagram />}`) — passing a JSX element here breaks `<Still>`.

### Quick-start shell (copy-paste starting point)

A minimal composition to copy into a new `<file>` and edit from there. Replace `<identifier>` with the identifier the composition-id script printed, so the `Root.tsx` import matches. Delete the title block entirely for an in-post composition (§Featured vs. in-post layout above):

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { BlogWatermark } from "./BlogWatermark";
import { CANVAS, TITLE_TOP, SAFE_MARGIN, palette, fonts } from "./theme";

export const <identifier>: React.FC = () => (
  <AbsoluteFill style={{ background: palette.background, fontFamily: fonts.sans, color: palette.text }}>
    {/* FEATURED ONLY - delete this whole block for an in-post composition. */}
    <div style={{
      position: "absolute", top: TITLE_TOP, left: 0, width: CANVAS.width,
      textAlign: "center", fontSize: 78, fontWeight: 700, letterSpacing: -1.1,
    }}>
      {/* the post's frontmatter title, verbatim, never reworded */}
    </div>

    {/* diagram content goes here, inside the SAFE_MARGIN inset;
        featured: centered around y≈650-700 (see §Vertical layout budget above);
        in-post: starts near the top safe margin, fills the canvas */}

    <BlogWatermark />
  </AbsoluteFill>
);
```

Register it in `Root.tsx` per Step 1 above before rendering.

## Step 2: Preview render (iteration, throwaway)

Every render during design iteration goes to `out/`, never to the assets dir:

```bash
REPO=$(git rev-parse --show-toplevel) && cd "$REPO/{remotion_dir}" && \
  npx remotion still <id> --output=out/preview-<name>-v1.png
```

Bump the version suffix per iteration (`preview-<name>-v2.png`, ...) so earlier attempts stay available for comparison. `npx remotion studio --port=3003` is available for interactive iteration when a human is driving directly (not inside the autonomous dispatch below).

## Step 3: Final export

Only after the composition passes the eyeball checklist below (in autonomous mode: after the one sanctioned render attempt). Renders at 2x scale directly into this post's asset folder in the CURRENT tree:

```bash
REPO=$(git rev-parse --show-toplevel) && cd "$REPO/{remotion_dir}" && \
  npx remotion still <id> --scale=2 \
  --output="$REPO/{assets_dir}/<slug>/<filename>"
```

`<filename>` is the slot's `Suggested filename` **verbatim**, never append an extra extension. `--scale=2` renders the 1800x1200 canvas at 3600x2400.

## Eyeball checklist (MANDATORY before recording a slot `rendered`)

`Read` the rendered PNG file and inspect it, an unseen render is not verified, "looks right in the JSX" does not satisfy this checklist:

- [ ] Featured slot: the title band carries the post title verbatim, centered, at `TITLE_TOP`.
- [ ] In-post slot: NO title, NO subtitle anywhere on the canvas.
- [ ] `<BlogWatermark />` is present, undisturbed (never inlined, never repositioned), with clear space around it (nothing within ~40px).
- [ ] No element overlaps or touches another, a whole-box check: a label vs. the card it sits beside, two cards, a connector vs. a card, all included.
- [ ] Borders/fields are visibly contrasted against the background.
- [ ] No caption or label is clipped or wraps into a stray line.
- [ ] No stray or ambiguous glyphs (see §Typography's glyph rule).
- [ ] A long string uses a wrapped multi-line card, not an overflowing single-line pill.

Any hit on this list is a re-render, fix the composition and render again, never ship with a note explaining the defect away.

## Autonomous mode (dispatched from `generate-images`)

When this adapter is executed as part of `${CLAUDE_PLUGIN_ROOT}/skills/generate-images/SKILL.md` (i.e., by the `image-builder` agent, not a human driving Remotion Studio):

- Do NOT open Studio, do NOT iterate per image, do NOT wait for chat approval per render. One render attempt per slot.
- Skip Step 2 (the `out/` preview loop) and render straight to the final destination (Step 3), the review for this pipeline happens once, over the whole post in context, at Gate 2, not per-image in Studio.
- Still run the full eyeball checklist above on the rendered PNG before recording the slot `rendered`. A checklist hit is still a re-render, never a ship-with-note, even in autonomous mode.
- If a render attempt fails (a build error, a non-zero `npx remotion still` exit) or the checklist still fails after a reasonable retry, record the slot under `failed` with a reason and move on to the remaining slots, never abort the whole run over one slot.

For standalone Remotion work outside `generate-images` (a human driving Studio directly), the normal Step 2 iterate-then-sign-off-then-Step-3 sequence applies.

## Idempotency (resume)

`generate-images` skips a `remotion` slot whose `Suggested filename` already exists (non-empty) at `{assets_dir}/<slug>/`, before this adapter is even invoked for that slot. A resume run therefore renders only the missing subset. This adapter never deletes or silently overwrites an existing rendered file; if a specific image needs to be redone, delete the file first (the usual trigger is a Gate 2 "request changes → images" round, which re-spawns the builder for the flagged slots only).
