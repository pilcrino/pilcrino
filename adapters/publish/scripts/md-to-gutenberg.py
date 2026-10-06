#!/usr/bin/env python3
"""Convert a finalized blog markdown file to WordPress Gutenberg block markup.

Why: posting raw HTML into the WordPress REST `content` field makes WordPress
wrap the ENTIRE post as one legacy "Classic" block — the post then loses the
theme's native block styling (spacing, heading typography, image blocks,
TOC-plugin heading detection) and looks broken next to real Gutenberg posts.
This script emits native `wp:paragraph` / `wp:heading` / `wp:list` /
`wp:list-item` / `wp:image` / `wp:quote` / `wp:code` / `wp:table` blocks
instead, using only the Python standard library (re, html, json, argparse,
os, sys — no third-party markdown parser dependency).

Supported markdown subset (deliberately a plain-markdown core, not a full
CommonMark implementation):
  - ATX headings `#`..`######` -> wp:heading (level carried in block attrs)
  - paragraphs, with inline **bold**, *italic*, `code`, and [text](url) links
  - unordered lists (`-`, `*`, `+`) and ordered lists (`1.`) -> wp:list +
    wp:list-item (one level deep; no nested-list support)
  - image-only lines `![alt](url)` -> wp:image, URL embedded AS-IS (the
    caller/adapter is responsible for substituting real uploaded media URLs
    for local paths BEFORE or AFTER running this script — see
    adapters/publish/wordpress-rest.md §Staging for the exact ordering used
    in this plugin; this script never uploads media or resolves a media ID)
  - blockquotes (`>` prefixed lines, blank `>` lines split multiple
    paragraphs inside the same blockquote) -> wp:quote
  - fenced code blocks (``` ... ```, language tag after the opening fence is
    ignored) -> wp:code

This script is theme/plugin agnostic: it NEVER hardcodes a block-library- or
theme-specific block (nothing like `wp:kadence/*`). Anything beyond the core
set above (e.g. a Table-of-Contents block matching a specific blog's existing
posts) is the CALLER's job, supplied via --extra-blocks (see below) — that
data comes from the blog's recorded site-conventions, not from this script.

CLI:
  python3 md-to-gutenberg.py <input.md> [--extra-blocks <json-file-or-json>]
  # block markup is written to stdout; frontmatter/logging goes to stderr

--extra-blocks accepts either a path to a JSON file or an inline JSON string.
Either way it must parse to a JSON list of insertion objects:
  [{"position": "top", "markup": "<!-- wp:... -->...<!-- /wp:... -->"}, ...]
`position` is one of:
  - "top"                     insert before the very first block
  - "after-intro"             insert right after the intro paragraph(s),
                               i.e. right before the first heading (or at the
                               end of the document if there is no heading)
  - "before-heading:<text>"   insert right before the heading whose exact
                               (trimmed) text matches <text>; a non-matching
                               heading is reported on stderr and skipped
                               (a bad hook target never aborts the whole run)

If --extra-blocks names a path that doesn't exist and isn't itself valid
inline JSON either (the common no-recorded-TOC case: the caller passed the
flag anyway, or a stale/never-created temp path), this is reported on stderr
and treated as no insertions — NOT a hard error; see load_extra_blocks below
for why a readable-but-malformed file is treated differently (hard error).

Frontmatter: stripping the leading YAML frontmatter block is normally the
CALLER's job (the adapter's existing awk step), but this script is defensive
about it — if the input file starts with `---`, the frontmatter block is
stripped here too, with a warning on stderr, so a caller that forgets the
strip step doesn't ship a literal frontmatter blob into the post body.
"""
import argparse
import html
import json
import os
import re
import sys


def strip_frontmatter(md):
    if md.startswith('---'):
        stripped = re.sub(r'^---\n.*?\n---\n?', '', md, count=1, flags=re.S)
        if stripped != md:
            print(
                "warning: input markdown starts with a frontmatter block (---); "
                "stripping it here defensively — the caller is expected to have "
                "already done this (see adapters/publish/wordpress-rest.md)",
                file=sys.stderr,
            )
            return stripped
        else:
            print(
                "warning: input starts with '---' but no closing frontmatter fence found; passing through unchanged",
                file=sys.stderr,
            )
    return md


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', t)
    return t.strip()


