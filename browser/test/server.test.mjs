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
