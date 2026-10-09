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

test('a blocked capture leaves its tab open, un-owned and in front; a second block leaves exactly one such tab', async () => {
  const { mkdtempSync, realpathSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { TabRegistry } = await import('../src/tabs.mjs')
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-left-')))
  const pages = []
  const browser = {
    newPage: async () => {
      const p = {
        id: `T${pages.length + 1}`, closed: false, front: false, _url: 'about:blank',
        url: () => p._url, title: async () => '', goto: async (u) => { p._url = u },
        close: async () => { p.closed = true },
        evaluate: async () => ({ blocked: 'unusual_traffic', query: 'q' }),
        bringToFront: async () => { p.front = true },
        createCDPSession: async () => ({ send: async (m) => (m === 'Target.getTargetInfo' ? { targetInfo: { targetId: p.id } } : {}), detach: async () => {} }),
      }
      pages.push(p)
      return p
    },
    target: () => ({ createCDPSession: async () => ({ send: async (m, { targetId }) => { if (m === 'Target.closeTarget') pages.find((x) => x.id === targetId).closed = true }, detach: async () => {} }) }),
  }
  let stored = null
  const leftTabs = { read: () => stored, write: (id) => { stored = id } }
  const run = async () => {
    // A fresh registry per run, as each run is its own server process; the store outlives it.
    const registry = new TabRegistry(browser)
    const session = { roots: [root], profile: '/nope', leftTabs, getRegistry: async () => registry, closeOwned: () => registry.closeAll() }
    const client = await inMemoryClient(session)
    const other = await registry.open('https://example.com')
    const { tabId } = await registry.open('https://www.google.com/search?q=q')
    const r = await client.callTool({ name: 'capture', arguments: { tabId, script: 'return 1', outFile: join(root, `serp-${tabId}.json`) } })
    const res = JSON.parse(r.content[0].text)
    assert.equal(res.blocked, true)
    assert.equal(res.leftOpen, true)
    const again = await client.callTool({ name: 'tabs', arguments: { action: 'close', tabId } })
    assert.equal(codeOf(again), 'not_owned')
    await session.closeOwned()
    assert.equal(pages.find((p) => p.id === stored).closed, false)
    assert.equal(registry.list().length, 0)
    assert.equal(pages[pages.length - 2].closed, true, `owned tab ${other.tabId} is closed`)
    await client.close()
  }
  await run()
  const open1 = pages.filter((p) => !p.closed)
  assert.equal(open1.length, 1)
  assert.equal(open1[0].front, true)
  assert.equal(open1[0]._url, 'https://www.google.com/search?q=q')
  await run()
  const open2 = pages.filter((p) => !p.closed)
  assert.equal(open2.length, 1)
  assert.notEqual(open2[0], open1[0])
  assert.equal(open2[0].id, stored)
  rmSync(root, { recursive: true, force: true })
})
