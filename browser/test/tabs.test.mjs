import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { TabRegistry, checkKind as checkKindFn, isBingUrl, navigateTool, waitTool } from '../src/tabs.mjs'

function fakeBrowser() {
  const pages = []
  const mk = () => {
    const p = { _url: 'about:blank', closed: false, url: () => p._url, title: async () => 'T', goto: async (u) => { p._url = u; return { status: () => 200 } }, close: async () => { p.closed = true } }
    pages.push(p); return p
  }
  const calls = []
  return { newPage: async (o) => { calls.push(o); return mk() }, pages, calls }
}

test('ids stay unique across registries in one process', async () => {
  const a = await new TabRegistry(fakeBrowser()).open('https://a')
  const b = await new TabRegistry(fakeBrowser()).open('https://b')
  assert.notEqual(a.tabId, b.tabId)
})

test('open records ownership; list shows only owned; foreign ids are refused', async () => {
  const b = fakeBrowser()
  const reg = new TabRegistry(b)
  const t = await reg.open('https://example.com')
  assert.match(t.tabId, /^t\d+$/)
  assert.equal(reg.list().length, 1)
  const u = await reg.open('https://x.com', { owned: false })
  assert.equal(reg.list().length, 1)
  assert.throws(() => reg.page(u.tabId), (e) => e.code === 'not_owned')
  assert.throws(() => reg.page('t999'), (e) => e.code === 'not_owned')
  await reg.close(t.tabId)
  assert.equal(reg.list().length, 0)
  assert.equal(b.pages[0].closed, true)
})

test('closeAll closes owned tabs only', async () => {
  const b = fakeBrowser()
  const reg = new TabRegistry(b)
  await reg.open('https://a')
  await reg.open('https://b', { owned: false })
  await reg.closeAll()
  assert.deepEqual(b.pages.map((p) => p.closed), [true, false])
})

test('navigate returns url, title and status only', async () => {
  const b = fakeBrowser()
  const reg = new TabRegistry(b)
  const t = await reg.open('about:blank')
  const r = await navigateTool(reg.page(t.tabId), 'https://example.com', {})
  assert.deepEqual(r, { url: 'https://example.com', title: 'T', status: 200 })
})

test('open and navigate refuse file:// and chrome:// with bad_argument; http, https and about:blank pass', async () => {
  const browser = fakeBrowser()
  const reg = new TabRegistry(browser)
  for (const url of ['file:///etc/passwd', 'chrome://settings', 'javascript:alert(1)', 'data:text/html,x', 'not a url']) {
    await assert.rejects(reg.open(url), (e) => e.code === 'bad_argument', url)
  }
  assert.equal(browser.pages.length, 0)
  const t = await reg.open('about:blank')
  const page = reg.page(t.tabId)
  await assert.rejects(navigateTool(page, 'file:///etc/passwd'), (e) => e.code === 'bad_argument')
  await assert.rejects(navigateTool(page, 'chrome://settings'), (e) => e.code === 'bad_argument')
  assert.equal(page.url(), 'about:blank')
  assert.equal((await navigateTool(page, 'http://example.com/')).url, 'http://example.com/')
  assert.equal((await navigateTool(page, 'https://example.com/')).url, 'https://example.com/')
})

test('open creates every tab in the background', async () => {
  const b = fakeBrowser()
  await new TabRegistry(b).open('https://a')
  await new TabRegistry(b).open()
  assert.deepEqual(b.calls, [{ background: true }, { background: true }])
})

test('closeAll closes a tab whose first navigation is still pending', async () => {
  const b = fakeBrowser()
  let release
  b.newPage = async (o) => {
    b.calls.push(o)
    const p = { _url: 'about:blank', closed: false, url: () => p._url, title: async () => 'T', close: async () => { p.closed = true; release() } }
    p.goto = () => new Promise((_, reject) => { release = () => reject(new Error('Target closed')) })
    b.pages.push(p)
    return p
  }
  const reg = new TabRegistry(b)
  const opening = reg.open('https://stalls.example')
  await new Promise((r) => setImmediate(r))
  assert.equal(reg.list().length, 1)
  await reg.closeAll()
  assert.equal(b.pages[0].closed, true)
  assert.equal(reg.list().length, 0)
  await opening
})

test('wait caps ms at 30000', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let done = false
    const p = waitTool({}, { ms: 60000 }).then(() => { done = true })
    mock.timers.tick(29999)
    await Promise.resolve()
    assert.equal(done, false)
    mock.timers.tick(1)
    await p
    assert.equal(done, true)
  } finally {
    mock.timers.reset()
  }
})

test('isBingUrl: www.bing.com and bing.com yes, google.com and bing.example no', () => {
  assert.equal(isBingUrl('https://www.bing.com/search?q=x'), true)
  assert.equal(isBingUrl('https://bing.com/search?q=x'), true)
  assert.equal(isBingUrl('https://www.google.com/search?q=x'), false)
  assert.equal(isBingUrl('https://www.bing.example/search'), false)
  assert.equal(isBingUrl('not a url'), false)
})

test('checkKind onlyBlocked: blocked stays blocked, empty topResults is null', () => {
  assert.equal(checkKindFn({ blocked: 'bing_check' }, { onlyBlocked: true }), 'blocked')
  assert.equal(checkKindFn({ topResults: [] }, { onlyBlocked: true }), null)
  assert.equal(checkKindFn({ topResults: [] }), 'noResults')
})