def convert(md):
    body = strip_frontmatter(md).strip()

    blocks = []  # list of {"kind": str, "markup": str, "heading_text": str|None}

    def para(t):
        t = inline(t)
        if t.strip():
            blocks.append({
                "kind": "paragraph",
                "markup": f'<!-- wp:paragraph -->\n<p>{t}</p>\n<!-- /wp:paragraph -->',
            })

    def heading(text, level):
        attrs = '' if level == 2 else ' {"level":%d}' % level
        blocks.append({
            "kind": "heading",
            "heading_text": text.strip(),
            "markup": f'<!-- wp:heading{attrs} -->\n<h{level} class="wp-block-heading">{inline(text)}</h{level}>\n<!-- /wp:heading -->',
        })

    def image(url, alt):
        safe_url = html.escape(url, quote=True)
        safe_alt = html.escape(alt, quote=True)
        blocks.append({
            "kind": "image",
            "markup": (
                '<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->\n'
                f'<figure class="wp-block-image size-large"><img src="{safe_url}" alt="{safe_alt}"/></figure>\n'
                '<!-- /wp:image -->'
            ),
        })

    def lst(items, ordered):
        attrs = ' {"ordered":true}' if ordered else ''
        tag = 'ol' if ordered else 'ul'
        lis = "".join(f'<!-- wp:list-item -->\n<li>{inline(x)}</li>\n<!-- /wp:list-item -->\n' for x in items)
        blocks.append({
            "kind": "list",
            "markup": f'<!-- wp:list{attrs} -->\n<{tag} class="wp-block-list">\n{lis}</{tag}>\n<!-- /wp:list -->',
        })

    def quote(quote_lines):
        paras, cur = [], []
        for l in quote_lines:
            if l.strip() == '':
                if cur:
                    paras.append(' '.join(cur))
                    cur = []
            else:
                cur.append(l.strip())
        if cur:
            paras.append(' '.join(cur))
        inner = "".join(f'<p>{inline(p)}</p>' for p in paras)
        blocks.append({
            "kind": "quote",
            "markup": f'<!-- wp:quote -->\n<blockquote class="wp-block-quote">{inner}</blockquote>\n<!-- /wp:quote -->',
        })

    def code(text):
        escaped = html.escape(text, quote=False)
        blocks.append({
            "kind": "code",
            "markup": f'<!-- wp:code -->\n<pre class="wp-block-code"><code>{escaped}</code></pre>\n<!-- /wp:code -->',
        })

    def table(header, rows):
        thead = "<thead><tr>" + "".join(f'<th>{inline(h)}</th>' for h in header) + "</tr></thead>"
        tbody = "<tbody>" + "".join(
            "<tr>" + "".join(f'<td>{inline(c)}</td>' for c in row) + "</tr>" for row in rows
        ) + "</tbody>"
        blocks.append({
            "kind": "table",
            "markup": f'<!-- wp:table -->\n<figure class="wp-block-table"><table>{thead}{tbody}</table></figure>\n<!-- /wp:table -->',
        })

    lines = body.split("\n")
    n = len(lines)
    k = 0
    while k < n:
        s = lines[k].strip()
        if not s:
            k += 1
            continue

        mimg = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)$', s)
        if mimg:
            image(mimg.group(2), mimg.group(1))
            k += 1
            continue

        mh = re.match(r'^(#{1,6})\s+(.*)$', s)
        if mh:
            heading(mh.group(2), len(mh.group(1)))
            k += 1
            continue

        if s.startswith('```'):
            k += 1
            code_lines = []
            while k < n and not lines[k].strip().startswith('```'):
                code_lines.append(lines[k])
                k += 1
            k += 1  # skip the closing fence
            code("\n".join(code_lines))
            continue

        if s.startswith('>'):
            quote_lines = []
            while k < n and lines[k].strip().startswith('>'):
                quote_lines.append(re.sub(r'^\s*>\s?', '', lines[k]))
                k += 1
            quote(quote_lines)
            continue

        if s.startswith('|') and k + 1 < n and re.match(
            r'^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$', lines[k + 1].strip()
        ):
            header = [c.strip() for c in s.strip('|').split('|')]
            k += 2
            rows = []
            while k < n and lines[k].strip().startswith('|'):
                rows.append([c.strip() for c in lines[k].strip().strip('|').split('|')])
                k += 1
            table(header, rows)
            continue

        if re.match(r'^[-*+]\s+', s):
            items = []
            while k < n and re.match(r'^\s*[-*+]\s+', lines[k]):
                items.append(re.sub(r'^\s*[-*+]\s+', '', lines[k]))
                k += 1
            lst(items, False)
            continue

        if re.match(r'^\d+\.\s+', s):
            items = []
            while k < n and re.match(r'^\s*\d+\.\s+', lines[k]):
                items.append(re.sub(r'^\s*\d+\.\s+', '', lines[k]))
                k += 1
            lst(items, True)
            continue

        buf = [s]
        k += 1
        while k < n and lines[k].strip() and not re.match(r'^(#{1,6}\s|[-*+]\s|\d+\.\s|!\[|>|```|\|)', lines[k].strip()):
            buf.append(lines[k].strip())
            k += 1
        para(" ".join(buf))

    return blocks


