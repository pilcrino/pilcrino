import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

test('lists exactly the ten tools', async () => {
  const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin.mjs')
  const transport = new StdioClientTransport({ command: process.execPath, args: [bin] })
  const client = new Client({ name: 't', version: '0' })
  await client.connect(transport)
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map((t) => t.name).sort(), ['capture', 'click', 'login_status', 'navigate', 'open_login', 'run', 'screenshot', 'tabs', 'type', 'wait'])
  const r = await client.callTool({ name: 'capture', arguments: { tabId: 't1', script: 'return 1', outFile: 'relative.json' } })
  // outFile is validated before the tab lookup, so no Chrome is launched.
  assert.equal(r.isError, true)
  assert.equal(JSON.parse(r.content[0].text).code, 'bad_path')
  await client.close()
})

async function inMemoryClient(session) {
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const { buildServer } = await import('../src/server.mjs')
  const [a, b] = InMemoryTransport.createLinkedPair()
  await buildServer(session).connect(a)
  const client = new Client({ name: 't', version: '0' })
  await client.connect(b)
  return client
}
const codeOf = (r) => JSON.parse(r.content[0].text).code

test('a closed CDP connection is browser_unavailable', async () => {
  for (const message of ['Protocol error: Connection closed.', 'Connection closed', 'Target closed', 'Session closed. Most likely the page has been closed.']) {
    const client = await inMemoryClient({ roots: [], profile: '/nope', getRegistry: async () => { throw new Error(message) } })
    const r = await client.callTool({ name: 'tabs', arguments: { action: 'list' } })
    assert.equal(r.isError, true)
    assert.equal(codeOf(r), 'browser_unavailable', message)
    await client.close()
  }
})

test('refused url schemes never reach the registry', async () => {
  let touched = false
  const client = await inMemoryClient({ roots: [], profile: '/nope', getRegistry: async () => { touched = true; throw new Error('must not be called') } })
  for (const url of ['file:///etc/passwd', 'chrome://settings', 'javascript:alert(1)', 'data:text/html,hi']) {
    const open = await client.callTool({ name: 'tabs', arguments: { action: 'open', url } })
    assert.equal(codeOf(open), 'bad_argument', url)
    const nav = await client.callTool({ name: 'navigate', arguments: { tabId: 't1', url } })
    assert.equal(codeOf(nav), 'bad_argument', url)
  }
  assert.equal(touched, false)
  await client.close()
})

// A fake Chrome shared by several server processes: pages, CDP target lookups,
// a title set through page.evaluate, and Target.closeTarget. A Google search navigates to Google's check page
// when `sorry` is set, as a blocked search does. `step(page, op)` runs before every page operation and every
// page CDP detach, so a test can interleave another connection there; `afterList` runs once a target list is
// taken; `failLookup` fails the browser-level per-target lookup.
function checkBrowser({ value = { blocked: 'unusual_traffic', query: 'q' }, sorry = true } = {}) {
  const pages = []
  const b = {
    pages, value, failTargetInfo: false, failTitle: false, staleClosed: false, failLookup: false,
    step: async () => {}, afterList: async () => {},
    newPage: async () => {
      const p = {
        id: `T${pages.length + 1}`, closed: false, front: false, _url: 'about:blank', _title: '',
        url: () => p._url, title: async () => p._title,
        goto: async (u) => { p._url = sorry && u.startsWith('https://www.google.com/search') ? 'https://www.google.com/sorry/index?continue=x' : u },
        close: async () => { p.closed = true },
        evaluate: async (expr, ...args) => {
          if (typeof expr === 'function') {
            await b.step(p, 'title')
            if (b.failTitle) throw new Error('page.evaluate failed')
            const doc = { title: p._title }
            const saved = [globalThis.document, globalThis.location]
            globalThis.document = doc
            globalThis.location = { href: p._url }
            try { var out = expr(...args) } finally { [globalThis.document, globalThis.location] = saved }
            p._title = doc.title
            return out
          }
          return b.value
        },
        bringToFront: async () => { await b.step(p, 'front'); p.front = true },
        createCDPSession: async () => {
          if (b.failTargetInfo) throw new Error('Target.getTargetInfo failed')
          return {
            send: async (m) => {
              if (m === 'Target.getTargetInfo') return { targetInfo: { targetId: p.id } }
              return {}
            },
            detach: async () => { await b.step(p, 'detach') },
          }
        },
      }
      pages.push(p)
      return p
    },
    target: () => ({ createCDPSession: async () => ({
      send: async (m, args) => {
        if (m === 'Target.getTargets') {
          const targetInfos = pages.filter((x) => !x.closed || b.staleClosed).map((x) => ({ targetId: x.id, type: 'page', url: x._url, title: x._title }))
          await b.afterList()
          return { targetInfos }
        }
        if (m === 'Target.getTargetInfo') {
          const t = pages.find((x) => x.id === args.targetId)
          if (b.failLookup) throw new Error('lookup failed')
          if (!t || (t.closed && !b.staleClosed)) throw new Error('No target with given id found')
          return { targetInfo: { targetId: t.id, type: 'page', url: t._url, title: t._title } }
        }
        if (m === 'Target.closeTarget') {
          const t = pages.find((x) => x.id === args.targetId)
          if (t.closed) throw new Error('No target with given id found')
          t.closed = true
          b.onClose?.(t)
        }
        return {}
      },
      detach: async () => {},
    }) }),
  }
  return b
}

