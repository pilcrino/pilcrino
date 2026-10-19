import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import assert from 'node:assert/strict'
import { closeOverCdp, openSignIn, signInOrder, SIGNIN_NEXT, quitBrowser, QUIT_DONE, QUIT_NOT_RUNNING } from '../src/signin.mjs'
import { quitKeys } from '../src/chrome.mjs'
import { createSession } from '../src/session.mjs'

// Nothing here launches or drives a real Chrome: fs, fetch, spawn, the CDP
// close and the process check are all injected.
// Keys are written with forward slashes; on Windows the code joins with backslashes, so lookups are normalised.
const slash = (p) => String(p).replace(/\\/g, '/')
const memfs = (files) => ({
  existsSync: (p) => slash(p) in files,
  readFileSync: (p) => { if (!(slash(p) in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); return files[slash(p)] },
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
    next: `Sign in, then say you are done and Pilcrino closes that window; or quit it with ${quitKeys()}. Pilcrino restarts the browser on its next call.`,
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

// close_login: the process list is faked the way the signin_window_open check
// reads it; `kill` records the signals and may drop the process from the list
// after a few polls, as a graceful Chrome quit does.
import { closeSignIn, CLOSE_LOGIN_CLOSED, CLOSE_LOGIN_NONE } from '../src/signin.mjs'

const PLAIN = { pid: 3512, command: '/x/Google Chrome --user-data-dir=/p --no-first-run https://accounts.google.com/' }
const CDP = { pid: 3600, command: '/x/Google Chrome --user-data-dir=/p --remote-debugging-port=0 --no-first-run about:blank' }

test('closeSignIn: the sign-in Chrome gets SIGTERM, the wait ends when it is gone, closed is true', async () => {
  let listed = 0
  let alive = 3 // the process outlives the signal for a few polls, as a real quit does
  const sent = []
  const out = await closeSignIn({
    profile: '/p',
    processes: (dir) => { assert.equal(dir, '/p'); listed++; return alive-- > 0 ? [PLAIN] : [] },
    kill: (pid, sig) => { sent.push([pid, sig]) },
    sleep: async () => {},
    now: () => 0,
  })
  assert.deepEqual(sent, [[3512, 'SIGTERM']])
  assert.equal(listed, 4)
  assert.deepEqual(out, { closed: true, detail: CLOSE_LOGIN_CLOSED })
})

test('closeSignIn: a Chrome with the remote-control port or on another profile is never signalled', async () => {
  const sent = []
  const out = await closeSignIn({
    profile: '/p',
    processes: () => [CDP],
    kill: (pid, sig) => { sent.push([pid, sig]) },
    sleep: async () => {},
  })
  assert.deepEqual(sent, [])
  assert.deepEqual(out, { closed: false, detail: CLOSE_LOGIN_NONE })
})

test('closeSignIn: no window open is closed false with a plain detail, not an error', async () => {
  const out = await closeSignIn({ profile: '/p', processes: () => [], kill: () => { throw new Error('not asked') } })
  assert.deepEqual(out, { closed: false, detail: 'No Pilcrino sign-in window is open.' })
})

test('closeSignIn: a Chrome that ignores SIGTERM is never killed; after 10 s the detail says to use Cmd+Q', async () => {
  const sent = []
  let t = 0
  const out = await closeSignIn({
    profile: '/p',
    processes: () => [PLAIN, CDP],
    kill: (pid, sig) => { sent.push([pid, sig]) },
    sleep: async () => {},
    now: () => (t += 1000),
  })
  assert.deepEqual(sent, [[3512, 'SIGTERM']])
  assert.equal(out.closed, false)
  assert.match(out.detail, /did not quit within 10 seconds/)
  assert.ok(out.detail.includes(quitKeys()), out.detail)
})

test('closeSignIn: a process that quit between the listing and the signal (ESRCH) is not an error', async () => {
  let polls = 0
  const out = await closeSignIn({
    profile: '/p',
    processes: () => (polls++ === 0 ? [PLAIN] : []),
    kill: () => { throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' }) },
    sleep: async () => {},
  })
  assert.equal(out.closed, true)
})

test('closeSignIn: a non-Chrome process carrying the profile argument is never signalled and is named in detail', async () => {
  const sent = []
  const impostor = { pid: 4100, command: '/usr/local/bin/backup-tool --user-data-dir=/p --watch' }
  const out = await closeSignIn({
    profile: '/p',
    exe: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    processes: () => [impostor],
    kill: (pid, sig) => { sent.push([pid, sig]) },
    sleep: async () => {},
  })
  assert.deepEqual(sent, [])
  assert.equal(out.closed, false)
  assert.ok(out.detail.startsWith(CLOSE_LOGIN_NONE))
  assert.match(out.detail, /not Chrome: pid 4100 \(\/usr\/local\/bin\/backup-tool\)/)
})

test('closeSignIn: the resolved Chrome binary is signalled under any name; a non-Chrome beside it is left and named', async () => {
  const sent = []
  const custom = { pid: 3520, command: '/opt/My Chrome/chrome-bin --user-data-dir=/p --no-first-run' }
  const impostor = { pid: 4100, command: '/usr/bin/python3 --user-data-dir=/p' }
  let polls = 0
  const out = await closeSignIn({
    profile: '/p',
    exe: '/opt/My Chrome/chrome-bin',
    processes: () => (polls++ === 0 ? [custom, impostor] : [impostor]),
    kill: (pid, sig) => { sent.push([pid, sig]) },
    sleep: async () => {},
  })
  assert.deepEqual(sent, [[3520, 'SIGTERM']])
  assert.equal(out.closed, true)
  assert.match(out.detail, /pid 4100 \(\/usr\/bin\/python3\)/)
})

test('session.closeSignIn passes the profile and the resolved Chrome, and never connects', async () => {
  const seen = []
  const session = createSession({ env: { PILCRINO_CHROME: '/env/chrome' }, cwd: '/nowhere' }, {
    connect: async () => { throw new Error('must not connect') },
    closeSignIn: async (opts) => { seen.push(opts); return { closed: true, detail: CLOSE_LOGIN_CLOSED } },
  })
  const out = await session.closeSignIn()
  assert.equal(out.closed, true)
  assert.deepEqual(seen, [{ profile: session.profile, exe: '/env/chrome' }])
})

test('closeSignIn on win32: taskkill without /F per Chrome pid, never process.kill', async () => {
  const { closeSignIn, platformQuit } = await import('../src/signin.mjs')
  const calls = []
  const quit = platformQuit('win32', { kill: () => { throw new Error('process.kill must not be used on Windows') }, exec: (bin, args) => { calls.push([bin, ...args]) } })
  const chrome = { pid: 4001, command: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="C:\\Users\\Dana Reyes\\.pilcrino\\browser"' }
  let polls = 0
  const out = await closeSignIn({
    profile: 'C:\\Users\\Dana Reyes\\.pilcrino\\browser',
    exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    platform: 'win32',
    quit,
    processes: () => (polls++ === 0 ? [chrome] : []),
    sleep: async () => {},
  })
  assert.deepEqual(calls, [['taskkill', '/PID', '4001']])
  assert.equal(out.closed, true)
})

test('platformQuit off Windows sends SIGTERM', async () => {
  const { platformQuit } = await import('../src/signin.mjs')
  const sent = []
  platformQuit('linux', { kill: (pid, sig) => sent.push([pid, sig]), exec: () => { throw new Error('no taskkill here') } })(7)
  assert.deepEqual(sent, [[7, 'SIGTERM']])
})

test('quitBrowser: closes the Pilcrino Chrome over CDP and waits until nothing holds the profile', async () => {
  const fs = { existsSync: () => true, readFileSync: () => '9100\n/devtools/browser/q\n' }
  const fetch = async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9100/devtools/browser/q' }) })
  const closed = []
  let polls = 0
  const r = await quitBrowser({ profile: '/p', fs, fetch, closeBrowser: async (ws) => { closed.push(ws) }, isProfileRunning: () => ++polls < 3, sleep: async () => {} })
  assert.deepEqual(closed, ['ws://127.0.0.1:9100/devtools/browser/q'])
  assert.deepEqual(r, { quit: true, detail: QUIT_DONE })
})

test('quitBrowser: a Chrome found only from the process list is quit too; nothing running is quit true; a plain window is reported', async () => {
  const fs = { existsSync: () => false, readFileSync: () => { throw new Error('ENOENT') } }
  const fetch = async () => { throw new Error('ECONNREFUSED') }
  const closed = []
  let running = true
  const r = await quitBrowser({ profile: '/p', fs, fetch, discover: async () => 'ws://127.0.0.1:9200/devtools/browser/d', closeBrowser: async (ws) => { closed.push(ws); running = false }, isProfileRunning: () => running, sleep: async () => {} })
  assert.deepEqual(closed, ['ws://127.0.0.1:9200/devtools/browser/d'])
  assert.equal(r.quit, true)
  assert.deepEqual(await quitBrowser({ profile: '/p', fs, fetch, discover: async () => null, isProfileRunning: () => false }), { quit: true, detail: QUIT_NOT_RUNNING })
  const plain = await quitBrowser({ profile: '/p', fs, fetch, discover: async () => null, isProfileRunning: () => true })
  assert.equal(plain.quit, false)
  assert.match(plain.detail, /sign-in window/)
})

test('quitBrowser: a Chrome that never quits is reported within the bound', async () => {
  const fs = { existsSync: () => true, readFileSync: () => '9100\n/devtools/browser/q\n' }
  const fetch = async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9100/devtools/browser/q' }) })
  let t = 0
  const r = await quitBrowser({ profile: '/p', fs, fetch, closeBrowser: async () => {}, isProfileRunning: () => true, sleep: async () => {}, now: () => (t += 4000) })
  assert.equal(r.quit, false)
  assert.match(r.detail, /did not quit within 10 seconds/)
})
