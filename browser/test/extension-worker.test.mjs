import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
for (const f of ['protocol.js', 'worker.js']) vm.runInThisContext(readFileSync(join(here, '..', '..', 'extension', 'lib', f), 'utf8'))

const tick = () => new Promise((r) => setImmediate(r))
const frames = (ws) => ws.sent.map((s) => JSON.parse(s))
const SEARCH = (id = 'r1', token = 'tok1') => ({ type: 'search', id, url: `https://www.google.com/search?q=kanban&pilcrino=${token}`, token })

class FakeWS {
  static all = []
  constructor(url) { this.url = url; this.sent = []; this.readyState = 0; FakeWS.all.push(this) }
  send(s) { if (this.readyState !== 1) throw new Error('not open'); this.sent.push(s) }
  open() { this.readyState = 1; this.onopen?.() }
  receive(obj) { this.onmessage?.({ data: JSON.stringify(obj) }) }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }) }
}

function fakeChrome() {
  const calls = []
  const tabs = new Map() // id -> { id, url }
  let nextId = 100
  const listeners = { updated: [], removed: [], message: [], alarm: [] }
  const chrome = {
    runtime: { getManifest: () => ({ version: '0.62.0' }), onMessage: { addListener: (f) => listeners.message.push(f) } },
    alarms: { create: (...a) => calls.push(['alarms.create', ...a]), onAlarm: { addListener: (f) => listeners.alarm.push(f) } },
    tabs: {
      create: async (o) => { const t = { id: nextId++, url: o.url }; tabs.set(t.id, t); calls.push(['create', o]); return t },
      remove: async (id) => { calls.push(['remove', id]); tabs.delete(id) },
      update: async (id, o) => { calls.push(['update', id, o]) },
      get: async (id) => { const t = tabs.get(id); if (!t) throw new Error('no tab'); return t },
      onUpdated: { addListener: (f) => listeners.updated.push(f) },
      onRemoved: { addListener: (f) => listeners.removed.push(f) },
    },
  }
  return {
    chrome, calls, tabs, listeners,
    navigate(id, url) { const t = tabs.get(id); if (t) t.url = url; for (const f of listeners.updated) f(id, { url }, t) },
    closeTab(id) { tabs.delete(id); for (const f of listeners.removed) f(id) },
    message(msg, sender) { for (const f of listeners.message) f(msg, sender) },
    of: (name) => calls.filter((c) => c[0] === name),
  }
}

function setup({ ports = [47390, 47391], now = () => 1000 } = {}) {
  FakeWS.all = []
  const timers = []
  const fc = fakeChrome()
  const w = globalThis.pilcrinoCreateWorker(fc.chrome, FakeWS, {
    ports, now,
    setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t },
    clearTimeout: (t) => { if (t) t.cleared = true },
  })
  return { w, fc, timers, ws: () => FakeWS.all }
}

async function searchOn(ws, fc, id = 'r1', token = 'tok1') {
  ws.receive(SEARCH(id, token))
  await tick(); await tick()
  const tabId = fc.of('create').length ? [...fc.tabs.keys()].pop() : undefined
  return tabId
}

test('scan opens one socket per port and sends hello first', () => {
  const { ws } = setup()
  assert.equal(ws().length, 2)
  for (const s of ws()) { s.open(); assert.deepEqual(frames(s)[0], { type: 'hello', protocol: 1, plugin: '0.62.0' }) }
})

test('search opens a background tab and remembers it with its token and socket', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  assert.deepEqual(fc.of('create')[0][1], { url: 'https://www.google.com/search?q=kanban&pilcrino=tok1', active: false })
  const e = w.owned().get(tabId)
  assert.equal(e.id, 'r1'); assert.equal(e.token, 'tok1'); assert.equal(e.ws, s)
})

test('a non-google url is refused and nothing opens', async () => {
  const { fc, ws } = setup()
  const s = ws()[0]; s.open()
  s.receive({ type: 'search', id: 'x', url: 'https://evil.example/search?pilcrino=t', token: 't' })
  await tick()
  assert.equal(fc.of('create').length, 0)
  assert.deepEqual(frames(s)[1], { type: 'lost', id: 'x', token: 't', reason: 'refused' })
})

test('result from the owned tab, frame 0, right token is sent and the tab closed because its url still carries the token', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  fc.message({ type: 'pilcrino-serp', token: 'tok1', value: { topResults: [1, 2, 3, 4, 5] } }, { tab: { id: tabId }, frameId: 0 })
  await tick(); await tick(); await tick()
  assert.deepEqual(frames(s)[1], { type: 'result', id: 'r1', token: 'tok1', value: { topResults: [1, 2, 3, 4, 5] } })
  assert.deepEqual(fc.of('remove').map((c) => c[1]), [tabId])
  assert.equal(w.owned().size, 0)
})

