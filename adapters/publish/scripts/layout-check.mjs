#!/usr/bin/env node
// Layout check: does the rendered post fit its column?
//
//   node layout-check.mjs --url <page> [--widths 1440,390] [--article <css selector>] [--timeout 30000]
//
// Opens the page in a throwaway headless Chrome (the same executable the
// Pilcrino browser uses: PILCRINO_CHROME, else the platform default), once per
// width, finds the article and reports every element inside it that extends
// past the article's right edge, plus a page that scrolls sideways. Prints one
// JSON object to stdout:
//
//   { "ok": true|false, "url", "finalUrl", "title", "widths": [..],
//     "article": "<how it was found>", "findings": [ { "width", "element", "text", "overflow" } ] }
//
// `finalUrl` and `title` let the caller see what was actually measured: a
// login or error page is a clean page too, and a redirect to one must not
// read as "the post fits". An HTTP status of 400 or more is exit 2.
//
// Exit 0: no findings. Exit 1: findings. Exit 2: the check could not run (no
// Chrome, no puppeteer-core, page did not load); the reason is in `error`.
//
// Deterministic by design: no model looks at anything. It catches the class of
// fault a stylesheet or a wide table introduces (a table under the sidebar, an
// image or code block wider than the column, a long URL that will not break),
// which a build passes and a screenshot reviewer may or may not mention.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const BROWSER_ROOT = join(here, '..', '..', '..', 'browser')
const INSTALL_HINT = `run: node ${join(BROWSER_ROOT, 'bin.mjs')} install`

// The browser helper's modules pull in its packages (yaml, puppeteer-core),
// which exist only after `bin.mjs install`; loading them lazily keeps this
// script importable, and its argument parsing testable, without them.
async function loadChromeFinder() {
  try {
    return (await import('../../../browser/src/chrome.mjs')).findChrome
  } catch (err) {
    throw new Error(`the Pilcrino browser's packages are not installed (${err.message}); ${INSTALL_HINT}`)
  }
}

export const DEFAULT_WIDTHS = [1440, 390]
/** Sub-pixel rounding and a 1px border are not overflow. */
export const TOLERANCE_PX = 2