// One run is one server process: its own registry and session over the shared Chrome.
async function blockedRun(browser, root, { url = 'https://www.google.com/search?q=q' } = {}) {
  const { TabRegistry } = await import('../src/tabs.mjs')
  const logs = []
  const registry = new TabRegistry(browser, { log: (m) => logs.push(m) })
  const session = { roots: [root], profile: '/nope', getRegistry: async () => registry, closeOwned: () => registry.closeAll() }
  const client = await inMemoryClient(session)
  await registry.open('https://example.com')
  const otherTab = browser.pages[browser.pages.length - 1]
  const { tabId } = await registry.open(url)
  const tab = browser.pages[browser.pages.length - 1]
  const r = await client.callTool({ name: 'capture', arguments: { tabId, script: 'return 1', outFile: join(root, `serp-${tabId}.json`) } })
  assert.equal(r.isError, undefined, r.content[0].text)
  const res = JSON.parse(r.content[0].text)
  const again = await client.callTool({ name: 'tabs', arguments: { action: 'close', tabId } })
  await session.closeOwned()
  await client.close()
  assert.equal(otherTab.closed, true, 'the run\'s other owned tab is closed')
  return { res, tab, logs, againCode: again.isError ? codeOf(again) : null }
}

async function tmpRoot() {
  const { mkdtempSync, realpathSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  return realpathSync(mkdtempSync(join(tmpdir(), 'pb-left-')))
}

const CHECK_TITLE = 'Pilcrino: pass the check'

test('a blocked Google capture leaves its tab open, titled, un-owned and in front; the next block closes the earlier one by its title', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  const owners = await b.newPage()
  owners._url = 'https://www.google.com/search?q=mine'
  // Another server process's tab mid-capture on Google's check page: un-owned here, untitled.
  const concurrent = await b.newPage()
  concurrent._url = 'https://www.google.com/sorry/index?continue=y'
  concurrent._title = 'https://www.google.com/search?q=other'
  const first = await blockedRun(b, root)
  assert.deepEqual([first.res.blocked, first.res.leftOpen, first.res.noResults], [true, true, undefined])
  assert.equal(first.againCode, 'not_owned')
  assert.equal(first.tab.closed, false)
  assert.equal(first.tab.front, true)
  assert.equal(first.tab._title, CHECK_TITLE)
  const second = await blockedRun(b, root)
  assert.equal(second.res.blocked, true)
  assert.equal(first.tab.closed, true, 'the earlier titled tab is closed')
  assert.equal(second.tab.closed, false)
  assert.equal(second.tab._title, CHECK_TITLE)
  assert.deepEqual(b.pages.filter((p) => !p.closed), [owners, concurrent, second.tab], 'untitled Google tabs stay open, check page or not')
  assert.deepEqual([...first.logs, ...second.logs], [])
})

