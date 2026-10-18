#!/usr/bin/env node
// Puts a markdown post on the clipboard as rich text (macOS, Windows, Linux), for paste platforms
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
// lines, one empty line, then the HTML (for tests). The same output is printed
// when Linux has neither wl-copy nor xclip, with a stderr line naming the
// package to install, so the post is never lost.
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

/**
 * Windows' CF_HTML clipboard format: a header whose offsets are byte
 * positions (UTF-8) into the whole text, with the fragment markers around the
 * HTML. The header is padded to fixed widths so the offsets can be computed
 * before the text is assembled.
 */
export function cfHtml(html) {
  const pad = (n) => String(n).padStart(10, '0')
  const headerFor = (a, b, c, d) => `Version:0.9\r\nStartHTML:${pad(a)}\r\nEndHTML:${pad(b)}\r\nStartFragment:${pad(c)}\r\nEndFragment:${pad(d)}\r\n`
  const open = '<html><body><!--StartFragment-->'
  const close = '<!--EndFragment--></body></html>'
  const headerLen = Buffer.byteLength(headerFor(0, 0, 0, 0))
  const startHtml = headerLen
  const startFragment = startHtml + Buffer.byteLength(open)
  const endFragment = startFragment + Buffer.byteLength(html)
  const endHtml = endFragment + Buffer.byteLength(close)
  return headerFor(startHtml, endHtml, startFragment, endFragment) + open + html + close
}

const clipboardToolMissing = (which) => Object.assign(new Error(which), { code: 'clipboard_tool_missing' })

/** The Linux clipboard tool for this session: wl-copy under Wayland, else xclip. */
export function linuxClipboardTool(env = process.env) {
  return env.WAYLAND_DISPLAY ? 'wl-copy' : 'xclip'
}

function copyDarwin(html, spawn) {
  const dir = mkdtempSync(join(tmpdir(), 'pilcrino-clip-'))
  try {
    const file = join(dir, 'post.html')
    // The charset tag keeps non-ASCII text intact in the pasting app.
    writeFileSync(file, `<meta charset="utf-8">${html}`)
    const set = spawn('osascript', ['-e', `set the clipboard to (read (POSIX file "${file}") as «class HTML»)`], { encoding: 'utf8' })
    if (set.error || set.status !== 0) throw new Error(`osascript could not set the clipboard: ${(set.error?.message ?? set.stderr ?? '').trim()}`)
    const info = spawn('osascript', ['-e', 'clipboard info'], { encoding: 'utf8' })
    if (info.status !== 0 || !/«class HTML»|class HTML/.test(info.stdout ?? '')) throw new Error('the clipboard holds no HTML after copying')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function copyWin32(html, spawn) {
  const dir = mkdtempSync(join(tmpdir(), 'pilcrino-clip-'))
  try {
    const file = join(dir, 'post.cfhtml')
    writeFileSync(file, cfHtml(`<meta charset="utf-8">${html}`))
    // Windows PowerShell (.NET Framework) in STA mode: Clipboard.SetText with
    // the Html format stores the text as given, so the CF_HTML header above
    // is the one Windows sees. The file is read as UTF-8 explicitly.
    const script = `Add-Type -AssemblyName System.Windows.Forms; $t = [IO.File]::ReadAllText('${file.replace(/'/g, "''")}', [Text.Encoding]::UTF8); [Windows.Forms.Clipboard]::SetText($t, [Windows.Forms.TextDataFormat]::Html); if (-not [Windows.Forms.Clipboard]::ContainsText([Windows.Forms.TextDataFormat]::Html)) { exit 3 }`
    const set = spawn('powershell', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 20000 })
    if (set.error?.code === 'ENOENT') throw clipboardToolMissing('powershell was not found on PATH')
    if (set.error || set.status !== 0) throw new Error(`powershell could not set the clipboard: ${(set.error?.message ?? set.stderr ?? `exit ${set.status}`).trim()}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function copyLinux(html, spawn, env) {
  const tool = linuxClipboardTool(env)
  const args = tool === 'wl-copy' ? ['--type', 'text/html'] : ['-selection', 'clipboard', '-t', 'text/html']
  // Both tools fork a process that keeps serving the selection and holds its
  // output descriptors open, so stdout and stderr are ignored, or this call
  // would wait on them long after the copy succeeded.
  const set = spawn(tool, args, { input: `<meta charset="utf-8">${html}`, stdio: ['pipe', 'ignore', 'ignore'], timeout: 10000 })
  if (set.error?.code === 'ENOENT') {
    throw clipboardToolMissing(tool === 'wl-copy'
      ? 'wl-copy is not installed; install the wl-clipboard package (on Debian and Ubuntu: sudo apt-get install -y wl-clipboard)'
      : 'xclip is not installed; install it (on Debian and Ubuntu: sudo apt-get install -y xclip)')
  }
  if (set.error || set.status !== 0) throw new Error(`${tool} could not set the clipboard: ${set.error?.message ?? `exit ${set.status ?? set.signal}`}`)
}

/** Puts the HTML on the clipboard as rich text, the way this platform does it. */
export function copyHtml(html, { platform = process.platform, spawn = spawnSync, env = process.env } = {}) {
  if (platform === 'darwin') return copyDarwin(html, spawn)
  if (platform === 'win32') return copyWin32(html, spawn)
  return copyLinux(html, spawn, env)
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
      try {
        copyHtml(html)
      } catch (err) {
        if (err.code !== 'clipboard_tool_missing') throw err
        // No clipboard tool: the HTML goes to stdout instead, so nothing is lost.
        process.stderr.write(`post-to-clipboard: ${err.message}; the HTML follows the fields on stdout instead\n`)
        process.stdout.write(`${lines ? `${lines}\n` : ''}\n${html}`)
        return 0
      }
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