test('result from an unowned tab, from a frame, or with a stale token is ignored and closes nothing', async () => {
  const { fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  fc.message({ type: 'pilcrino-serp', token: 'tok1', value: {} }, { tab: { id: 999 }, frameId: 0 })
  fc.message({ type: 'pilcrino-serp', token: 'tok1', value: {} }, { tab: { id: tabId }, frameId: 1 })
  fc.message({ type: 'pilcrino-serp', token: 'other', value: {} }, { tab: { id: tabId }, frameId: 0 })
  await tick(); await tick()
  assert.equal(frames(s).length, 1)
  assert.equal(fc.of('remove').length, 0)
})

test('late result from a tab whose url the owner changed is reported as lost and closes nothing', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  fc.tabs.get(tabId).url = 'https://www.google.com/search?q=my+own+search' // changed without an onUpdated event yet
  fc.message({ type: 'pilcrino-serp', token: 'tok1', value: { topResults: [] } }, { tab: { id: tabId }, frameId: 0 })
  await tick(); await tick()
  assert.deepEqual(frames(s)[1], { type: 'lost', id: 'r1', token: 'tok1', reason: 'tab_lost' })
  assert.equal(fc.of('remove').length, 0)
  assert.equal(w.owned().size, 0)
})

test('a pending navigation elsewhere ends ownership: a stale blocked capture activates nothing and the tab is not closed', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  fc.tabs.get(tabId).pendingUrl = 'https://example.com/where-the-owner-is-going'
  fc.message({ type: 'pilcrino-serp', token: 'tok1', value: { blocked: 'unusual_traffic' } }, { tab: { id: tabId }, frameId: 0 })
  await tick(); await tick()
  assert.equal(frames(s)[1].type, 'lost')
  assert.equal(fc.of('update').length, 0)
  assert.equal(fc.of('remove').length, 0)
  assert.equal(w.owned().size, 0)
  const b = await searchOn(s, fc, 'r2', 't2')
  fc.tabs.get(b).pendingUrl = 'https://example.com/leaving'
  s.receive({ type: 'cancel', id: 'r2' })
  await tick(); await tick()
  assert.equal(fc.of('remove').length, 0, 'cancel does not close a tab that is navigating away')
})

test('inline blocked result keeps the tab, activates it, forgets it', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  fc.message({ type: 'pilcrino-serp', token: 'tok1', value: { blocked: 'unusual_traffic' } }, { tab: { id: tabId }, frameId: 0 })
  await tick(); await tick()
  assert.equal(frames(s)[1].value.blocked, 'unusual_traffic')
  assert.deepEqual(fc.of('update')[0], ['update', tabId, { active: true }])
  assert.equal(fc.of('remove').length, 0)
  assert.equal(w.owned().size, 0)
})

test('owned tab landing on /sorry or consent.google.com replies blocked and keeps the tab', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  const a = await searchOn(s, fc, 'r1', 't1')
  fc.navigate(a, 'https://www.google.com/sorry/index?continue=x')
  const b = await searchOn(s, fc, 'r2', 't2')
  fc.navigate(b, 'https://consent.google.com/m?continue=x')
  const f = frames(s)
  assert.equal(f[1].value.blocked, 'unusual_traffic'); assert.equal(f[1].id, 'r1')
  assert.equal(f[2].value.blocked, 'consent'); assert.equal(f[2].id, 'r2')
  assert.equal(fc.of('update').length, 2)
  assert.equal(fc.of('remove').length, 0)
  assert.equal(w.owned().size, 0)
})

test('google rewrite that keeps the token keeps ownership; losing the token ends the request with lost and closes nothing', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  fc.navigate(tabId, 'https://www.google.com/search?q=kanban&pilcrino=tok1&sei=abc')
  assert.equal(w.owned().size, 1)
  fc.navigate(tabId, 'https://www.google.com/search?q=something+else')
  assert.deepEqual(frames(s)[1], { type: 'lost', id: 'r1', token: 'tok1', reason: 'tab_lost' })
  assert.equal(fc.of('remove').length, 0)
  assert.equal(w.owned().size, 0)
})

test('onRemoved of an owned tab sends lost', async () => {
  const { fc, ws } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  fc.closeTab(tabId)
  assert.equal(frames(s)[1].reason, 'tab_lost')
})