test('a titled check tab the owner already closed by hand breaks nothing', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  const first = await blockedRun(b, root)
  assert.equal(first.tab._title, CHECK_TITLE)
  first.tab.closed = true
  // Chrome may still list a target the owner just closed; closing it then fails and is logged.
  b.staleClosed = true
  const second = await blockedRun(b, root)
  assert.equal(second.res.blocked, true)
  assert.equal(second.res.leftOpen, true)
  assert.equal(second.tab.closed, false)
  assert.equal(second.tab.front, true)
  assert.equal(second.logs.length, 1)
  assert.match(second.logs[0], /could not close an earlier check tab/)
})

test('a target lookup failure skips the cleanup, leaves the tab open and still returns the blocked result', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  const first = await blockedRun(b, root)
  b.failTargetInfo = true
  const second = await blockedRun(b, root)
  assert.equal(second.res.blocked, true)
  assert.equal(second.res.leftOpen, true)
  assert.equal(second.tab.closed, false)
  assert.equal(second.tab.front, true)
  assert.equal(first.tab.closed, false, 'nothing is closed when ownership cannot be told')
  assert.match(second.logs.join('\n'), /skipped closing earlier check tabs: Target.getTargetInfo failed/)
})

test('a failed title is logged, the tab is still left open, and the cleanup never closes it', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  b.failTitle = true
  const first = await blockedRun(b, root)
  assert.deepEqual([first.res.blocked, first.res.leftOpen], [true, true])
  assert.equal(first.tab.closed, false)
  assert.equal(first.tab.front, true)
  assert.equal(first.tab._title, '')
  assert.match(first.logs.join('\n'), /could not title the check tab/)
  assert.equal(first.res.blocked, true, 'the blocked result stands when the title fails after release')
  b.failTitle = false
  const second = await blockedRun(b, root)
  assert.equal(first.tab.closed, false, 'an untitled tab is never cleaned up')
  assert.equal(second.tab._title, CHECK_TITLE)
})

test('a Google capture with no results also leaves its tab open, titled and in front; the next one closes it', async () => {
  const root = await tmpRoot()
  const b = checkBrowser({ value: { query: 'q', topResults: [] }, sorry: false })
  const run = await blockedRun(b, root)
  assert.deepEqual([run.res.noResults, run.res.leftOpen, run.res.blocked], [true, true, undefined])
  assert.equal(run.againCode, 'not_owned')
  assert.equal(run.tab.closed, false)
  assert.equal(run.tab.front, true)
  assert.equal(run.tab._url, 'https://www.google.com/search?q=q')
  assert.equal(run.tab._title, CHECK_TITLE)
  const next = await blockedRun(b, root)
  assert.equal(next.res.noResults, true)
  assert.equal(run.tab.closed, true, 'a titled tab on a normal search url is closed too')
  assert.equal(next.tab.closed, false)
})

test('outside Google a blocked value returns the plain result and the tab closes as usual', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  const run = await blockedRun(b, root, { url: 'https://www.reddit.com/search.json?q=q' })
  assert.deepEqual(Object.keys(run.res).sort(), ['bytes', 'items', 'path'])
  assert.equal(run.againCode, null)
  assert.equal(run.tab.closed, true)
})

// Two server processes over one Chrome: separate browser connections, so neither sees the other's ownership.
async function twoConnections() {
  const { TabRegistry } = await import('../src/tabs.mjs')
  const b = checkBrowser()
  const connA = Object.create(b)
  const connB = Object.create(b)
  const logs = []
  const regA = new TabRegistry(connA, { log: (m) => logs.push(`A: ${m}`) })
  const regB = new TabRegistry(connB, { log: (m) => logs.push(`B: ${m}`) })
  return { b, regA, regB, logs }
}

