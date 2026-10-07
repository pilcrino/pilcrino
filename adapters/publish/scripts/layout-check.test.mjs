import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { parseArgs, describeFindings, checkLayout, DEFAULT_WIDTHS } from './layout-check.mjs'
import { findChrome } from '../../../browser/src/chrome.mjs'

test('parseArgs: url required, widths parsed, unknown flag refused', () => {
  assert.throws(() => parseArgs([]), /--url is required/)
  assert.deepEqual(parseArgs(['--url', 'http://x']).widths, DEFAULT_WIDTHS)
  assert.deepEqual(parseArgs(['--url', 'http://x', '--widths', '1200, 375']).widths, [1200, 375])
  assert.throws(() => parseArgs(['--url', 'http://x', '--widths', 'wide']), /positive integers/)
  assert.throws(() => parseArgs(['--url', 'http://x', '--bogus']), /unknown argument/)
  assert.equal(parseArgs(['--url', 'http://x', '--article', '.post-main']).article, '.post-main')
})

test('describeFindings: one plain line per finding', () => {
  const lines = describeFindings({ findings: [
    { width: 1440, element: 'table', text: 'Claim as found', overflow: 147 },
    { width: 390, element: 'page', text: 'the page scrolls sideways', overflow: 40 },
  ] })
  assert.deepEqual(lines, [
    'at 1440px <table> "Claim as found" extends 147px past the article',
    'at 390px the page scrolls sideways by 40px',
  ])
})

// The browser-backed cases need Chrome and puppeteer-core (browser/node_modules,
// `node browser/bin.mjs install`). Without them they are skipped, loudly.
function browserReady() {
  try { findChrome() } catch { return 'Chrome not found' }
  try { createRequire(join(import.meta.dirname, '..', '..', '..', 'browser', 'package.json')).resolve('puppeteer-core') } catch { return 'puppeteer-core not installed under browser/' }
  return ''
}
const reason = browserReady()
// node:test skips whenever the option is present, so only pass it when there is a reason.
const needsBrowser = reason ? { skip: reason } : {}

// A site like Pilcrino's: <article> spans the text column and a sidebar, the
// text column is capped at 720px, and the first table column does not wrap.
const page = (extraCss) => `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
body{margin:0;padding:24px;font-family:sans-serif;font-size:18px}
article{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:40px} .post-main{max-width:720px}
table{width:100%;border-collapse:collapse} pre{overflow-x:auto}
@media (max-width:640px){article{display:block} table{display:block;overflow-x:auto}} ${extraCss}
</style></head><body><article><div class="post-main"><h1>Post</h1><p>Intro.</p>
<table><tr><th>Claim as found</th><th>What the source said</th><th>Outcome</th></tr>
<tr><td>"67% of ChatGPT's top 1,000 cited pages come from original research", credited to Ahrefs, repeated on three vendor pages and one newsletter without a link</td><td>The Ahrefs study reports no such category</td><td>Rejected on 2026-09-23</td></tr></table>
<pre><code>a very long code line that is allowed to scroll inside its own box because pre has overflow-x auto so it is never a finding</code></pre>
<p>Outro.</p></div><aside>Contents</aside></article></body></html>`

function fixture(dir, name, html) {
  const p = join(dir, name)
  writeFileSync(p, html)
  return pathToFileURL(p).href
}

test('a no-wrap first column bursts the text column at desktop width; the fixed page passes', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    const bad = await checkLayout({ url: fixture(dir, 'bad.html', page('td:first-child{white-space:nowrap}')) })
    assert.equal(bad.ok, false)
    assert.equal(bad.article, 'article')
    assert.deepEqual(bad.findings.map((f) => [f.width, f.element]), [[1440, 'table']])
    assert.ok(bad.findings[0].overflow > 100, `overflow ${bad.findings[0].overflow}`)
    assert.match(bad.findings[0].text, /^Claim as found/)
    const good = await checkLayout({ url: fixture(dir, 'good.html', page('')) })
    assert.deepEqual(good, { ok: true, url: good.url, widths: DEFAULT_WIDTHS, article: 'article', findings: [] })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a page that is not responsive scrolls sideways at phone width, reported once', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    const r = await checkLayout({ url: fixture(dir, 'fixed.html', page('@media (max-width:640px){article{display:grid}} .post-main{min-width:720px}')), widths: [390] })
    assert.equal(r.ok, false)
    assert.ok(r.findings.some((f) => f.element === 'page' && f.width === 390), JSON.stringify(r.findings))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('--article scopes the search to one block', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    const r = await checkLayout({ url: fixture(dir, 'scoped.html', page('td:first-child{white-space:nowrap}')), article: 'aside', widths: [1440] })
    assert.equal(r.article, 'selector aside')
    assert.equal(r.ok, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
