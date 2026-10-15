# README image style

The images in this folder share one look: the Pilcrino site's paper and character tints, the YouTube channel's type. Keep new images in it.

## Tokens

| Role | Value |
|---|---|
| Background | `#f8f0dc` (site paper) |
| Ink / muted | `#0d0d0d` / `#6b6257` |
| Tick | `#4a8c3a` |
| Alert | `#de4235` |
| Rules, cards | `#d6c4a2`, `#fffaf0` |
| Titles | Newsreader 400, 64px at 1600 wide, letter spacing -1.5; one italic muted line under it at 28px |
| Labels | Hanken Grotesk 500 (600 for emphasis), 17 to 30px |
| Files, commands, numbers | the system monospace |

## Cast

One helper per agent in `agents/`, each with a tool.

| Agent | Helper | Tint | Tool |
|---|---|---|---|
| blog-researcher | Researcher | periwinkle `#9db8e6` | magnifier |
| plan-reviewer | Plan checker | peach `#f0b89a` | clipboard |
| blog-writer | Writer | mint `#a9cf9a` | pencil |
| blog-reviewer | Reviewer | coral `#ec8a7a` | bug net; a red bug is an unsourced claim |
| blog-humanizer | Polisher | lilac `#cdb8df` | paint roller |
| image-planner | Image planner | sage `#bfcf8c` | chart board |
| image-builder | Image builder | butter `#efc85f` | hard hat and wrench |

The owner appears as a speech bubble (asking) or a reply in Claude Code, never as a helper.

## Rules

- One glance per still image; labels are one or two words.
- A gif may carry more words, one caption at a time, never all at once.
- Example data is made up (Driplane, Mailcrate, Loopwise): no real company's numbers.
- Never say a post is live after a merge without the platform: a merge publishes only on a site built from the repository.

## Building

Each page in `src/` draws one frame for `?t=<seconds>`, with no CSS animation, so every frame is deterministic. `kit.js` draws the characters and tools, `common.js` holds the tokens and `helper()`.

```sh
cd .github/assets/src
./render.sh banner 0 ../banner.png 2 1200,350        # a still, at 2x
./build-gif.sh flow 288 ../how-a-post-is-made.gif    # a gif, frames at ten a second
```

`build-gif.sh` needs headless Chrome, `ffmpeg` and `python3`. Gifs are built at the page's own size (1600 wide) with a 256-colour palette: scaling down blurs the text. Keep each gif under 2 MB.

| File | Page | Frames | Size |
|---|---|---|---|
| `banner.png` | `banner` | still, 2x | 1200,350 |
| `how-a-post-is-made.gif` | `flow` | 288 | 1600,620 |
| `one-plugin-many-blogs.gif` | `blogs` | 100 | 1600,620 |
| `the-agents.png` | `agents` | still, 2x | 1600,660 |
| `the-skills.gif` | `skills` | 90 | 1600,720 |
| `content-plan.gif` | `plan` | 120 | 1600,620 |
| `competitor-fact-sheets.gif` | `competitors` | 130 | 1600,660 |
| `facts-file.gif` | `facts` | 130 | 1600,690 |
| `polish-keeps-facts.gif` | `polish` | 110 | 1600,640 |
| `images-in-your-style.gif` | `style` | 120 | 1600,640 |
| `published-as-a-pr.gif` | `publish` | 120 | 1600,640 |
| `its-own-browser.gif` | `browser` | 120 | 1600,660 |
| `setup.gif` | `setup` | 156 | 1600,640 |
