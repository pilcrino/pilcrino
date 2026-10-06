---
name: generate-image-codex
description: Generate one AI illustration for a blog post by handing an images.md prompt to codex's built-in image model (gpt-image), saving a PNG to the post's asset folder (or to an explicit output path the caller supplies). The sole automated AI-image path in pilcrino. Needs no OPENAI_API_KEY (codex authenticates itself). Invoked per ai-prompt slot by the generate-images skill / image-builder agent, or standalone by a human ("generate the featured image").
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# generate-image-codex

Generate a blog illustration by handing the slot's image brief to **codex's built-in imagegen skill** (`codex exec`), then write the PNG to `{assets_dir}/<slug>/<Suggested filename>` (or to an explicit output path when the caller supplies one — see Inputs; then no asset dir is touched). Produces a real file; publishes nothing.

## Inputs (from the caller / the slot's images.md entry)

- `slug`
- The slot's `Prompt:` block, verbatim (already carries house style + archetype + wordmark + any baked-in title, per the image-planner quality bar in `${CLAUDE_PLUGIN_ROOT}/adapters/images/ai-prompt.md`).
- `Suggested filename` and the aspect ratio (default `1536x1024`, 3:2).
- Optional: an explicit absolute output path from the caller (e.g. the blog-setup wizard's test generation writes to a temp dir). When given, it REPLACES the `{assets_dir}/<slug>/<Suggested filename>` destination everywhere below — nothing touches any asset dir.
- When invoked standalone (no caller resolved paths, no explicit output path): read `blog-ops/config.yaml` and resolve `{assets_dir}` from the active publish adapter's config block, and the slot's `Prompt:` block from `{drafts_dir}/<slug>/images.md`.

## Procedure

Let `<dest>` be the explicit output path when the caller supplied one (see Inputs), otherwise `{assets_dir}/<slug>/<Suggested filename>`. Every path below resolves through `<dest>` — with an explicit path supplied, no asset dir is created, resolved, or written.

Let `<aspect>` and `<WxH>` be the slot's requested aspect ratio and pixel dimensions (from the slot's `Aspect ratio` field in `images.md` / the caller-passed value) — e.g. `16:9` / `1344x768` for an in-post diagram, `1.91:1` / `1536x804` for an og-style hero. Default to `3:2` / `1536x1024` only when the slot specifies no ratio. Never hardcode 3:2: an in-post or hero slot that asked for a different shape must be generated at that shape, or it breaks the planner/template contract and the frontmatter cover dimensions.

1. Ensure `<dest>`'s parent directory exists (when called from `generate-images` and `<dest>` is the asset-dir default, its ownership guard already created `{assets_dir}/<slug>/` + the `.staged-by-blog-workflow` sentinel; standalone with the asset-dir default, create it if missing; explicit output path → `mkdir -p` its parent, i.e. `dirname <dest>`).
2. Run codex non-interactively, giving it ONLY the image brief + a save instruction:
   ```bash
   codex exec --sandbox workspace-write --add-dir ~/Downloads - <<'EOF'
   <the slot Prompt block, verbatim>

   Aspect ratio <aspect> (<WxH>). Please save the picture to the Downloads folder with the filename <Suggested filename>.
   EOF
   ```
   Use a long Bash timeout (~560000 ms); image generation takes 1-3 minutes. codex prints the saved path + dimensions.
3. Move it into place and verify:
   ```bash
   cp ~/Downloads/<Suggested filename> <dest>
   file <dest>   # expect PNG at <WxH> (the slot's requested dimensions)
   ```
   Read (view) `<dest>`: correct concept, palette on-brand per `{profile_dir}/image-style.md`, this blog's wordmark present + spelled right (when `image-style.md` requires one), and for a hero, the title text legible + correctly spelled. Re-run once with a tightened brief if it is off.

## Gotchas (load-bearing — learned 2026-07-18)

- **Use `--sandbox workspace-write`.** The `--dangerously-bypass-approvals-and-sandbox` flag is BLOCKED by Claude Code's auto-mode classifier; do not use it. `--add-dir ~/Downloads` lets codex also write there.
- **Do NOT over-constrain the prompt.** Telling codex to "call the OpenAI Images API with OPENAI_API_KEY, else print NO_IMAGE_CREDENTIALS" makes it check the env var, find none, and bail. codex's built-in imagegen authenticates via its own codex/ChatGPT login — **no OPENAI_API_KEY needed.** Give it the image brief + "save the picture to …" and let it choose the tool.
- **Modern gpt-image renders described text reliably.** Bake the title + the blog's wordmark straight into the prompt (images.md already does, per the planner quality bar); verify but expect clean text. (The old "titles garble, overlay in Canva" caveat no longer applies.)
- **Filename:** codex sometimes names the file itself. Name it in the save instruction; if it still uses its own name, grab the newest PNG (`ls -t ~/Downloads/*.png | head -1`).
- **One slot per run** is most reliable; loop once per `ai-prompt` slot.
- **codex may composite the wordmark itself** (e.g. an ImageMagick overlay) when the model omits it from the render — that's expected and fine; judge the final PNG, not the method.
- **codex missing / not logged in:** if `codex` is not on PATH or `codex exec` fails to authenticate (headless/cron session with no codex login), fail cleanly — do not retry in a loop. The caller records the slot `failed` with the reason; the `Prompt:` block in images.md remains the manual fallback.

## What this skill does NOT do

- Does not publish, upload to WordPress, or change any post status. Image files only.
- Does not create `remotion` or `screenshot` slots.
- Does not author the prompt (the image-planner does, in images.md).
