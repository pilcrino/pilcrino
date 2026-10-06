import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { findChrome, readActivePort, probeIdentity, connectChrome, readExecutableOverride, profileDir, codedError, profileProcesses, isProfileHeld, isProfileRunning } from '../src/chrome.mjs'

const notHeld = () => false

const memfs = (files) => ({
  existsSync: (p) => p in files,
  readFileSync: (p) => { if (!(p in files)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e } return files[p] },
})

test('profileDir is ~/.pilcrino/browser', () => {
  assert.equal(profileDir('/home/x'), '/home/x/.pilcrino/browser')
})

test('codedError carries code and extras', () => {
  const e = codedError('x', 'msg', { a: 1 })
  assert.equal(e.code, 'x')
  assert.equal(e.a, 1)
  assert.equal(e.message, 'msg')
})

test('findChrome: darwin default', () => {
  const exe = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  assert.equal(findChrome({ platform: 'darwin', env: {}, exists: (p) => p === exe }), exe)
})

test('findChrome: override wins', () => {
  assert.equal(findChrome({ platform: 'darwin', env: {}, exists: () => true, override: '/opt/chrome' }), '/opt/chrome')
})

test('findChrome: PILCRINO_CHROME wins over override', () => {
  assert.equal(findChrome({ platform: 'darwin', env: { PILCRINO_CHROME: '/env/chrome' }, exists: () => false, override: '/opt/chrome' }), '/env/chrome')
})

test('findChrome: not found names the searched paths', () => {
  assert.throws(() => findChrome({ platform: 'linux', env: { PATH: '/usr/bin' }, exists: () => false }), (e) => e.code === 'chrome_not_found' && e.searched.length >= 2)
})

test('readActivePort parses the two lines', () => {
  const fs = memfs({ '/p/DevToolsActivePort': '62369\n/devtools/browser/abc\n' })
  assert.deepEqual(readActivePort('/p', fs), { port: 62369, wsPath: '/devtools/browser/abc' })
  assert.equal(readActivePort('/none', fs), null)
})

test('readActivePort: a read that throws, or a malformed file, is null', async () => {
  const racing = { existsSync: () => true, readFileSync: () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e } }
  assert.equal(readActivePort('/p', racing), null)
  assert.equal(await probeIdentity('/p', { fs: racing, fetch: async () => { throw new Error('unused') } }), null)
  assert.equal(readActivePort('/p', memfs({ '/p/DevToolsActivePort': '9000\n' })), null)
  assert.equal(readActivePort('/p', memfs({ '/p/DevToolsActivePort': 'junk\nnope\n' })), null)
  assert.equal(readActivePort('/p', memfs({ '/p/DevToolsActivePort': '9000' })), null)
})

