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

// A fake Chrome shared by several server processes: pages, CDP target lookups
// and Target.closeTarget. A Google search navigates to Google's check page
// when `sorry` is set, as a blocked search does.
function checkBrowser({ value = { blocked: 'unusual_traffic', query: 'q' }, sorry = true } = {}) {
  const pages = []
  const b = {
    pages, value, failTargetInfo: false, staleClosed: false,
    newPage: async () => {
      const p = {
        id: `T${pages.length + 1}`, closed: false, front: false, _url: 'about:blank',
        url: () => p._url, title: async () => '',
        goto: async (u) => { p._url = sorry && u.startsWith('https://www.google.com/search') ? 'https://www.google.com/sorry/index?continue=x' : u },
        close: async () => { p.closed = true },
        evaluate: async () => b.value,
        bringToFront: async () => { p.front = true },
        createCDPSession: async () => {
          if (b.failTargetInfo) throw new Error('Target.getTargetInfo failed')
          return { send: async (m) => (m === 'Target.getTargetInfo' ? { targetInfo: { targetId: p.id } } : {}), detach: async () => {} }
        },
      }
      pages.push(p)
      return p
    },
    target: () => ({ createCDPSession: async () => ({
      send: async (m, args) => {
        if (m === 'Target.getTargets') return { targetInfos: pages.filter((x) => !x.closed || b.staleClosed).map((x) => ({ targetId: x.id, type: 'page', url: x._url })) }
        if (m === 'Target.closeTarget') {
          const t = pages.find((x) => x.id === args.targetId)
          if (t.closed) throw new Error('No target with given id found')
          t.closed = true
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

test('a blocked Google capture leaves its tab open, un-owned and in front; the next block closes the earlier one by its url', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  const owners = await b.newPage()
  owners._url = 'https://www.google.com/search?q=mine'
  const first = await blockedRun(b, root)
  assert.deepEqual([first.res.blocked, first.res.leftOpen, first.res.noResults], [true, true, undefined])
  assert.equal(first.againCode, 'not_owned')
  assert.equal(first.tab.closed, false)
  assert.equal(first.tab.front, true)
  const second = await blockedRun(b, root)
  assert.equal(second.res.blocked, true)
  assert.equal(first.tab.closed, true, 'the earlier check tab is closed')
  assert.equal(second.tab.closed, false)
  assert.deepEqual(b.pages.filter((p) => !p.closed), [owners, second.tab], 'a Google tab off the check page stays open')
  assert.deepEqual([...first.logs, ...second.logs], [])
})

test('a check tab the owner already closed by hand breaks nothing', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  const first = await blockedRun(b, root)
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

test('a Google capture with no results also leaves its tab open and in front', async () => {
  const root = await tmpRoot()
  const b = checkBrowser({ value: { query: 'q', topResults: [] }, sorry: false })
  const run = await blockedRun(b, root)
  assert.deepEqual([run.res.noResults, run.res.leftOpen, run.res.blocked], [true, true, undefined])
  assert.equal(run.againCode, 'not_owned')
  assert.equal(run.tab.closed, false)
  assert.equal(run.tab.front, true)
})

test('outside Google a blocked value returns the plain result and the tab closes as usual', async () => {
  const root = await tmpRoot()
  const b = checkBrowser()
  const run = await blockedRun(b, root, { url: 'https://www.reddit.com/search.json?q=q' })
  assert.deepEqual(Object.keys(run.res).sort(), ['bytes', 'items', 'path'])
  assert.equal(run.againCode, null)
  assert.equal(run.tab.closed, true)
})
