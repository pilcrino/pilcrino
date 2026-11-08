import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createServer } from 'node:net'
import { WebSocket } from 'ws'
import { BRIDGE_PORTS, createBridge, extensionIdFromKey, extensionOrigin, PROTOCOL_VERSION } from '../src/bridge.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop'
const quiet = () => {}
const url = (b) => `ws://127.0.0.1:${b.port}`
const until = (ws, ev) => new Promise((r) => ws.once(ev, (...a) => r(a)))
const frames = (ws) => { const out = []; ws.on('message', (d) => out.push(JSON.parse(d.toString()))); return out }
const next = (ws) => new Promise((r) => ws.once('message', (d) => r(JSON.parse(d.toString()))))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function bridge(opts = {}) {
  const b = createBridge({ ports: [0], origin: ORIGIN, pluginVersion: '0.62.0', log: quiet, ...opts })
  assert.ok(await b.listen())
  return b
}
async function connect(b, { origin = ORIGIN, hello = { type: 'hello', protocol: PROTOCOL_VERSION, plugin: '0.62.0' } } = {}) {
  const ws = new WebSocket(url(b), { headers: { origin } })
  ws.on('error', () => {})
  const got = frames(ws)
  const closed = until(ws, 'close')
  await until(ws, 'open')
  if (hello) { ws.send(JSON.stringify(hello)); await sleep(20) }
  return { ws, got, closed }
}
const SEARCH_URL = 'https://www.google.com/search?q=kanban&pilcrino=tok'

test('extensionIdFromKey matches a known vector and extensionOrigin reads the manifest', () => {
  const key = Buffer.from('pilcrino test key').toString('base64')
  // sha256('pilcrino test key') starts with 8f5a... ; the id maps each hex nibble to a letter a..p
  const id = extensionIdFromKey(key)
  assert.equal(id, 'fmdcadooikekkaacjakigocemagfdkal')
  const o = extensionOrigin('m.json', { readFileSync: () => JSON.stringify({ key }) })
  assert.equal(o, `chrome-extension://${id}`)
  // The id Chrome shows for the shipped manifest key, recorded in extension/README.md.
  assert.equal(extensionOrigin(join(here, '..', '..', 'extension', 'manifest.json')), 'chrome-extension://baadncnanikldfjmdekjakgjgmclbkbl')
})

test('extension and server agree on the protocol version; manifest version is the plugin version', () => {
  const src = readFileSync(join(here, '..', '..', 'extension', 'lib', 'protocol.js'), 'utf8')
  assert.equal(Number(/PILCRINO_PROTOCOL\s*=\s*(\d+)/.exec(src)[1]), PROTOCOL_VERSION)
  const ports = JSON.parse(/PILCRINO_PORTS\s*=\s*(\[[^\]]*\])/.exec(src)[1])
  assert.deepEqual(ports, BRIDGE_PORTS)
  const manifest = JSON.parse(readFileSync(join(here, '..', '..', 'extension', 'manifest.json'), 'utf8'))
  const plugin = JSON.parse(readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'))
  assert.equal(manifest.version, plugin.version)
})

test('a socket with the wrong Origin is refused at the upgrade (HTTP 401)', async () => {
  const b = await bridge()
  const ws = new WebSocket(url(b), { headers: { origin: 'https://evil.example' } })
  ws.on('error', () => {})
  const [, res] = await until(ws, 'unexpected-response')
  assert.equal(res.statusCode, 401)
  ws.terminate()
  await b.close()
})

test('hello with another protocol closes 4001; a search then fails extension_outdated with the right hint', async () => {
  const b = await bridge({ deadlineMs: 200 })
  const { closed } = await connect(b, { hello: { type: 'hello', protocol: 99, plugin: '9.9.9' } })
  const [code, reason] = await closed
  assert.equal(code, 4001); assert.equal(reason.toString(), 'extension_outdated')
  await assert.rejects(b.search({ url: SEARCH_URL, token: 'tok' }), (e) => e.code === 'extension_outdated' && /newer than this Pilcrino/.test(e.message))
  const { closed: closed2 } = await connect(b, { hello: { type: 'hello', protocol: 0, plugin: '0.1.0' } })
  await closed2
  await assert.rejects(b.search({ url: SEARCH_URL, token: 'tok' }), (e) => e.code === 'extension_outdated' && /run blog-setup again/.test(e.message))
  await b.close()
})

test('hello without a protocol field is treated as outdated', async () => {
  const b = await bridge()
  const { closed } = await connect(b, { hello: { type: 'hello' } })
  const [code] = await closed
  assert.equal(code, 4001)
  await b.close()
})