test('probeIdentity: matching ws path means running', async () => {
  const fs = memfs({ '/p/DevToolsActivePort': '9000\n/devtools/browser/abc\n' })
  const fetch = async (url, opts) => {
    assert.equal(url, 'http://127.0.0.1:9000/json/version')
    assert.ok(opts.signal)
    return { ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9000/devtools/browser/abc' }) }
  }
  assert.equal(await probeIdentity('/p', { fs, fetch }), 'ws://127.0.0.1:9000/devtools/browser/abc')
})

test('probeIdentity: foreign browser on that port is not running', async () => {
  const fs = memfs({ '/p/DevToolsActivePort': '9000\n/devtools/browser/abc\n' })
  const fetch = async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9000/devtools/browser/OTHER' }) })
  assert.equal(await probeIdentity('/p', { fs, fetch }), null)
})

test('probeIdentity: dead port is not running', async () => {
  const fs = memfs({ '/p/DevToolsActivePort': '9000\n/devtools/browser/abc\n' })
  const fetch = async () => { throw new Error('ECONNREFUSED') }
  assert.equal(await probeIdentity('/p', { fs, fetch }), null)
})

test('connectChrome: launches when not running, then connects on the identity match', async () => {
  const files = {}
  const fs = memfs(files)
  let launched = 0
  const spawn = () => { launched++; files['/p/DevToolsActivePort'] = '9001\n/devtools/browser/new\n'; return { unref() {}, on() {} } }
  const fetch = async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9001/devtools/browser/new' }) })
  const puppeteer = { connect: async ({ browserWSEndpoint }) => ({ ws: browserWSEndpoint }) }
  const r = await connectChrome({ dir: '/p', exe: '/x/chrome', fs, fetch, spawn, sleep: async () => {}, isProfileHeld: notHeld, puppeteer })
  assert.equal(launched, 1)
  assert.equal(r.wsUrl, 'ws://127.0.0.1:9001/devtools/browser/new')
})

test('connectChrome: a launcher that loses the profile lock still connects', async () => {
  const files = {}
  const fs = memfs(files)
  let probes = 0
  const fetch = async () => { probes++; if (probes === 1) throw new Error('ECONNREFUSED'); return { ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9002/devtools/browser/a' }) } }
  const spawn = () => { files['/p/DevToolsActivePort'] = '9002\n/devtools/browser/a\n'; return { unref() {}, on() {} } }
  const puppeteer = { connect: async ({ browserWSEndpoint }) => ({ ws: browserWSEndpoint }) }
  const r = await connectChrome({ dir: '/p', exe: '/x/chrome', fs, fetch, spawn, sleep: async () => {}, isProfileHeld: notHeld, puppeteer })
  assert.equal(r.wsUrl, 'ws://127.0.0.1:9002/devtools/browser/a')
})

test('connectChrome: times out with browser_unavailable', async () => {
  const fs = memfs({})
  await assert.rejects(
    connectChrome({ dir: '/p', exe: '/x/chrome', fs, fetch: async () => { throw new Error('x') }, spawn: () => ({ unref() {}, on() {} }), sleep: async () => {}, isProfileHeld: notHeld, puppeteer: {}, timeoutMs: 1000, now: (() => { let t = 0; return () => (t += 400) })() }),
    (e) => e.code === 'browser_unavailable',
  )
})

const runningFs = memfs({ '/p/DevToolsActivePort': '9003\n/devtools/browser/r\n' })
const runningFetch = async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9003/devtools/browser/r' }) })
const jumpingNow = () => { let t = 0; return () => { const v = t; t += 100000; return v } }

test('connectChrome: puppeteer.connect that never resolves rejects with browser_unavailable', async () => {
  await assert.rejects(
    connectChrome({ dir: '/p', exe: '/x/chrome', fs: runningFs, fetch: runningFetch, sleep: async () => {}, isProfileHeld: notHeld, puppeteer: { connect: () => new Promise(() => {}) }, timeoutMs: 1000, now: jumpingNow() }),
    (e) => e.code === 'browser_unavailable',
  )
})

test('connectChrome: a connect that lands after the timeout is disconnected', async () => {
  let disconnected = 0
  const puppeteer = { connect: () => new Promise((r) => setTimeout(() => r({ disconnect() { disconnected++ } }), 1300)) }
  await assert.rejects(
    connectChrome({ dir: '/p', exe: '/x/chrome', fs: runningFs, fetch: runningFetch, sleep: async () => {}, isProfileHeld: notHeld, puppeteer, timeoutMs: 1000, now: jumpingNow() }),
    (e) => e.code === 'browser_unavailable',
  )
  await new Promise((r) => setTimeout(r, 500))
  assert.equal(disconnected, 1)
})

test('connectChrome: a plain Chrome on the profile fails fast with signin_window_open and never launches', async () => {
  let launched = 0
  const asked = []
  await assert.rejects(
    connectChrome({ dir: '/p', exe: '/x/chrome', fs: memfs({}), fetch: async () => { throw new Error('ECONNREFUSED') }, spawn: () => { launched++; return { unref() {}, on() {} } }, sleep: async () => {}, isProfileHeld: (d) => { asked.push(d); return true }, puppeteer: {} }),
    (e) => e.code === 'signin_window_open' && e.message === 'The Pilcrino sign-in window is still open. Quit it with Cmd+Q, then try again.',
  )
  assert.equal(launched, 0)
  assert.deepEqual(asked, ['/p'])
})

test('connectChrome: an identity match connects without asking about the profile', async () => {
  const puppeteer = { connect: async ({ browserWSEndpoint }) => ({ ws: browserWSEndpoint }) }
  const r = await connectChrome({ dir: '/p', exe: '/x/chrome', fs: runningFs, fetch: runningFetch, sleep: async () => {}, isProfileHeld: () => { throw new Error('not asked') }, puppeteer })
  assert.equal(r.wsUrl, 'ws://127.0.0.1:9003/devtools/browser/r')
})

test('profileProcesses: main processes on exactly this profile; held means one without the port', () => {
  const ps = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/u/.pilcrino/browser --no-first-run https://accounts.google.com/',
    '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Helper --type=renderer --user-data-dir=/u/.pilcrino/browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/u/.pilcrino/browser2',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].join('\n')
  const exec = (bin, args) => { assert.equal(bin, 'ps'); assert.deepEqual(args, ['-axww', '-o', 'command=']); return ps }
  assert.equal(profileProcesses('/u/.pilcrino/browser', { exec }).length, 1)
  assert.equal(isProfileHeld('/u/.pilcrino/browser', { exec }), true)
  assert.equal(isProfileRunning('/u/.pilcrino/browser', { exec }), true)
  const cdp = () => '/x/Google Chrome --user-data-dir=/u/.pilcrino/browser --remote-debugging-port=0 --no-first-run about:blank\n'
  assert.equal(isProfileHeld('/u/.pilcrino/browser', { exec: cdp }), false)
  assert.equal(isProfileRunning('/u/.pilcrino/browser', { exec: cdp }), true)
  const broken = () => { throw new Error('ENOENT') }
  assert.equal(isProfileHeld('/u/.pilcrino/browser', { exec: broken }), false)
  assert.equal(isProfileRunning('/u/.pilcrino/browser', { exec: broken }), false)
})

test('readExecutableOverride reads browser.executable in block and inline YAML', () => {
  const fs = memfs({
    '/blog/blog-ops/config.yaml': 'blog:\n  name: x\nbrowser:\n  executable: "/opt/chrome"\n',
    '/inline/blog-ops/config.yaml': "blog: { name: x }\nbrowser: { executable: '/opt/chrome2' }\n",
    '/single/blog-ops/config.yaml': "browser:\n  executable: '/opt/chrome3'\n",
  })
  assert.equal(readExecutableOverride('/blog', fs), '/opt/chrome')
  assert.equal(readExecutableOverride('/inline', fs), '/opt/chrome2')
  assert.equal(readExecutableOverride('/single', fs), '/opt/chrome3')
  assert.equal(readExecutableOverride('/none', fs), undefined)
})

const realChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
test('real Chrome: launch, identity, reuse, two clients', { skip: !existsSync(realChrome) || process.env.CI, timeout: 90000 }, async () => {
  const puppeteer = (await import('puppeteer-core')).default
  const dir = mkdtempSync(join(tmpdir(), 'pb-profile-'))
  try {
    const a = await connectChrome({ dir, exe: realChrome, puppeteer })
    const b = await connectChrome({ dir, exe: realChrome, puppeteer })
    assert.equal(a.wsUrl, b.wsUrl)
    const port = new URL(a.wsUrl).port
    const targets = async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === 'page')
    assert.equal((await targets()).length, 0, 'launch opens no window of its own')
    const page = await a.browser.newPage()
    await page.goto('about:blank')
    await page.close()
    a.browser.disconnect()
    b.browser.disconnect()
  } finally {
    try { execSync(`pkill -f -- "--user-data-dir=${dir}"`) } catch {}
    for (let i = 0; i < 100; i++) {
      let alive = true
      try { alive = execSync(`pgrep -f -- "--user-data-dir=${dir}"`).toString().trim() !== '' } catch { alive = false }
      if (!alive) break
      await new Promise((r) => setTimeout(r, 100))
    }
    rmSync(dir, { recursive: true, force: true })
  }
})