def resolve_position(position, blocks):
    if position == "top":
        return 0
    if position == "after-intro":
        for i, b in enumerate(blocks):
            if b["kind"] == "heading":
                return i
        return len(blocks)
    if position.startswith("before-heading:"):
        target = position[len("before-heading:"):].strip()
        for i, b in enumerate(blocks):
            if b["kind"] == "heading" and b.get("heading_text", "").strip() == target:
                return i
        print(
            f"warning: --extra-blocks position 'before-heading:{target}' matched no heading; skipping this insertion",
            file=sys.stderr,
        )
        return None
    print(f"warning: unknown --extra-blocks position '{position}'; skipping this insertion", file=sys.stderr)
    return None


def load_extra_blocks(arg):
    if arg is None:
        return []
    data = None
    # Two distinct failure modes, deliberately handled differently:
    #   - `arg` IS an existing, readable file, but its contents fail to parse
    #     as JSON: hard error (exit 1). This file is only ever produced by
    #     the caller's own jq step (adapters/publish/wordpress-rest.md
    #     §Staging step 3) from the recorded site-conventions.md TOC, so
    #     broken JSON here means that upstream step itself is broken —
    #     degrading silently would silently drop the TOC block with no
    #     visible sign anything went wrong.
    #   - `arg` is neither a readable file NOR a valid inline JSON string
    #     (the common case: no TOC has been recorded for this blog yet, so
    #     the caller's guard skipped creating the file, but --extra-blocks
    #     was still invoked with that now-nonexistent path): warn and
    #     degrade to no insertions, same graceful-degradation convention this
    #     script already applies to malformed items (see apply_extra_blocks)
    #     and unmatched --extra-blocks positions (see resolve_position).
    if os.path.isfile(arg):
        with open(arg) as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                print(f"error: --extra-blocks file '{arg}' is not valid JSON: {e}", file=sys.stderr)
                sys.exit(1)
    else:
        try:
            data = json.loads(arg)
        except json.JSONDecodeError:
            print(
                f"warning: extra-blocks source not found/parseable: {arg}; continuing without insertions",
                file=sys.stderr,
            )
            return []
    if not isinstance(data, list):
        print("error: --extra-blocks JSON must be a list of {position, markup} objects", file=sys.stderr)
        sys.exit(1)
    return data


def apply_extra_blocks(blocks, extra_blocks):
    insertions = []
    for item in extra_blocks:
        position = item.get("position")
        markup = item.get("markup")
        if not isinstance(position, str) or not isinstance(markup, str):
            print(
                f"warning: malformed --extra-blocks item (missing or non-string 'position' or 'markup'): {item}; skipping",
                file=sys.stderr,
            )
            continue
        idx = resolve_position(position, blocks)
        if idx is not None:
            insertions.append((idx, markup))
    insertions.sort(key=lambda pair: pair[0])
    offset = 0
    for idx, markup in insertions:
        blocks.insert(idx + offset, {"kind": "extra", "markup": markup})
        offset += 1
    return blocks


def main():
    ap = argparse.ArgumentParser(
        description="Convert finalized blog markdown to WordPress Gutenberg block markup."
    )
    ap.add_argument("input", help="path to the finalized markdown file")
    ap.add_argument(
        "--extra-blocks",
        dest="extra_blocks",
        default=None,
        help="JSON file path or inline JSON: a list of {position, markup} insertions",
    )
    args = ap.parse_args()

    md = open(args.input).read()
    blocks = convert(md)
    blocks = apply_extra_blocks(blocks, load_extra_blocks(args.extra_blocks))

    sys.stdout.write("\n\n".join(b["markup"] for b in blocks) + "\n")


if __name__ == "__main__":
    main()
