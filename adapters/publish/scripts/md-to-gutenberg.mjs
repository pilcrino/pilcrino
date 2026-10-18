#!/usr/bin/env node
// Converts a finalized blog markdown file to WordPress Gutenberg block markup.
//
// Why: posting raw HTML into the WordPress REST `content` field makes WordPress
// wrap the ENTIRE post as one legacy "Classic" block, so the post loses the
// theme's native block styling (spacing, heading typography, image blocks,
// TOC-plugin heading detection) and looks broken next to real Gutenberg posts.
// This script emits native wp:paragraph / wp:heading / wp:list / wp:list-item /
// wp:image / wp:quote / wp:code / wp:table blocks instead, with no dependency
// beyond Node itself (it replaced a Python script of the same name, so a
// Windows machine without python3 can publish to WordPress).
//
// Supported markdown subset (a plain-markdown core, not full CommonMark):
//   - ATX headings `#`..`######` -> wp:heading (level carried in block attrs)
//   - paragraphs, with inline **bold**, *italic*, `code`, and [text](url) links
//   - unordered lists (`-`, `*`, `+`) and ordered lists (`1.`) -> wp:list +
//     wp:list-item (one level deep; no nested-list support)
//   - image-only lines `![alt](url)` -> wp:image, URL embedded AS-IS (the
//     caller substitutes uploaded media URLs for local paths; see
//     adapters/publish/wordpress-rest.md, Staging)
//   - blockquotes (`>` prefixed lines; blank `>` lines split paragraphs) -> wp:quote
//   - fenced code blocks (``` ... ```, language tag ignored) -> wp:code
//   - pipe tables with a header separator row -> wp:table
//
// Theme and plugin agnostic: it never hardcodes a block-library or theme
// block. Anything beyond the core set (a Table-of-Contents block matching a
// blog's existing posts) is the caller's job through --extra-blocks.
//
// CLI:
//   node md-to-gutenberg.mjs <input.md> [--extra-blocks <json-file-or-json>]
//   block markup on stdout; warnings and errors on stderr
//
// --extra-blocks takes a path to a JSON file or an inline JSON string, either
// way a list of insertions [{"position": ..., "markup": "<!-- wp:... -->"}]:
//   "top"                    before the first block
//   "after-intro"            right before the first heading (or at the end)
//   "before-heading:<text>"  before the heading whose trimmed text matches;
//                            no match is a warning, never an abort
// A path that does not exist and is not inline JSON either (the usual
// no-recorded-TOC case) is a warning and means no insertions. A file that
// exists but is not valid JSON is an error (exit 1): it is produced by the
// caller's own jq step, so broken JSON there must not be silently dropped.
//
// Frontmatter: stripping it is the caller's job, but a file that starts with
// `---` has its frontmatter stripped here too, with a warning.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const warn = (msg) => process.stderr.write(`warning: ${msg}\n`)

function escapeHtml(t, quote = false) {
  let out = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (quote) out = out.replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
  return out
}

export function stripFrontmatter(md) {
  if (md.startsWith('---')) {
    const stripped = md.replace(/^---\n[\s\S]*?\n---\n?/, '')
    if (stripped !== md) {
      warn('input markdown starts with a frontmatter block (---); stripping it here defensively, the caller is expected to have already done this (see adapters/publish/wordpress-rest.md)')
      return stripped
    }
    warn("input starts with '---' but no closing frontmatter fence found; passing through unchanged")
  }
  return md
}

export function inline(t) {
  let s = escapeHtml(t)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  return s.trim()
}

const stripPipes = (s) => s.replace(/^\|+/, '').replace(/\|+$/, '')

