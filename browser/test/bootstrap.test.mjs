import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { runBootstrap } from '../src/bootstrap.mjs'

const STATUS_TOOL = {
  name: 'install_status',
  description: 'Reports the Pilcrino browser package install that runs after a plugin update: how long it has been running, or why it failed and when it retries. The browser tools replace this one when the install is done.',
  inputSchema: { type: 'object', properties: {} },
}

function harness({ install, sleep, now, retryMs } = {}) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const lines = []
  const waiters = []
  let out = ''
  stdout.on('data', (c) => {
    out += c.toString()
    let nl
    while ((nl = out.indexOf('\n')) !== -1) {
      lines.push(JSON.parse(out.slice(0, nl)))
      out = out.slice(nl + 1)
      for (const w of waiters.splice(0)) w()
    }
  })
  let errText = ''
  stderr.on('data', (c) => { errText += c.toString() })
  let resolveInstall, rejectInstall
  const installed = new Promise((res, rej) => { resolveInstall = res; rejectInstall = rej })
  const handovers = []
  const { done } = runBootstrap({
    stdin, stdout, stderr, version: '9.9.9',
    install: install ?? (() => installed),
    handover: async (arg) => { handovers.push(arg) },
    ...(sleep && { sleep }),
    ...(now && { now }),
    ...(retryMs !== undefined && { retryMs }),
  })
  const next = async (n) => {
    while (lines.length < n) await new Promise((r) => waiters.push(r))
    return lines[n - 1]
  }
  const sendLine = (msg) => stdin.write(`${JSON.stringify(msg)}\n`)
  return { stdin, lines, next, sendLine, resolveInstall, rejectInstall, handovers, done, stderr: () => errText }
}

test('answers the handshake, ping, tools/list, tools/call and unknown methods while installing', async () => {
  const h = harness()
  h.sendLine({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } })
  assert.deepEqual(await h.next(1), {
    jsonrpc: '2.0', id: 1,
    result: { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'pilcrino-browser', version: '9.9.9' } },
  })
  h.sendLine({ jsonrpc: '2.0', method: 'notifications/initialized' })
  h.sendLine({ jsonrpc: '2.0', id: 2, method: 'ping' })
  assert.deepEqual(await h.next(2), { jsonrpc: '2.0', id: 2, result: {} })
  h.sendLine({ jsonrpc: '2.0', id: 3, method: 'tools/list' })
  assert.deepEqual(await h.next(3), { jsonrpc: '2.0', id: 3, result: { tools: [STATUS_TOOL] } })
  h.sendLine({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'login_status', arguments: {} } })
  assert.deepEqual(await h.next(4), {
    jsonrpc: '2.0', id: 4,
    result: { content: [{ type: 'text', text: 'pilcrino-browser is installing its packages after a plugin update; try again in a minute' }], isError: true },
  })
  h.sendLine({ jsonrpc: '2.0', id: 'x', method: 'resources/list' })
  assert.deepEqual(await h.next(5), { jsonrpc: '2.0', id: 'x', error: { code: -32601, message: 'Method not found' } })
  // The notification got no answer: exactly five lines so far.
  assert.equal(h.lines.length, 5)
})

test('a request split across two chunks is answered once whole', async () => {
  const h = harness()
  const line = `${JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'ping' })}\n`
  h.stdin.write(line.slice(0, 10))
  await new Promise((r) => setImmediate(r))
  assert.equal(h.lines.length, 0)
  h.stdin.write(line.slice(10))
  assert.deepEqual(await h.next(1), { jsonrpc: '2.0', id: 7, result: {} })
})

