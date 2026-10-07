import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { parseArgs, describeFindings, checkLayout, settleLazyContent, DEFAULT_WIDTHS } from './layout-check.mjs'

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
async function browserReady() {
  let findChrome
  try { ({ findChrome } = await import('../../../browser/src/chrome.mjs')) } catch { return 'browser packages not installed (node browser/bin.mjs install)' }
  try { findChrome() } catch { return 'Chrome not found' }
  try { createRequire(join(import.meta.dirname, '..', '..', '..', 'browser', 'package.json')).resolve('puppeteer-core') } catch { return 'puppeteer-core not installed under browser/' }
  return ''
}
const reason = await browserReady()
// node:test skips whenever the option is present, so only pass it when there is a reason.
const needsBrowser = reason ? { skip: reason } : {}

// A site like Pilcrino's: <article> spans the text column and a sidebar, the
// text column is capped at 720px, and the first table column does not wrap.
const page = (extraCss, body = '') => `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Fixture post</title><style>
body{margin:0;padding:24px;font-family:sans-serif;font-size:18px}
article{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:40px} .post-main{max-width:720px}
table{width:100%;border-collapse:collapse} pre{overflow-x:auto}
@media (max-width:640px){article{display:block} table{display:block;overflow-x:auto}} ${extraCss}
</style></head><body><article><div class="post-main"><h1>Post</h1><p>Intro.</p>
<table><tr><th>Claim as found</th><th>What the source said</th><th>Outcome</th></tr>
<tr><td>"67% of ChatGPT's top 1,000 cited pages come from original research", credited to Ahrefs, repeated on three vendor pages and one newsletter without a link</td><td>The Ahrefs study reports no such category</td><td>Rejected on 2026-09-23</td></tr></table>
<pre><code>a very long code line that is allowed to scroll inside its own box because pre has overflow-x auto so it is never a finding</code></pre>
<p>Outro.</p>${body}</div><aside>Contents</aside></article></body></html>`

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
    assert.equal(bad.title, 'Fixture post')
    assert.equal(bad.finalUrl, bad.url)
    const good = await checkLayout({ url: fixture(dir, 'good.html', page('')) })
    assert.deepEqual(good, { ok: true, url: good.url, finalUrl: good.url, title: 'Fixture post', widths: DEFAULT_WIDTHS, article: 'article', findings: [] })
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

test('content inside the padding, a display:contents parent and a scrolling box are not findings', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    const r = await checkLayout({ url: fixture(dir, 'fine.html', page(
      '.pad{width:300px;padding-right:20px} .pad>div{width:318px} .ghost{display:contents}',
      '<div class="pad"><div>fits inside the padding box</div></div><div class="ghost"><p>a paragraph whose parent has no box</p></div>',
    )), widths: [1440] })
    assert.deepEqual(r.findings, [], JSON.stringify(r.findings))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a long URL that will not break is a finding even though its paragraph fits', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    // Long enough to burst the 720px column, short enough to stay inside the viewport: the paragraph is the only finding.
    const r = await checkLayout({ url: fixture(dir, 'url.html', page('', `<p class="u">See https://example.com/${'a'.repeat(90)}</p>`)), widths: [1440] })
    assert.deepEqual(r.findings.map((f) => [f.width, f.element]), [[1440, 'p']], JSON.stringify(r.findings))
    assert.ok(r.findings[0].overflow > 100)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('the scope itself and an absolutely positioned image are measured too', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    const wide = await checkLayout({ url: fixture(dir, 'scope.html', page('article{width:1600px}')), widths: [1440] })
    assert.ok(wide.findings.some((f) => f.element === 'article'), JSON.stringify(wide.findings))
    const abs = await checkLayout({ url: fixture(dir, 'abs.html', page('.rel{position:relative;width:300px;height:100px} .rel img{position:absolute;left:0;top:0;width:400px;height:50px}', '<div class="rel"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>')), widths: [1440] })
    assert.deepEqual(abs.findings.map((f) => f.element), ['img'], JSON.stringify(abs.findings))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a clean page served with HTTP 404 is "could not run", never a fit', needsBrowser, async () => {
  const server = createServer((_req, res) => { res.writeHead(404, { 'content-type': 'text/html' }); res.end(page('')) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try {
    const url = `http://127.0.0.1:${server.address().port}/blog/missing/`
    await assert.rejects(checkLayout({ url, widths: [1440] }), /the page answered HTTP 404/)
  } finally { server.close() }
})

test('a lazy image below the fold that turns out wider than the column is a finding', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="40"><rect width="1000" height="40"/></svg>')}`
    const html = page('.tall{height:3000px}', `<p class="tall">Long post.</p><img loading="lazy" alt="" src="${svg}">`)
    const r = await checkLayout({ url: fixture(dir, 'lazy.html', html), widths: [1440] })
    assert.deepEqual(r.findings.map((f) => [f.width, f.element]), [[1440, 'img']], JSON.stringify(r.findings))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a lazy image hidden at this width is not waited for', needsBrowser, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'layout-check-'))
  try {
    const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="40"><rect width="1000" height="40"/></svg>')}`
    const html = page('.tall{height:3000px} .phone{display:none} @media (max-width:640px){.phone{display:block}}', `<p class="tall">Long post.</p><img class="phone" loading="lazy" alt="" src="${svg}">`)
    const started = Date.now()
    const r = await checkLayout({ url: fixture(dir, 'hidden.html', html), widths: [1440] })
    assert.equal(r.ok, true, JSON.stringify(r.findings))
    assert.ok(Date.now() - started < 10000, 'did not wait for the hidden image')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a lazy image whose request never finishes trips the settle deadline instead of hanging', needsBrowser, async () => {
  // The page itself loads (a lazy image is not requested until scrolled to); the settle phase then waits on it.
  const server = createServer((req, res) => {
    if (req.url.endsWith('.png')) return // never answered
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page('.tall{height:3000px}', '<p class="tall">Long post.</p><img loading="lazy" alt="" src="/never.png">'))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try {
    const url = `http://127.0.0.1:${server.address().port}/blog/p/`
    await assert.rejects(checkLayout({ url, widths: [1440], settleMs: 1500 }), /did not finish loading its images within 1.5s/)
  } finally { server.closeAllConnections?.(); server.close() }
})
