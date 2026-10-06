import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import assert from 'node:assert/strict'
import { closeOverCdp, openSignIn, signInOrder, SIGNIN_NEXT } from '../src/signin.mjs'
import { createSession } from '../src/session.mjs'

// Nothing here launches or drives a real Chrome: fs, fetch, spawn, the CDP
// close and the process check are all injected.
const memfs = (files) => ({
  existsSync: (p) => p in files,
  readFileSync: (p) => { if (!(p in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); return files[p] },
  mkdirSync: () => {},
})
const WS = 'ws://127.0.0.1:9100/devtools/browser/pil'
const identityFetch = async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: WS }) })
// The child reports `spawn` asynchronously, as node's does.
const fakeChild = (event, payload) => {
  const child = Object.assign(new EventEmitter(), { unref() {} })
  setImmediate(() => child.emit(event, payload))
  return child
}
const fakeSpawn = (log) => (exe, args, opts) => { log.push({ what: 'spawn', exe, args, opts }); return fakeChild('spawn') }

test('signInOrder: Google first, then the order asked, no repeats', () => {
  assert.deepEqual(signInOrder(['reddit', 'x', 'google', 'reddit']), ['google', 'reddit', 'x'])
  assert.deepEqual(signInOrder(['linkedin']), ['linkedin'])
})

test('openSignIn: the CDP instance is closed and gone before a plain launch with the sign-in URLs in order', async () => {
  const files = { '/p/DevToolsActivePort': '9100\n/devtools/browser/pil\n' }
  const log = []
  let alive = 3 // the process outlives its DevToolsActivePort for a few polls
  const out = await openSignIn(['reddit', 'google', 'x'], {
    profile: '/p',
    exe: '/x/chrome',
    fs: memfs(files),
    fetch: identityFetch,
    spawn: fakeSpawn(log),
    sleep: async () => { log.push({ what: 'sleep' }) },
    closeBrowser: async (ws) => { log.push({ what: 'close', ws }); delete files['/p/DevToolsActivePort'] },
    isProfileRunning: (dir) => { assert.equal(dir, '/p'); return alive-- > 0 },
  })
  assert.deepEqual(log.map((l) => l.what), ['close', 'sleep', 'sleep', 'sleep', 'spawn'])
  assert.equal(log[0].ws, WS)
  const { exe, args, opts } = log.at(-1)
  assert.equal(exe, '/x/chrome')
  assert.ok(!args.some((a) => a.startsWith('--remote-debugging-port')))
  assert.deepEqual(args, ['--user-data-dir=/p', '--no-first-run', '--no-default-browser-check', 'https://accounts.google.com/', 'https://www.reddit.com/login/', 'https://x.com/i/flow/login'])
  assert.deepEqual(opts, { detached: true, stdio: 'ignore' })
  assert.deepEqual(out, {
    opened: [{ site: 'google', url: 'https://accounts.google.com/' }, { site: 'reddit', url: 'https://www.reddit.com/login/' }, { site: 'x', url: 'https://x.com/i/flow/login' }],
    mode: 'plain',
    next: 'Sign in, then quit that Chrome window with Cmd+Q. Pilcrino restarts the browser on its next call.',
  })
  assert.equal(out.next, SIGNIN_NEXT)
})

test('openSignIn: a DevToolsActivePort left behind by the close does not hold the wait', async () => {
  const files = { '/p/DevToolsActivePort': '9100\n/devtools/browser/pil\n' }
  const log = []
  let alive = 1
  await openSignIn(['google'], {
    profile: '/p', exe: '/x/chrome', fs: memfs(files), fetch: identityFetch, spawn: fakeSpawn(log),
    sleep: async () => { log.push({ what: 'sleep' }) },
    now: () => 0,
    closeBrowser: async () => { log.push({ what: 'close' }) }, // the file stays, as Chrome leaves it
    isProfileRunning: () => alive-- > 0,
  })
  assert.ok('/p/DevToolsActivePort' in files)
  assert.deepEqual(log.map((l) => l.what), ['close', 'sleep', 'spawn'])
})