test('second extension is closed 4002 already_connected, first keeps working', async () => {
  const b = await bridge()
  const a = await connect(b)
  const c = await connect(b)
  const [code, reason] = await c.closed
  assert.equal(code, 4002); assert.equal(reason.toString(), 'already_connected')
  assert.deepEqual(a.got[0], { type: 'welcome' })
  a.ws.send(JSON.stringify({ type: 'ping' }))
  assert.deepEqual(await next(a.ws), { type: 'pong' })
  await b.close()
})

test('search sends {type:search,id,url,token}; a result with the right id and token resolves; the token is single use', async () => {
  const b = await bridge()
  const { ws } = await connect(b)
  const p = b.search({ url: SEARCH_URL, token: 'tok' })
  const m = await next(ws)
  assert.equal(m.type, 'search'); assert.equal(m.url, SEARCH_URL); assert.equal(m.token, 'tok'); assert.ok(m.id)
  ws.send(JSON.stringify({ type: 'result', id: m.id, token: 'tok', value: { topResults: [1] } }))
  assert.deepEqual(await p, { value: { topResults: [1] } })
  // a replay of the same frame has no effect on the next search
  const p2 = b.search({ url: SEARCH_URL, token: 'tok2' })
  const m2 = await next(ws)
  ws.send(JSON.stringify({ type: 'result', id: m.id, token: 'tok', value: { topResults: [9] } }))
  await sleep(20)
  ws.send(JSON.stringify({ type: 'result', id: m2.id, token: 'tok2', value: { topResults: [2] } }))
  assert.deepEqual(await p2, { value: { topResults: [2] } })
  await b.close()
})

test('result with wrong token or unknown id is dropped; lost rejects extension_timeout', async () => {
  const b = await bridge({ deadlineMs: 300 })
  const { ws } = await connect(b)
  const p = b.search({ url: SEARCH_URL, token: 'tok' })
  const m = await next(ws)
  ws.send(JSON.stringify({ type: 'result', id: m.id, token: 'wrong', value: {} }))
  ws.send(JSON.stringify({ type: 'result', id: 'nope', token: 'tok', value: {} }))
  await sleep(30)
  ws.send(JSON.stringify({ type: 'lost', id: m.id, token: 'tok', reason: 'tab_lost' }))
  await assert.rejects(p, (e) => e.code === 'extension_timeout' && /tab_lost/.test(e.message))
  await b.close()
})

test('a non-JSON frame and a JSON frame without type are dropped, the socket stays open, the next search works', async () => {
  const b = await bridge()
  const { ws } = await connect(b)
  ws.send('not json'); ws.send(JSON.stringify({ hello: 1 })); ws.send('42')
  await sleep(30)
  assert.equal(ws.readyState, WebSocket.OPEN)
  const p = b.search({ url: SEARCH_URL, token: 'tok' })
  const m = await next(ws)
  ws.send(JSON.stringify({ type: 'result', id: m.id, token: 'tok', value: { ok: 1 } }))
  assert.deepEqual(await p, { value: { ok: 1 } })
  await b.close()
})

test('an oversized frame closes that socket without crashing; a new connection and search then work', async () => {
  const b = await bridge()
  const { ws, closed } = await connect(b)
  ws.send('x'.repeat(3 * 1024 * 1024))
  const [code] = await closed
  assert.equal(code, 1009)
  await sleep(30) // the server sees its side of the close a moment after the client
  assert.equal(b.connected(), false)
  const { ws: ws2 } = await connect(b)
  const p = b.search({ url: SEARCH_URL, token: 'tok' })
  const m = await next(ws2)
  ws2.send(JSON.stringify({ type: 'result', id: m.id, token: 'tok', value: { ok: 2 } }))
  assert.deepEqual(await p, { value: { ok: 2 } })
  await b.close()
})

test('an invalid WebSocket frame is survived the same way', async () => {
  const b = await bridge()
  const { ws, closed } = await connect(b)
  ws._socket.write(Buffer.from([0xf1, 0x01, 0x41])) // RSV bits set: a protocol error
  const [code] = await closed
  assert.equal(code, 1002)
  const { ws: ws2 } = await connect(b)
  assert.equal(b.connected(), true)
  ws2.close()
  await b.close()
})

test('no extension: search waits up to the deadline for a connection then rejects extension_not_connected', async () => {
  const b = await bridge({ deadlineMs: 150 })
  const t0 = Date.now()
  await assert.rejects(b.search({ url: SEARCH_URL, token: 'tok' }), (e) => e.code === 'extension_not_connected' && /extension did not answer/.test(e.message))
  assert.ok(Date.now() - t0 >= 140)
  await b.close()
})

test('a connection arriving during the wait gets the search at once', async () => {
  const b = await bridge({ deadlineMs: 2000 })
  const p = b.search({ url: SEARCH_URL, token: 'tok' })
  await sleep(50)
  const { ws, got } = await connect(b)
  await sleep(30)
  assert.equal(got[0].type, 'welcome'); assert.equal(got[1].type, 'search')
  ws.send(JSON.stringify({ type: 'result', id: got[1].id, token: 'tok', value: { late: true } }))
  assert.deepEqual(await p, { value: { late: true } })
  await b.close()
})

