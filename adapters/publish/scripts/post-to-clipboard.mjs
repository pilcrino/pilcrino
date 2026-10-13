#!/usr/bin/env node
// Puts a markdown post on the macOS clipboard as rich text, for paste platforms
// (Webflow, a page builder, any CMS with a rich-text editor), and prints the
// frontmatter fields the owner types into the CMS by hand.
//
//   node post-to-clipboard.mjs <post.md> [--cover-key <key>] [--no-clipboard]
//
// stdout: one line per field present, in this order:
//   title: ..., description: ..., date: ..., tags: a, b, author: ..., cover: <filename>
// then, only when the body has any, one `contains:` line naming the blocks a
// rich-text editor may drop or flatten on paste (`contains: 1 table, 2 code blocks`).
// The `contains:` line is a warning for the banner, not a CMS field.
// With --no-clipboard the clipboard is left alone and stdout carries the field
// lines, one empty line, then the HTML (for tests and non-macOS machines).
// Diagnostics go to stderr. Exit 1 on any failure, 2 on a usage error.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const BROWSER_ROOT = join(PLUGIN_ROOT, 'browser')

/** Cover keys the markdown-* frontmatter docs use, in the order they are tried. */
export const COVER_KEYS = ['heroImage', 'cover', 'image', 'feature_image', 'featured_image']

export function parseArgs(argv) {
  const out = { file: null, coverKey: null, clipboard: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--no-clipboard') out.clipboard = false
    else if (a === '--cover-key') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error('--cover-key needs a key name')
      out.coverKey = v
    } else if (a.startsWith('--')) throw new Error(`unknown argument: ${a}`)
    else if (out.file === null) out.file = a
    else throw new Error(`unexpected argument: ${a}`)
  }
  if (out.file === null) throw new Error('usage: post-to-clipboard.mjs <post.md> [--cover-key <key>] [--no-clipboard]')
  return out
}

