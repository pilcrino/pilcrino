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
//   { "ok": true|false, "url", "widths": [..], "article": "<how it was found>",
//     "findings": [ { "width", "element", "text", "overflow" } ] }
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
 * `<article>`, else `<main>`, else the whole body) and reports every element
 * in it whose box ends to the right of its own parent's padding box by more
 * than `tolerance`, plus the page's sideways scroll. Measuring against the
 * parent, not the scope, is the point: a site's `<article>` often spans the
 * text column AND a sidebar, so a table that bursts out of the 720px text
 * column is still "inside" the article. It is never inside its parent.
 *
 * Containers that scroll or clip their content (`overflow-x: auto|scroll|
 * hidden`) are allowed to hold wider children: that is the intended way to
 * show a wide code block. Returns plain data only.
 */
export function pageProbe(selector, tolerance) {
  const scope = (selector && document.querySelector(selector)) || document.querySelector('article') || document.querySelector('main') || document.body
  const how = selector && scope !== document.body && scope.matches(selector) ? `selector ${selector}` : scope.tagName.toLowerCase()
  const clips = (el) => /^(auto|scroll|hidden|clip)$/.test(getComputedStyle(el).overflowX)
  const findings = []
  for (const el of scope.querySelectorAll('*')) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.display === 'contents' || style.position === 'fixed' || style.position === 'absolute') continue
    const parent = el.parentElement
    if (!parent || clips(parent)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const ps = getComputedStyle(parent)
    const limit = parent.getBoundingClientRect().right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth)
    const overflow = r.right - limit
    if (overflow <= tolerance) continue
    // Report the outermost offender only: a wide table is one finding, not one per cell.
    if (findings.some((f) => f.node.contains(el))) continue
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    findings.push({ node: el, element: el.tagName.toLowerCase(), text, overflow: Math.round(overflow) })
  }
  const scroll = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  return { article: how, findings: findings.map(({ node, ...f }) => f), scroll }
}

async function loadPuppeteer() {
  const require = createRequire(join(BROWSER_ROOT, 'package.json'))
  try {
    return (await import(require.resolve('puppeteer-core'))).default
  } catch {
    throw new Error(`puppeteer-core is not installed under ${BROWSER_ROOT}; ${INSTALL_HINT}`)
  }
}

export async function checkLayout({ url, widths = DEFAULT_WIDTHS, article = '', timeout = 30000, chrome, puppeteer }) {
  const exe = chrome ?? (await loadChromeFinder())()
  const pp = puppeteer ?? (await loadPuppeteer())
  const profile = mkdtempSync(join(tmpdir(), 'pilcrino-layout-'))
  const browser = await pp.launch({ executablePath: exe, headless: true, userDataDir: profile, args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'] })
  const findings = []
  let how = null
  try {
    const page = await browser.newPage()
    for (const width of widths) {
      await page.setViewport({ width, height: 900 })
      await page.goto(url, { waitUntil: 'networkidle0', timeout })
      const r = await page.evaluate(pageProbe, article, TOLERANCE_PX)
      how = r.article
      for (const f of r.findings) findings.push({ width, ...f })
      if (r.scroll > TOLERANCE_PX) findings.push({ width, element: 'page', text: 'the page scrolls sideways', overflow: Math.round(r.scroll) })
    }
  } finally {
    await browser.close().catch(() => {})
    rmSync(profile, { recursive: true, force: true })
  }
  return { ok: findings.length === 0, url, widths, article: how, findings }
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