test('openSignIn: nothing under CDP means no close, straight to the plain launch', async () => {
  const log = []
  await openSignIn(['linkedin'], {
    profile: '/p', exe: '/x/chrome', fs: memfs({}),
    fetch: async () => { throw new Error('unused') },
    spawn: fakeSpawn(log),
    closeBrowser: async () => { log.push({ what: 'close' }) },
    isProfileRunning: () => { throw new Error('not asked') },
  })
  assert.deepEqual(log.map((l) => l.what), ['spawn'])
  assert.deepEqual(log[0].args.slice(3), ['https://www.linkedin.com/login'])
})

test('openSignIn: a Chrome that never quits fails within the bound and launches nothing', async () => {
  const log = []
  let t = 0
  await assert.rejects(
    openSignIn(['google'], {
      profile: '/p', exe: '/x/chrome', fs: memfs({ '/p/DevToolsActivePort': '9100\n/devtools/browser/pil\n' }),
      fetch: identityFetch, spawn: fakeSpawn(log), sleep: async () => {}, now: () => (t += 1000),
      closeBrowser: async () => {}, isProfileRunning: () => true,
    }),
    (e) => e.code === 'browser_unavailable' && /did not quit within 10s/.test(e.message),
  )
  assert.equal(log.length, 0)
})

test('closeOverCdp sends Browser.close and resolves on the reply; a failing socket still resolves', async () => {
  const sent = []
  class FakeWs {
    constructor(url) { this.url = url; setTimeout(() => this.onopen(), 0) }
    send(m) { sent.push(JSON.parse(m)); setTimeout(() => this.onmessage({ data: '{"id":1,"result":{}}' }), 0) }
    close() {}
  }
  await closeOverCdp(WS, { WebSocketImpl: FakeWs })
  assert.deepEqual(sent, [{ id: 1, method: 'Browser.close' }])
  class Broken { constructor() { throw new Error('bad url') } }
  await closeOverCdp(WS, { WebSocketImpl: Broken })
  class Silent { constructor() {} send() {} close() {} }
  await closeOverCdp(WS, { WebSocketImpl: Silent, timeoutMs: 20 })
})

test('session.openSignIn passes the profile and Chrome path and never connects', async () => {
  const seen = []
  const session = createSession({ env: { PILCRINO_CHROME: '/env/chrome' }, cwd: '/nowhere' }, {
    connect: async () => { throw new Error('must not connect') },
    openSignIn: async (sites, opts) => { seen.push({ sites, opts }); return { opened: [], mode: 'plain', next: SIGNIN_NEXT } },
  })
  const out = await session.openSignIn(['google'])
  assert.equal(out.mode, 'plain')
  assert.deepEqual(seen, [{ sites: ['google'], opts: { profile: session.profile, exe: '/env/chrome' } }])
})

test('openSignIn: a Chrome that fails to spawn (ENOENT) throws chrome_not_found naming the executable', async () => {
  await assert.rejects(
    openSignIn(['google'], {
      profile: '/p', exe: '/nope/chrome', fs: memfs({}),
      fetch: async () => { throw new Error('unused') },
      spawn: () => fakeChild('error', Object.assign(new Error('spawn /nope/chrome ENOENT'), { code: 'ENOENT' })),
    }),
    (err) => err.code === 'chrome_not_found' && err.message.includes('/nope/chrome') && err.message.includes('ENOENT'),
  )
})

test('openSignIn: returns only after the child reports spawn', async () => {
  let spawned = false
  const out = await openSignIn(['google'], {
    profile: '/p', exe: '/x/chrome', fs: memfs({}),
    fetch: async () => { throw new Error('unused') },
    spawn: () => {
      const child = Object.assign(new EventEmitter(), { unref() {} })
      setImmediate(() => { spawned = true; child.emit('spawn') })
      return child
    },
  })
  assert.ok(spawned)
  assert.equal(out.mode, 'plain')
})