function unquote(v) {
  v = v.trim()
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    const inner = v.slice(1, -1)
    return v[0] === "'" ? inner.replace(/''/g, "'") : inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  // An unquoted scalar may carry a trailing comment.
  return v.replace(/\s+#.*$/, '')
}

function inlineList(v) {
  return v.trim().slice(1, -1).split(',').map(unquote).filter(Boolean)
}

/**
 * Splits a post into its leading frontmatter (top-level keys only: scalars,
 * inline lists and block lists) and the body. A file without a closed `---`
 * block at the very top has no frontmatter.
 */
export function splitFrontmatter(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const m = /^---[ \t]*\n([\s\S]*?\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(text)
  if (!m) return { data: {}, body: text }
  const data = {}
  let listKey = null
  for (const line of (m[1] ?? '').split('\n')) {
    if (/^\s*(#.*)?$/.test(line)) continue
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item && listKey) { data[listKey].push(unquote(item[1])); continue }
    const kv = /^([A-Za-z_][\w-]*)\s*:(.*)$/.exec(line)
    if (!kv) { listKey = null; continue } // nested or unsupported: skipped
    const [, key, raw] = kv
    listKey = null
    if (raw.trim() === '') { data[key] = []; listKey = key; continue }
    data[key] = /^\s*\[.*\]\s*$/.test(raw) ? inlineList(raw) : unquote(raw)
  }
  // A key with an empty value and no list items under it (or a nested map) is absent.
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v) && v.length === 0) delete data[k]
  return { data, body: text.slice(m[0].length) }
}

/** The bare filename of a local path: query and fragment dropped, percent-escapes decoded. */
export function bareFilename(p) {
  const clean = String(p).split(/[?#]/)[0]
  let name = posix.basename(clean)
  try { name = decodeURIComponent(name) } catch { /* keep it as written */ }
  return name
}

/** True for a path the owner uploads themselves (relative or root-relative), false for a URL. */
export function isLocalPath(href) {
  return !!href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('//')
}

function first(data, keys) {
  for (const k of keys) {
    const v = data[k]
    if (v === undefined || v === '') continue
    return v
  }
  return undefined
}

/** The banner fields, in print order; absent ones are left out. */
export function bannerFields(data, coverKey = null) {
  const asText = (v) => (Array.isArray(v) ? v.join(', ') : v)
  const fields = []
  const add = (name, v) => { if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) fields.push([name, asText(v)]) }
  add('title', first(data, ['title']))
  add('description', first(data, ['description', 'excerpt']))
  add('date', first(data, ['date', 'pubDate', 'published_at']))
  const tags = first(data, ['tags'])
  add('tags', typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : tags)
  add('author', first(data, ['author', 'authors']))
  const cover = first(data, coverKey ? [coverKey, ...COVER_KEYS] : COVER_KEYS)
  if (typeof cover === 'string') add('cover', isLocalPath(cover) ? bareFilename(cover) : cover)
  return fields
}

export function fieldLines(fields) {
  return fields.map(([k, v]) => `${k}: ${v}`).join('\n')
}

/** GitHub-flavoured markdown to HTML; local image paths become bare filenames. */
export function renderBody(marked, body) {
  const md = new marked.Marked({ gfm: true })
  md.use({
    walkTokens(token) {
      if (token.type === 'image' && isLocalPath(token.href)) token.href = bareFilename(token.href)
    },
  })
  return md.parse(body)
}

/**
 * Counts the blocks a rich-text editor may drop or flatten when the post is
 * pasted: tables and code blocks (fenced or indented), wherever they sit,
 * including inside lists and quotes.
 */
export function countBlocks(marked, body) {
  const md = new marked.Marked({ gfm: true })
  const counts = { tables: 0, codeBlocks: 0 }
  md.walkTokens(md.lexer(body), (token) => {
    if (token.type === 'table') counts.tables++
    else if (token.type === 'code') counts.codeBlocks++
  })
  return counts
}

/** The `contains:` line, or '' when the body has neither tables nor code blocks. */
export function containsLine({ tables, codeBlocks }) {
  const parts = []
  if (tables > 0) parts.push(`${tables} ${tables === 1 ? 'table' : 'tables'}`)
  if (codeBlocks > 0) parts.push(`${codeBlocks} ${codeBlocks === 1 ? 'code block' : 'code blocks'}`)
  return parts.length ? `contains: ${parts.join(', ')}` : ''
}

function ensureBrowserPackages() {
  const r = spawnSync(process.execPath, [join(BROWSER_ROOT, 'bin.mjs'), 'install'], { stdio: ['ignore', 2, 2] })
  if (r.status !== 0) throw new Error(`could not install the browser packages (node ${join(BROWSER_ROOT, 'bin.mjs')} install exited ${r.status ?? r.signal})`)
}

async function loadMarked() {
  const entry = join(BROWSER_ROOT, 'node_modules', 'marked', 'lib', 'marked.esm.js')
  if (!existsSync(entry)) throw new Error(`marked is missing from ${join(BROWSER_ROOT, 'node_modules')}; run: node ${join(BROWSER_ROOT, 'bin.mjs')} install`)
  return import(pathToFileURL(entry).href)
}

function copyHtml(html) {
  const dir = mkdtempSync(join(tmpdir(), 'pilcrino-clip-'))
  try {
    const file = join(dir, 'post.html')
    // The charset tag keeps non-ASCII text intact in the pasting app.
    writeFileSync(file, `<meta charset="utf-8">${html}`)
    const set = spawnSync('osascript', ['-e', `set the clipboard to (read (POSIX file "${file}") as «class HTML»)`], { encoding: 'utf8' })
    if (set.error || set.status !== 0) throw new Error(`osascript could not set the clipboard: ${(set.error?.message ?? set.stderr ?? '').trim()}`)
    const info = spawnSync('osascript', ['-e', 'clipboard info'], { encoding: 'utf8' })
    if (info.status !== 0 || !/«class HTML»|class HTML/.test(info.stdout ?? '')) throw new Error('the clipboard holds no HTML after copying')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main(argv) {
  let args
  try { args = parseArgs(argv) } catch (err) { process.stderr.write(`${err.message}\n`); return 2 }
  try {
    if (!existsSync(args.file)) throw new Error(`no such file: ${args.file}`)
    const { data, body } = splitFrontmatter(readFileSync(args.file, 'utf8'))
    ensureBrowserPackages()
    const marked = await loadMarked()
    const html = renderBody(marked, body)
    const lines = [fieldLines(bannerFields(data, args.coverKey)), containsLine(countBlocks(marked, body))].filter(Boolean).join('\n')
    if (args.clipboard) {
      if (process.platform !== 'darwin') throw new Error('the clipboard copy needs macOS; rerun with --no-clipboard to print the HTML')
      copyHtml(html)
      if (lines) process.stdout.write(`${lines}\n`)
    } else {
      process.stdout.write(`${lines ? `${lines}\n` : ''}\n${html}`)
    }
    return 0
  } catch (err) {
    process.stderr.write(`post-to-clipboard: ${err.message}\n`)
    return 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2))
}