export function convert(md) {
  const body = stripFrontmatter(md).trim()
  const blocks = []

  const para = (t) => {
    const s = inline(t)
    if (s.trim()) blocks.push({ kind: 'paragraph', markup: `<!-- wp:paragraph -->\n<p>${s}</p>\n<!-- /wp:paragraph -->` })
  }
  const heading = (text, level) => {
    const attrs = level === 2 ? '' : ` {"level":${level}}`
    blocks.push({ kind: 'heading', headingText: text.trim(), markup: `<!-- wp:heading${attrs} -->\n<h${level} class="wp-block-heading">${inline(text)}</h${level}>\n<!-- /wp:heading -->` })
  }
  const image = (url, alt) => {
    blocks.push({ kind: 'image', markup: `<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->\n<figure class="wp-block-image size-large"><img src="${escapeHtml(url, true)}" alt="${escapeHtml(alt, true)}"/></figure>\n<!-- /wp:image -->` })
  }
  const list = (items, ordered) => {
    const attrs = ordered ? ' {"ordered":true}' : ''
    const tag = ordered ? 'ol' : 'ul'
    const lis = items.map((x) => `<!-- wp:list-item -->\n<li>${inline(x)}</li>\n<!-- /wp:list-item -->\n`).join('')
    blocks.push({ kind: 'list', markup: `<!-- wp:list${attrs} -->\n<${tag} class="wp-block-list">\n${lis}</${tag}>\n<!-- /wp:list -->` })
  }
  const quote = (quoteLines) => {
    const paras = []
    let cur = []
    for (const l of quoteLines) {
      if (l.trim() === '') {
        if (cur.length) { paras.push(cur.join(' ')); cur = [] }
      } else cur.push(l.trim())
    }
    if (cur.length) paras.push(cur.join(' '))
    const inner = paras.map((p) => `<p>${inline(p)}</p>`).join('')
    blocks.push({ kind: 'quote', markup: `<!-- wp:quote -->\n<blockquote class="wp-block-quote">${inner}</blockquote>\n<!-- /wp:quote -->` })
  }
  const code = (text) => {
    blocks.push({ kind: 'code', markup: `<!-- wp:code -->\n<pre class="wp-block-code"><code>${escapeHtml(text)}</code></pre>\n<!-- /wp:code -->` })
  }
  const table = (header, rows) => {
    const thead = '<thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead>'
    const tbody = '<tbody>' + rows.map((row) => '<tr>' + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>'
    blocks.push({ kind: 'table', markup: `<!-- wp:table -->\n<figure class="wp-block-table"><table>${thead}${tbody}</table></figure>\n<!-- /wp:table -->` })
  }

  const lines = body.split('\n')
  const n = lines.length
  let k = 0
  while (k < n) {
    const s = lines[k].trim()
    if (!s) { k++; continue }

    const mimg = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(s)
    if (mimg) { image(mimg[2], mimg[1]); k++; continue }

    const mh = /^(#{1,6})\s+(.*)$/.exec(s)
    if (mh) { heading(mh[2], mh[1].length); k++; continue }

    if (s.startsWith('```')) {
      k++
      const codeLines = []
      while (k < n && !lines[k].trim().startsWith('```')) { codeLines.push(lines[k]); k++ }
      k++ // the closing fence
      code(codeLines.join('\n'))
      continue
    }

    if (s.startsWith('>')) {
      const quoteLines = []
      while (k < n && lines[k].trim().startsWith('>')) { quoteLines.push(lines[k].replace(/^\s*>\s?/, '')); k++ }
      quote(quoteLines)
      continue
    }

    if (s.startsWith('|') && k + 1 < n && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(lines[k + 1].trim())) {
      const header = stripPipes(s).split('|').map((c) => c.trim())
      k += 2
      const rows = []
      while (k < n && lines[k].trim().startsWith('|')) { rows.push(stripPipes(lines[k].trim()).split('|').map((c) => c.trim())); k++ }
      table(header, rows)
      continue
    }

    if (/^[-*+]\s+/.test(s)) {
      const items = []
      while (k < n && /^\s*[-*+]\s+/.test(lines[k])) { items.push(lines[k].replace(/^\s*[-*+]\s+/, '')); k++ }
      list(items, false)
      continue
    }

    if (/^\d+\.\s+/.test(s)) {
      const items = []
      while (k < n && /^\s*\d+\.\s+/.test(lines[k])) { items.push(lines[k].replace(/^\s*\d+\.\s+/, '')); k++ }
      list(items, true)
      continue
    }

    const buf = [s]
    k++
    while (k < n && lines[k].trim() && !/^(#{1,6}\s|[-*+]\s|\d+\.\s|!\[|>|```|\|)/.test(lines[k].trim())) { buf.push(lines[k].trim()); k++ }
    para(buf.join(' '))
  }
  return blocks
}

export function resolvePosition(position, blocks) {
  if (position === 'top') return 0
  if (position === 'after-intro') {
    const i = blocks.findIndex((b) => b.kind === 'heading')
    return i < 0 ? blocks.length : i
  }
  if (position.startsWith('before-heading:')) {
    const target = position.slice('before-heading:'.length).trim()
    const i = blocks.findIndex((b) => b.kind === 'heading' && (b.headingText ?? '').trim() === target)
    if (i >= 0) return i
    warn(`--extra-blocks position 'before-heading:${target}' matched no heading; skipping this insertion`)
    return null
  }
  warn(`unknown --extra-blocks position '${position}'; skipping this insertion`)
  return null
}

const isFile = (p) => { try { return statSync(p).isFile() } catch { return false } }

/** Returns the insertion list, or exits 1 for a readable file that is not JSON or a JSON that is not a list. */
export function loadExtraBlocks(arg) {
  if (arg === null || arg === undefined) return []
  let data
  if (isFile(arg)) {
    try {
      data = JSON.parse(readFileSync(arg, 'utf8'))
    } catch (e) {
      process.stderr.write(`error: --extra-blocks file '${arg}' is not valid JSON: ${e.message}\n`)
      process.exit(1)
    }
  } else {
    try {
      data = JSON.parse(arg)
    } catch {
      warn(`extra-blocks source not found/parseable: ${arg}; continuing without insertions`)
      return []
    }
  }
  if (!Array.isArray(data)) {
    process.stderr.write('error: --extra-blocks JSON must be a list of {position, markup} objects\n')
    process.exit(1)
  }
  return data
}

export function applyExtraBlocks(blocks, extraBlocks) {
  const insertions = []
  for (const item of extraBlocks) {
    const position = item && typeof item === 'object' ? item.position : undefined
    const markup = item && typeof item === 'object' ? item.markup : undefined
    if (typeof position !== 'string' || typeof markup !== 'string') {
      warn(`malformed --extra-blocks item (missing or non-string 'position' or 'markup'): ${JSON.stringify(item)}; skipping`)
      continue
    }
    const idx = resolvePosition(position, blocks)
    if (idx !== null) insertions.push([idx, markup])
  }
  insertions.sort((a, b) => a[0] - b[0])
  let offset = 0
  for (const [idx, markup] of insertions) {
    blocks.splice(idx + offset, 0, { kind: 'extra', markup })
    offset++
  }
  return blocks
}

export function parseArgs(argv) {
  let input = null
  let extra = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--extra-blocks') { extra = argv[++i] ?? null; continue }
    if (a.startsWith('--extra-blocks=')) { extra = a.slice('--extra-blocks='.length); continue }
    if (a.startsWith('-')) throw new Error(`unknown option: ${a}`)
    if (input !== null) throw new Error(`unexpected argument: ${a}`)
    input = a
  }
  if (input === null || extra === undefined) throw new Error('usage: node md-to-gutenberg.mjs <input.md> [--extra-blocks <json-file-or-json>]')
  return { input, extra }
}

function main(argv) {
  let args
  try { args = parseArgs(argv) } catch (err) { process.stderr.write(`${err.message}\n`); return 2 }
  if (!existsSync(args.input)) { process.stderr.write(`error: no such file: ${args.input}\n`); return 1 }
  // Python read the file in text mode, which turns CRLF (a Windows editor) into LF.
  const md = readFileSync(args.input, 'utf8').replace(/\r\n?/g, '\n')
  const blocks = applyExtraBlocks(convert(md), loadExtraBlocks(args.extra))
  process.stdout.write(blocks.map((b) => b.markup).join('\n\n') + '\n')
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2))
}