export function parseArgs(argv) {
  const out = { url: '', widths: DEFAULT_WIDTHS, article: '', timeout: 30000 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`); return v }
    if (a === '--url') out.url = next()
    else if (a === '--widths') {
      out.widths = next().split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
      if (out.widths.length === 0) throw new Error('--widths needs comma-separated positive integers')
    } else if (a === '--article') out.article = next()
    else if (a === '--timeout') out.timeout = Number(next())
    else throw new Error(`unknown argument ${a}`)
  }
  if (!out.url) throw new Error('--url is required')
  return out
}

/**
 * Runs inside the page. Scopes the search to the post (`--article`, else
 * `<article>`, else `<main>`, else the whole body) and reports, for the scope
 * and every element in it:
 *
 * - a box that ends past its container's padding box on the right (the
 *   container is the nearest ancestor that has a layout box; `display:
 *   contents` parents have none; absolutely positioned elements answer to
 *   their offsetParent; fixed ones answer to the viewport and are left alone).
 *   The left edge is not checked: a few pixels of hanging indent on a list
 *   or a link is a design choice, and nothing on the left can be clipped by
 *   the column the way a table under a sidebar is;
 * - content that paints past the element's own box (`scrollWidth` wider than
 *   `clientWidth` with `overflow-x: visible`): the long URL that will not
 *   break, whose paragraph's box still fits.
 *
 * Measuring against the container, not the scope, is the point: a site's
 * `<article>` often spans the text column AND a sidebar, so a table that
 * bursts out of the 720px text column is still "inside" the article. It is
 * never inside its container. Containers that scroll or clip their content
 * (`overflow-x: auto|scroll|hidden|clip`) are allowed to hold wider children:
 * that is the intended way to show a wide code block. Returns plain data only.
 */
export function pageProbe(selector, tolerance) {
  const scope = (selector && document.querySelector(selector)) || document.querySelector('article') || document.querySelector('main') || document.body
  const how = selector && scope !== document.body && scope.matches(selector) ? `selector ${selector}` : scope.tagName.toLowerCase()
  const clips = (el) => /^(auto|scroll|hidden|clip)$/.test(getComputedStyle(el).overflowX)
  const hasBox = (el) => el && getComputedStyle(el).display !== 'contents' && el.getBoundingClientRect().width > 0
  const container = (el, style) => {
    if (style.position === 'absolute') { let c = el.offsetParent; return hasBox(c) ? c : document.documentElement }
    let c = el.parentElement
    while (c && c !== document.documentElement && !hasBox(c)) c = c.parentElement
    return c
  }
  const findings = []
  const add = (el, text, overflow) => {
    // One finding per fault: a wide table is one finding, not one per cell.
    // The innermost element that overflows by at least as much is the cause
    // and gets the finding (the article "overflows" by 10px and its text
    // column by 682px because the table in them is 682px too wide), while an
    // inner element that overflows by less is a symptom and is swallowed.
    const outer = findings.findIndex((f) => f.node !== el && f.node.contains(el))
    const entry = { node: el, element: el.tagName.toLowerCase(), text, overflow: Math.round(overflow) }
    if (outer === -1) findings.push(entry)
    else if (entry.overflow >= findings[outer].overflow - tolerance) findings[outer] = entry
  }
  const snippet = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  for (const el of [scope, ...scope.querySelectorAll('*')]) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.display === 'contents' || style.position === 'fixed') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const c = container(el, style)
    if (c && !clips(c)) {
      const cr = c.getBoundingClientRect()
      const cs = getComputedStyle(c)
      const over = r.right - (cr.right - parseFloat(cs.borderRightWidth))
      if (over > tolerance) add(el, snippet(el), over)
    }
    // Content wider than the box it is in, and nothing clipping it.
    if (!clips(el) && el.scrollWidth - el.clientWidth > tolerance && el.clientWidth > 0) add(el, snippet(el), el.scrollWidth - el.clientWidth)
  }
  const scroll = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  return { article: how, findings: findings.map(({ node, ...f }) => f), scroll, title: document.title }
}

async function loadPuppeteer() {
  const require = createRequire(join(BROWSER_ROOT, 'package.json'))
  try {
    return (await import(require.resolve('puppeteer-core'))).default
  } catch {
    throw new Error(`puppeteer-core is not installed under ${BROWSER_ROOT}; ${INSTALL_HINT}`)
  }
}

/** The whole settling phase (scroll, image loads, decodes) must finish in this long, or the check is "could not run". */
export const SETTLE_DEADLINE_MS = 15000

/**
 * Lazy images (`loading="lazy"`) below the fold have no size until the reader
 * scrolls to them, and an unsized one that turns out wider than the column is
 * exactly the fault to catch. Walk the page once so they load, wait for every
 * image that is rendered at this width to load and decode (an image hidden by
 * a media query never loads and is not waited for), and go back to the top
 * before measuring. The deadline bounds everything: a page that never
 * settles is reported, not waited on forever.
 */
export async function settleLazyContent(page, deadlineMs = SETTLE_DEADLINE_MS) {
  const settled = await page.evaluate(async (deadline) => {
    const until = Date.now() + deadline
    const step = window.innerHeight
    for (let y = 0; y <= document.documentElement.scrollHeight && Date.now() < until; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
    const shown = [...document.images].filter((img) => img.getClientRects().length > 0)
    const loaded = Promise.all(shown.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }) }))))
      .then(() => Promise.all(shown.map((img) => img.decode().catch(() => {}))))
      .then(() => true)
    const expired = new Promise((r) => setTimeout(() => r(false), Math.max(0, until - Date.now())))
    return Promise.race([loaded, expired])
  }, deadlineMs)
  if (!settled) throw new Error(`the page did not finish loading its images within ${deadlineMs / 1000}s`)
}

export async function checkLayout({ url, widths = DEFAULT_WIDTHS, article = '', timeout = 30000, settleMs = SETTLE_DEADLINE_MS, chrome, puppeteer }) {
  const exe = chrome ?? (await loadChromeFinder())()
  const pp = puppeteer ?? (await loadPuppeteer())
  const profile = mkdtempSync(join(tmpdir(), 'pilcrino-layout-'))
  const findings = []
  let how = null
  let title = ''
  let finalUrl = url
  let browser = null
  // `pipe: true`: Chrome talks over a pipe instead of a port and exits by
  // itself when the pipe closes, so a SIGKILL on this process (the app's
  // abort path) cannot leave a headless Chrome behind.
  const stop = () => { browser?.close().catch(() => {}); rmSync(profile, { recursive: true, force: true }); process.exit(2) }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  try {
    browser = await pp.launch({ executablePath: exe, headless: true, pipe: true, userDataDir: profile, args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'] })
    const page = await browser.newPage()
    for (const width of widths) {
      await page.setViewport({ width, height: 900 })
      const response = await page.goto(url, { waitUntil: 'networkidle0', timeout })
      const status = response?.status() ?? 0
      if (status >= 400) throw new Error(`the page answered HTTP ${status}`)
      finalUrl = page.url()
      await settleLazyContent(page, settleMs)
      const r = await page.evaluate(pageProbe, article, TOLERANCE_PX)
      how = r.article
      title = r.title
      for (const f of r.findings) findings.push({ width, ...f })
      if (r.scroll > TOLERANCE_PX) findings.push({ width, element: 'page', text: 'the page scrolls sideways', overflow: Math.round(r.scroll) })
    }
  } finally {
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
    if (browser) await browser.close().catch(() => {})
    rmSync(profile, { recursive: true, force: true })
  }
  return { ok: findings.length === 0, url, finalUrl, title, widths, article: how, findings }
}

/** One line per finding, for banners and logs. */
export function describeFindings(result) {
  return result.findings.map((f) => f.element === 'page'
    ? `at ${f.width}px the page scrolls sideways by ${f.overflow}px`
    : `at ${f.width}px <${f.element}> "${f.text}" extends ${f.overflow}px past the article`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let args
  try { args = parseArgs(process.argv.slice(2)) } catch (err) { console.error(err.message); process.exit(2) }
  checkLayout(args).then((result) => {
    console.log(JSON.stringify(result))
    process.exit(result.ok ? 0 : 1)
  }).catch((err) => {
    console.log(JSON.stringify({ ok: false, url: args.url, error: err.message }))
    process.exit(2)
  })
}
