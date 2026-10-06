import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSession } from '../src/session.mjs'
import { TabRegistry } from '../src/tabs.mjs'

function fakeBrowser() {
  const handlers = {}
  return {
    connected: true,
    on: (ev, fn) => { handlers[ev] = fn },
    emit: (ev) => handlers[ev]?.(),
    newPage: async () => {
      const p = { closed: false, goto: async () => {}, url: () => 'about:blank', title: async () => '', close: async () => { p.closed = true } }
      return p
    },
  }
}

test('concurrent first calls share one connection and one registry', async () => {
  let connects = 0
  let release
  const gate = new Promise((r) => { release = r })
  const connect = async () => {
    connects++
    await gate
    const browser = fakeBrowser()
    return { browser, registry: new TabRegistry(browser) }
  }
  const s = createSession({ cwd: process.cwd(), env: {} }, { connect })
  const a = s.getRegistry()
  const b = s.getRegistry()
  release()
  const [ra, rb] = await Promise.all([a, b])
  assert.equal(connects, 1)
  assert.equal(ra, rb)
  const t1 = await ra.open('about:blank')
  const t2 = await rb.open('about:blank')
  assert.notEqual(t1.tabId, t2.tabId)
  assert.equal(ra.list().length, 2)
  await ra.close(t1.tabId)
  await rb.close(t2.tabId)
  assert.equal(ra.list().length, 0)
})

test('a failed attempt is cleared and the next call retries', async () => {
  let connects = 0
  const connect = async () => {
    connects++
    if (connects === 1) throw Object.assign(new Error('no chrome'), { code: 'browser_unavailable' })
    const browser = fakeBrowser()
    return { browser, registry: new TabRegistry(browser) }
  }
  const s = createSession({ cwd: process.cwd(), env: {} }, { connect })
  await assert.rejects(s.getBrowser(), /no chrome/)
  await s.getBrowser()
  assert.equal(connects, 2)
})

test('a disconnect clears only its own connection', async () => {
  const browsers = []
  const connect = async () => {
    const browser = fakeBrowser()
    browsers.push(browser)
    return { browser, registry: new TabRegistry(browser) }
  }
  const s = createSession({ cwd: process.cwd(), env: {} }, { connect })
  const first = await s.getBrowser()
  first.connected = false
  const second = await s.getBrowser()
  assert.notEqual(first, second)
  first.emit('disconnected') // a stale disconnect must not drop the live connection
  assert.equal(await s.getBrowser(), second)
  assert.equal(browsers.length, 2)
})