test('connected but silent: extension_timeout at the deadline and a cancel frame is sent', async () => {
  const b = await bridge({ deadlineMs: 150 })
  const { ws, got } = await connect(b)
  await assert.rejects(b.search({ url: SEARCH_URL, token: 'tok' }), (e) => e.code === 'extension_timeout')
  await sleep(20)
  assert.deepEqual(got.map((f) => f.type), ['welcome', 'search', 'cancel'])
  assert.equal(got[2].id, got[1].id)
  ws.close()
  await b.close()
})

test('socket drop during a pending search rejects extension_timeout', async () => {
  const b = await bridge({ deadlineMs: 2000 })
  const { ws } = await connect(b)
  const p = b.search({ url: SEARCH_URL, token: 'tok' })
  await next(ws)
  ws.terminate()
  await assert.rejects(p, (e) => e.code === 'extension_timeout' && /disconnected/.test(e.message))
  await b.close()
})

test('two searches run one after the other; the second is sent only after the first settles', async () => {
  const b = await bridge()
  const { ws, got } = await connect(b)
  const p1 = b.search({ url: SEARCH_URL, token: 'a' })
  const p2 = b.search({ url: SEARCH_URL, token: 'b' })
  await sleep(30)
  assert.deepEqual(got.filter((f) => f.type === 'search').map((f) => f.token), ['a'])
  ws.send(JSON.stringify({ type: 'result', id: got[1].id, token: 'a', value: { n: 1 } }))
  await p1
  await sleep(20)
  assert.deepEqual(got.filter((f) => f.type === 'search').map((f) => f.token), ['a', 'b'])
  ws.send(JSON.stringify({ type: 'result', id: got[2].id, token: 'b', value: { n: 2 } }))
  assert.deepEqual(await p2, { value: { n: 2 } })
  await b.close()
})

test('a reply after the deadline is dropped and the queued search runs', async () => {
  const b = await bridge({ deadlineMs: 120 })
  const { ws, got } = await connect(b)
  const p1 = b.search({ url: SEARCH_URL, token: 'a' })
  const p2 = b.search({ url: SEARCH_URL, token: 'b' })
  await assert.rejects(p1, (e) => e.code === 'extension_timeout')
  await sleep(20)
  const first = got.find((f) => f.type === 'search' && f.token === 'a')
  ws.send(JSON.stringify({ type: 'result', id: first.id, token: 'a', value: { late: 1 } }))
  const second = got.find((f) => f.type === 'search' && f.token === 'b')
  assert.ok(second)
  ws.send(JSON.stringify({ type: 'result', id: second.id, token: 'b', value: { n: 2 } }))
  assert.deepEqual(await p2, { value: { n: 2 } })
  await b.close()
})

test('ping is answered with pong', async () => {
  const b = await bridge()
  const { ws } = await connect(b)
  ws.send(JSON.stringify({ type: 'ping' }))
  assert.deepEqual(await next(ws), { type: 'pong' })
  await b.close()
})

test('close() sends cancel for the pending search, rejects queued ones and stops listening', async () => {
  const b = await bridge({ deadlineMs: 5000 })
  const { ws, got } = await connect(b)
  const p1 = b.search({ url: SEARCH_URL, token: 'a' })
  const p2 = b.search({ url: SEARCH_URL, token: 'b' })
  await next(ws)
  const port = b.port
  const r1 = assert.rejects(p1, (e) => e.code === 'extension_not_connected')
  const r2 = assert.rejects(p2, (e) => e.code === 'extension_not_connected')
  await b.close()
  await r1; await r2
  await sleep(20)
  assert.deepEqual(got.map((f) => f.type), ['welcome', 'search', 'cancel'], 'no second search is sent during shutdown')
  assert.equal(got[1].token, 'a')
  const probe = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { origin: ORIGIN } })
  await until(probe, 'error')
})

test('listen() takes the first free port of the range and returns null when all are taken', async () => {
  const blocker = createServer()
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r))
  const taken = blocker.address().port
  const b = createBridge({ ports: [taken], origin: ORIGIN, log: quiet })
  assert.equal(await b.listen(), null)
  await assert.rejects(b.search({ url: SEARCH_URL, token: 'tok' }), (e) => e.code === 'extension_not_connected' && e.detail === 'too many Pilcrino sessions')
  const b2 = createBridge({ ports: [taken, 0], origin: ORIGIN, log: quiet })
  const p = await b2.listen()
  assert.ok(p && p !== taken)
  await b2.close()
  blocker.close()
})

test('search refuses a url that is not a Google search', async () => {
  const b = await bridge()
  assert.throws(() => b.search({ url: 'https://example.com/?pilcrino=x', token: 'x' }), (e) => e.code === 'bad_argument')
  await b.close()
})