test('cancel closes the tab only while still owned', async () => {
  const { fc, ws } = setup()
  const s = ws()[0]; s.open()
  const a = await searchOn(s, fc, 'r1', 't1')
  s.receive({ type: 'cancel', id: 'r1' })
  await tick(); await tick()
  assert.deepEqual(fc.of('remove').map((c) => c[1]), [a])
  const b = await searchOn(s, fc, 'r2', 't2')
  fc.tabs.get(b).url = 'https://www.google.com/search?q=owner+typed'
  s.receive({ type: 'cancel', id: 'r2' })
  await tick(); await tick()
  assert.deepEqual(fc.of('remove').map((c) => c[1]), [a])
})

test('a socket drop cancels every request bound to that socket and closes their still-owned tabs', async () => {
  const { w, fc, ws } = setup()
  const [s1, s2] = ws(); s1.open(); s2.open()
  const a = await searchOn(s1, fc, 'r1', 't1')
  const b = await searchOn(s2, fc, 'r2', 't2')
  s1.close(1006)
  await tick(); await tick()
  assert.deepEqual(fc.of('remove').map((c) => c[1]), [a])
  assert.deepEqual([...w.owned().keys()], [b])
})

test('a reconnect on the same port never receives a result from a request of the old socket', async () => {
  const { w, fc, ws } = setup({ ports: [47390] })
  const s1 = ws()[0]; s1.open()
  const tabId = await searchOn(s1, fc)
  fc.tabs.get(tabId).url = 'https://example.com/moved' // not owned any more, so the drop closes nothing and the tab survives
  s1.close(1006)
  await tick(); await tick()
  w.scan()
  const s2 = ws()[1]; s2.open()
  fc.message({ type: 'pilcrino-serp', token: 'tok1', value: { topResults: [] } }, { tab: { id: tabId }, frameId: 0 })
  await tick(); await tick()
  assert.equal(frames(s2).length, 1) // only hello
})

test('cancel arriving before tabs.create resolves closes the new tab', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  let release
  fc.chrome.tabs.create = (o) => new Promise((r) => { fc.tabs.set(500, { id: 500, url: o.url }); release = () => r({ id: 500, url: o.url }) })
  s.receive(SEARCH('r1', 't1'))
  s.receive({ type: 'cancel', id: 'r1' })
  release()
  await tick(); await tick(); await tick()
  assert.deepEqual(fc.of('remove').map((c) => c[1]), [500])
  assert.equal(w.owned().size, 0)
})

test('cancel before tabs.create resolves leaves the tab alone when the owner already navigated it', async () => {
  const { w, fc, ws } = setup()
  const s = ws()[0]; s.open()
  let release
  fc.chrome.tabs.create = (o) => new Promise((r) => { fc.tabs.set(600, { id: 600, url: 'https://example.com/owner-moved-here' }); release = () => r({ id: 600, url: o.url }) })
  s.receive(SEARCH('r1', 't1'))
  s.receive({ type: 'cancel', id: 'r1' })
  release()
  await tick(); await tick(); await tick()
  assert.equal(fc.of('remove').length, 0)
  assert.equal(w.owned().size, 0)
})

test('safety timer after 60 s behaves like cancel', async () => {
  const { fc, ws, timers } = setup()
  const s = ws()[0]; s.open()
  const tabId = await searchOn(s, fc)
  const t = timers.find((x) => x.ms === 60000 && !x.cleared)
  t.fn()
  await tick(); await tick()
  assert.deepEqual(fc.of('remove').map((c) => c[1]), [tabId])
})

test('a 4002 close marks the port refused for 30 s, then the scan retries it', () => {
  let t = 1000
  const { w, ws } = setup({ ports: [47390], now: () => t })
  ws()[0].close(4002)
  w.scan()
  assert.equal(ws().length, 1)
  t = 1000 + 30001
  w.scan()
  assert.equal(ws().length, 2)
})

test('a 4001 close stops retrying that port until the next alarm scan', () => {
  const { w, ws } = setup({ ports: [47390] })
  ws()[0].close(4001)
  w.scan()
  assert.equal(ws().length, 1)
  w.scan({ alarm: true })
  assert.equal(ws().length, 2)
})

test('ping is answered with pong; the 5 s tick rescans and pings every fourth tick', () => {
  const { ws, timers } = setup({ ports: [47390] })
  const s = ws()[0]; s.open()
  s.receive({ type: 'ping' })
  assert.deepEqual(frames(s)[1], { type: 'pong' })
  for (let i = 0; i < 4; i++) { const t = timers.filter((x) => x.ms === 5000 && !x.cleared).pop(); t.cleared = true; t.fn() }
  assert.deepEqual(frames(s)[2], { type: 'ping' })
})

test('a malformed frame is ignored', () => {
  const { ws } = setup({ ports: [47390] })
  const s = ws()[0]; s.open()
  s.onmessage({ data: 'not json' })
  s.onmessage({ data: '42' })
  assert.equal(frames(s).length, 1)
})
