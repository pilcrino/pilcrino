# AI-prompt image adapter (codex-automated)

Read by: the image-planner (planning time, so it knows the quality bar a `#### If ai-prompt` block must clear before it writes one), and `${CLAUDE_PLUGIN_ROOT}/skills/generate-images/SKILL.md` (dispatch time — which routes the slot through `${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md` for generation).

> **Naming note:** `ai-prompt` is a mild misnomer retained for config compatibility. It named the manual paste-a-prompt strategy through v0.3.0; since v0.4.0 the same type is generated automatically by codex's built-in gpt-image model (no API key). Existing configs (`images.enabled`, `featured_default`) keep working unchanged.

## What this adapter produces

A real image file. The prompt block lives in the slot's `images.md` entry (under `#### If ai-prompt`), written by the image-planner at Stage 4a to the quality bar below; at Stage 4a.5, `generate-images` hands that block to `${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md`, which runs `${CLAUDE_PLUGIN_ROOT}/skills/generate-image-codex/SKILL.md` and writes `{assets_dir}/<slug>/<Suggested filename>`.

## Disposition

- **Success** → `rendered` in the `generate-images` manifest.
- **Failure** (codex missing, not logged in, generation error) → `failed` with a reason. The `Prompt:` block stays untouched in `images.md` and remains exactly what a human would paste into an interactive AI image tool — the manual fallback. Same non-blocking contract as `${CLAUDE_PLUGIN_ROOT}/adapters/images/codex.md` §Disposition.
- The manifest's `prompt_pending` bucket is legacy (pre-v0.4.0, when this type was manual): no slot type maps to it anymore; it stays in the manifest schema, always empty.

## Prompt-block quality bar

The image-planner must satisfy every point below when it writes a slot's `#### If ai-prompt` block:

- **Style block.** Pull palette/mood/typography language from `{profile_dir}/image-style.md` so every AI-generated image in this blog reads as the same visual family, even though (unlike `remotion`) no shared component enforces this automatically for this strategy. Name the specific colors, textures, or references `image-style.md` locks in, don't just say "on-brand".
- **Composition.** State the subject, the foreground/background relationship, and the framing/angle, not just a topic. "A clean flat-illustration dashboard with three stacked bar charts, viewed head-on, generous whitespace, no browser chrome" is usable; "dashboard analytics" is not.
- **Archetype (featured slots only).** The prompt's composition must follow the `Archetype:` recorded in the slot's `images.md` entry (chosen by the image-planner via the rotation ledger, `suggest-images` §Featured-slot archetype) — the style block keeps every cover in one visual family; the archetype is what keeps consecutive covers from being the same picture. Say the archetype's composition out loud in the prompt (e.g. "one oversized central object, no panels or charts" for `object-metaphor`).
- **Aspect ratio.** State it explicitly: `3:2` to match the featured-slot default (keeps a mixed featured/in-post set visually consistent even across strategies), or the specific ratio an in-post chart/diagram needs (e.g. `16:9`). Never leave it implicit.
- **Negative prompts.** List what to exclude: text artifacts, watermarks, extra limbs/fingers, stray logos, fake UI chrome, and anything that would visually contradict this blog's locked palette.
- **Text-in-image warning.** Most AI image generators render in-image text (labels, numbers, UI copy) unreliably. If the concept needs exact, legible text or numbers, the prompt must say so explicitly and flag that the human generating it may need a post-processing text overlay rather than trust the model's raw output. Never assign `ai-prompt` to a slot whose whole point is a precise, verbatim numeric claim in the image, that belongs to `remotion`, which renders real text.
- **Style reference (if any).** Link a reference image, or point at the specific section of `image-style.md` the concept should anchor to.
- **Source data (if any).** Cite the `facts.md` row a chart-like image represents, so whoever generates it doesn't invent a shape that contradicts the post's own numbers.

## What the human does with an `ai-prompt` slot

Normally nothing — the slot is generated automatically at Stage 4a.5. Only when a slot is recorded `failed` (codex unavailable or the generation errored):

1. Open the slot's entry in `{drafts_dir}/<slug>/images.md`, copy the `Prompt:` block verbatim.
2. Paste into any AI image tool (e.g. Midjourney, ChatGPT image, Ideogram).
3. Save the output to `{assets_dir}/<slug>/<Suggested filename>` verbatim, never append an extra extension.
4. Tick the matching entry in `action-items.md` §1 once the file is on disk.