test('after the install, sends list_changed and hands over the unread bytes', async () => {
  const h = harness()
  h.sendLine({ jsonrpc: '2.0', id: 1, method: 'ping' })
  await h.next(1)
  const partial = '{"jsonrpc":"2.0","id":2,"meth'
  h.stdin.write(partial)
  await new Promise((r) => setImmediate(r))
  h.resolveInstall({ startServer: 'fake' })
  assert.deepEqual(await h.done, { ok: true })
  assert.deepEqual(await h.next(2), { jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
  assert.equal(h.handovers.length, 1)
  assert.equal(h.handovers[0].leftover.toString(), partial)
  assert.deepEqual(h.handovers[0].result, { startServer: 'fake' })
  // The shim no longer reads stdin: the rest of the line waits for the real server, prefixed by the unshifted bytes.
  h.stdin.write('od":"ping"}\n')
  await new Promise((r) => setImmediate(r))
  assert.equal(h.lines.length, 2)
  assert.equal(h.stdin.read().toString(), `${partial}od":"ping"}\n`)
})

test('install_status is listed and reports the running install with its elapsed seconds', async () => {
  let t = 1_000_000
  const h = harness({ now: () => t })
  h.sendLine({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  const list = await h.next(1)
  assert.deepEqual(list.result.tools.map((x) => x.name), ['install_status'])
  assert.deepEqual(list.result.tools[0].inputSchema, { type: 'object', properties: {} })
  t += 42_000
  h.sendLine({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'install_status', arguments: {} } })
  assert.deepEqual(await h.next(2), {
    jsonrpc: '2.0', id: 2,
    result: { content: [{ type: 'text', text: 'pilcrino-browser is installing its packages after a plugin update (42 s so far). The browser tools appear when it is done.' }] },
  })
})

test('a failed install keeps answering with the reason, retries, and hands over once one succeeds', async () => {
  let t = 1_000_000
  let attempts = 0
  const sleeps = []
  const install = async () => {
    attempts++
    if (attempts <= 2) throw new Error(`npm install failed in /x (exit ${attempts})`)
    return { startServer: 'fake' }
  }
  // Each retry delay waits for the test to release it.
  const sleep = (ms) => new Promise((r) => sleeps.push({ ms, go: r }))
  const h = harness({ install, sleep, now: () => t })
  const nextSleep = async (n) => { while (sleeps.length < n) await new Promise((r) => setImmediate(r)) }

  await nextSleep(1)
  assert.equal(sleeps[0].ms, 60_000)
  assert.match(h.stderr(), /could not install its packages: npm install failed in \/x \(exit 1\); retrying in 60 s\n/)
  // Tool discovery first, as Claude Code does: the status tool is there to call.
  h.sendLine({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  assert.deepEqual((await h.next(1)).result.tools.map((x) => x.name), ['install_status'])
  t += 15_000
  h.sendLine({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'install_status', arguments: {} } })
  assert.deepEqual((await h.next(2)).result, {
    content: [{ type: 'text', text: 'pilcrino-browser could not install its packages: npm install failed in /x (exit 1); retrying in 45 s' }],
  })
  // Any other tool keeps the isError answer with the reason.
  h.sendLine({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'tabs' } })
  const r = (await h.next(3)).result
  assert.equal(r.isError, true)
  assert.equal(r.content[0].text, 'pilcrino-browser could not install its packages: npm install failed in /x (exit 1)')

  t += 45_000
  sleeps[0].go()
  await nextSleep(2)
  assert.equal(attempts, 2)
  h.sendLine({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'install_status', arguments: {} } })
  assert.match((await h.next(4)).result.content[0].text, /npm install failed in \/x \(exit 2\); retrying in 60 s$/)
  // One stderr line per failed attempt.
  assert.equal(h.stderr().trim().split('\n').length, 2)
  assert.equal(h.handovers.length, 0)

  sleeps[1].go()
  assert.deepEqual(await h.done, { ok: true })
  assert.equal(attempts, 3)
  assert.deepEqual(await h.next(5), { jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
  assert.equal(h.handovers.length, 1)
  assert.deepEqual(h.handovers[0].result, { startServer: 'fake' })
})