test('a cleanup on another connection overlapping the marking never closes the tab before it is released', async () => {
  const { b, regA, regB, logs } = await twoConnections()
  const { tabId } = await regA.open('https://www.google.com/search?q=q')
  const tab = b.pages[b.pages.length - 1]
  const ownedByA = () => [...regA.owned.values()].includes(tab)
  const closes = []
  b.onClose = (t) => { if (t === tab) closes.push({ ownedByA: ownedByA(), title: t._title }) }
  // At every operation on A's tab (and every detach, delayed), B's cleanup runs to completion first.
  let busy = false
  const steps = []
  b.step = async (p, op) => {
    if (p !== tab || busy) return
    steps.push(op)
    busy = true
    try {
      await new Promise((r) => setTimeout(r, 5))
      await regB.closeCheckLeftovers()
    } finally { busy = false }
  }
  const res = await regA.leaveOpen(tabId)
  assert.deepEqual(res, { leftOpen: true })
  assert.ok(steps.includes('detach') && steps.includes('front') && steps.includes('title'), steps.join(','))
  assert.equal(steps[steps.length - 1], 'title', 'the title is the last operation on the tab')
  assert.equal(tab._title, CHECK_TITLE)
  assert.equal(ownedByA(), false)
  b.step = async () => {}
  await regB.closeCheckLeftovers()
  assert.equal(tab.closed, true, 'once released and titled, the next cleanup closes it')
  assert.deepEqual(closes, [{ ownedByA: false, title: CHECK_TITLE }], 'never closed while A still owned it')
  assert.deepEqual(logs, [])
  await regA.closeAll()
})

test('a candidate whose title changed between the listing and the close is left open', async () => {
  const { b, regA, regB, logs } = await twoConnections()
  const { tabId } = await regA.open('https://www.google.com/search?q=q')
  const tab = b.pages[b.pages.length - 1]
  await regA.leaveOpen(tabId)
  assert.equal(tab._title, CHECK_TITLE)
  // The owner passes the check while B's target list is in flight.
  b.afterList = async () => { tab._url = 'https://www.google.com/search?q=q&results'; tab._title = 'q - Google Search' }
  await regB.closeCheckLeftovers()
  assert.equal(tab.closed, false)
  assert.deepEqual(logs, [])
})

test('a candidate whose title cannot be read again is left open and the failure is logged', async () => {
  const { b, regA, regB, logs } = await twoConnections()
  const { tabId } = await regA.open('https://www.google.com/search?q=q')
  const tab = b.pages[b.pages.length - 1]
  await regA.leaveOpen(tabId)
  b.failLookup = true
  await regB.closeCheckLeftovers()
  assert.equal(tab.closed, false)
  assert.equal(tab._title, CHECK_TITLE)
  assert.deepEqual(logs, ['B: left an earlier check tab open, its title could not be read again: lookup failed'])
})

test('a page that moved on between the release and the title write is not marked and a later cleanup leaves it', async () => {
  const { b, regA, regB, logs } = await twoConnections()
  const { tabId } = await regA.open('https://www.google.com/sorry/index?continue=x')
  const tab = b.pages[b.pages.length - 1]
  // The owner passes the check while the window comes to the front.
  b.step = async (p, op) => { if (p === tab && op === 'front') tab._url = 'https://www.google.com/search?q=q&results' }
  const res = await regA.leaveOpen(tabId, 'https://www.google.com/sorry/index?continue=x')
  assert.deepEqual(res, { leftOpen: true })
  assert.equal(tab._title, '', 'the new page is not titled')
  assert.equal(logs.length, 1)
  assert.match(logs[0], /left the tab untitled/)
  b.step = async () => {}
  await regB.closeCheckLeftovers()
  assert.equal(tab.closed, false)
  await regA.closeAll()
})
