import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { findChrome, readActivePort, probeIdentity, connectChrome, readExecutableOverride, profileDir, codedError, profileProcesses, isProfileHeld, isProfileRunning, quitKeys, listeningPorts, discoverIdentity } from '../src/chrome.mjs'

const notHeld = () => false

// Keys are written with forward slashes; on Windows the code joins with backslashes, so lookups are normalised.
const slash = (p) => String(p).replace(/\\/g, '/')
const memfs = (files) => ({
  existsSync: (p) => slash(p) in files,
  readFileSync: (p) => { if (!(slash(p) in files)) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e } return files[slash(p)] },
})

test('profileDir is ~/.pilcrino/browser', () => {
  assert.equal(profileDir('/home/x'), join('/home/x', '.pilcrino', 'browser'))
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
    (e) => e.code === 'signin_window_open' && e.message === `The Pilcrino sign-in window is still open. Quit it with ${quitKeys()}, then try again.`,
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
    ' 3512 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/u/.pilcrino/browser --no-first-run https://accounts.google.com/',
    ' 3513 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Helper --type=renderer --user-data-dir=/u/.pilcrino/browser',
    ' 3700 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/u/.pilcrino/browser2',
    ' 3800 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].join('\n')
  const exec = (bin, args) => { assert.equal(bin, 'ps'); assert.deepEqual(args, ['-axww', '-o', 'pid=,command=']); return ps }
  const platform = 'darwin'
  assert.equal(profileProcesses('/u/.pilcrino/browser', { exec, platform }).length, 1)
  assert.equal(isProfileHeld('/u/.pilcrino/browser', { exec, platform }), true)
  assert.equal(isProfileRunning('/u/.pilcrino/browser', { exec, platform }), true)
  const cdp = () => ' 3600 /x/Google Chrome --user-data-dir=/u/.pilcrino/browser --remote-debugging-port=0 --no-first-run about:blank\n'
  assert.equal(isProfileHeld('/u/.pilcrino/browser', { exec: cdp, platform }), false)
  assert.equal(isProfileRunning('/u/.pilcrino/browser', { exec: cdp, platform }), true)
  const broken = () => { throw new Error('ENOENT') }
  assert.equal(isProfileHeld('/u/.pilcrino/browser', { exec: broken, platform }), false)
  assert.equal(isProfileRunning('/u/.pilcrino/browser', { exec: broken, platform }), false)
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

test('isChromeCommand: the resolved binary or a Chrome binary by name, never another program', async () => {
  const { isChromeCommand, commandExecutable } = await import('../src/chrome.mjs')
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  assert.equal(commandExecutable(`${mac} --user-data-dir=/p`), mac)
  assert.equal(isChromeCommand(`${mac} --user-data-dir=/p`), true)
  assert.equal(isChromeCommand('/opt/google/chrome/chrome --user-data-dir=/p'), true)
  assert.equal(isChromeCommand('/opt/custom/browser --user-data-dir=/p', '/opt/custom/browser'), true)
  assert.equal(isChromeCommand('/opt/custom/browser --user-data-dir=/p'), false)
  assert.equal(isChromeCommand('/usr/bin/python3 --user-data-dir=/p', mac), false)
  assert.equal(isChromeCommand('/x/Google Chrome Helper --user-data-dir=/p'), false)
})

test('profileProcessEntries: pid and command per main process on exactly this profile', async () => {
  const { profileProcessEntries, isPlainCommand } = await import('../src/chrome.mjs')
  const ps = [
    ' 3512 /x/Google Chrome --user-data-dir=/u/.pilcrino/browser --no-first-run https://accounts.google.com/',
    ' 3513 /x/Google Chrome Helper --type=renderer --user-data-dir=/u/.pilcrino/browser',
    ' 3600 /x/Google Chrome --user-data-dir=/u/.pilcrino/browser --remote-debugging-port=0 about:blank',
    ' 3700 /x/Google Chrome --user-data-dir=/u/.pilcrino/browser2',
    'garbage line',
  ].join('\n')
  const exec = (bin, args) => { assert.equal(bin, 'ps'); assert.deepEqual(args, ['-axww', '-o', 'pid=,command=']); return ps }
  const entries = profileProcessEntries('/u/.pilcrino/browser', { exec, platform: 'linux' })
  assert.deepEqual(entries.map((e) => e.pid), [3512, 3600])
  assert.deepEqual(entries.map((e) => isPlainCommand(e.command)), [true, false])
  assert.deepEqual(profileProcessEntries('/u/.pilcrino/browser', { exec: () => { throw new Error('no ps') }, platform: 'linux' }), [])
})

test('findChrome: linux falls back to chromium after google-chrome', () => {
  const exists = (p) => p === '/usr/bin/chromium'
  assert.equal(findChrome({ platform: 'linux', env: { PATH: '/usr/local/bin:/usr/bin' }, exists }), '/usr/bin/chromium')
  const both = (p) => p === '/usr/bin/chromium' || p === '/usr/bin/google-chrome'
  assert.equal(findChrome({ platform: 'linux', env: { PATH: '/usr/bin' }, exists: both }), '/usr/bin/google-chrome')
})

test('findChrome: win32 per-user install under LOCALAPPDATA', () => {
  const local = 'C:\\Users\\dana\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
  const exists = (p) => p === local
  assert.equal(findChrome({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\dana\\AppData\\Local' }, exists }), local)
  assert.throws(() => findChrome({ platform: 'win32', env: {}, exists }), (e) => e.code === 'chrome_not_found' && e.searched.length === 2)
})

test('splitWindowsArgs: quotes group, escaped quotes stay, backslashes are kept', async () => {
  const { splitWindowsArgs } = await import('../src/chrome.mjs')
  assert.deepEqual(splitWindowsArgs('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="C:\\Users\\Dana Reyes\\.pilcrino\\browser" --no-first-run'), [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '--user-data-dir=C:\\Users\\Dana Reyes\\.pilcrino\\browser',
    '--no-first-run',
  ])
  assert.deepEqual(splitWindowsArgs('a  "b c"  d\\"e'), ['a', 'b c', 'd"e'])
  assert.deepEqual(splitWindowsArgs(''), [])
})

test('profileProcessEntries on win32: PowerShell listing, quoted paths with spaces and non-ASCII, exact profile, no helpers', async () => {
  const { profileProcessEntries, isPlainCommand, processListCommand } = await import('../src/chrome.mjs')
  const dir = 'C:\\Users\\José Reyes\\.pilcrino\\browser'
  const lines = [
    '4001 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="C:\\Users\\José Reyes\\.pilcrino\\browser" --no-first-run https://accounts.google.com/',
    '4002 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --type=renderer --user-data-dir="C:\\Users\\José Reyes\\.pilcrino\\browser"',
    '4003 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="C:\\Users\\José Reyes\\.pilcrino\\browser2"',
    '4004 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="c:/users/josé reyes/.pilcrino/browser" --remote-debugging-port=0',
    '4005 C:\\Windows\\explorer.exe',
    '',
  ].join('\r\n')
  const exec = (bin, args, opts) => {
    assert.equal(bin, 'powershell')
    assert.deepEqual(args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command'])
    assert.match(args[3], /OutputEncoding.*UTF8/)
    assert.equal(opts.windowsHide, true)
    return lines
  }
  const entries = profileProcessEntries(dir, { exec, platform: 'win32' })
  assert.deepEqual(entries.map((e) => e.pid), [4001, 4004])
  assert.deepEqual(entries.map((e) => isPlainCommand(e.command)), [true, false])
  assert.deepEqual(processListCommand('linux'), ['ps', ['-axww', '-o', 'pid=,command=']])
})

test('isChromeCommand on win32: a quoted chrome.exe, the resolved exe case-insensitively, never python', async () => {
  const { isChromeCommand, commandExecutable } = await import('../src/chrome.mjs')
  const exe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  const line = `"${exe}" --user-data-dir="C:\\Users\\Dana Reyes\\.pilcrino\\browser"`
  assert.equal(commandExecutable(line), exe)
  assert.equal(isChromeCommand(line, undefined, 'win32'), true)
  assert.equal(isChromeCommand(line, exe.toLowerCase(), 'win32'), true)
  assert.equal(isChromeCommand('"C:\\Python\\python.exe" --user-data-dir=C:\\p', exe, 'win32'), false)
  assert.equal(isChromeCommand('"D:\\My Browser\\browser.exe" --user-data-dir=C:\\p', 'D:\\My Browser\\browser.exe', 'win32'), true)
})

test('quitKeys per platform', async () => {
  const { quitKeys } = await import('../src/chrome.mjs')
  assert.equal(quitKeys('darwin'), 'Cmd+Q')
  assert.equal(quitKeys('win32'), 'Alt+F4')
  assert.equal(quitKeys('linux'), 'Ctrl+Shift+W')
})

test('profileProcessEntries with the real process list finds a child carrying the profile flag', { timeout: 20000 }, async () => {
  const { profileProcessEntries } = await import('../src/chrome.mjs')
  const { spawn } = await import('node:child_process')
  const base = mkdtempSync(join(tmpdir(), 'pb-José-'))
  const dir = join(base, 'browser')
  const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{},20000)', '--', `--user-data-dir=${dir}`], { stdio: 'ignore' })
  try {
    await new Promise((r) => child.once('spawn', r))
    let found = []
    for (let i = 0; i < 20 && found.length === 0; i++) {
      found = profileProcessEntries(dir).filter((e) => e.pid === child.pid)
      if (found.length === 0) await new Promise((r) => setTimeout(r, 100))
    }
    assert.equal(found.length, 1, 'the child is listed under its profile')
    assert.equal(profileProcessEntries(dir + '2').length, 0)
  } finally {
    child.kill()
    rmSync(base, { recursive: true, force: true })
  }
})

test('listeningPorts: PowerShell on Windows, lsof -Fn elsewhere, ss when lsof is missing on Linux', () => {
  const win = (bin, args) => { assert.equal(bin, 'powershell'); assert.match(args.at(-1), /OwningProcess 10048 -State Listen/); return '51033\r\n51033\r\n' }
  assert.deepEqual(listeningPorts(10048, { exec: win, platform: 'win32' }), [51033])
  const lsof = (bin) => { assert.equal(bin, 'lsof'); return 'p6116\nn127.0.0.1:64826\nn[::1]:64826\n' }
  assert.deepEqual(listeningPorts(6116, { exec: lsof, platform: 'darwin' }), [64826])
  const ss = (bin) => { if (bin === 'lsof') throw new Error('ENOENT'); assert.equal(bin, 'ss'); return 'LISTEN 0 10 127.0.0.1:39901 0.0.0.0:* users:(("chrome",pid=6116,fd=45))\nLISTEN 0 10 127.0.0.1:22 0.0.0.0:* users:(("sshd",pid=900,fd=3))\n' }
  assert.deepEqual(listeningPorts(6116, { exec: ss, platform: 'linux' }), [39901])
  assert.deepEqual(listeningPorts(6116, { exec: () => { throw new Error('x') }, platform: 'darwin' }), [])
})

test('discoverIdentity: the debugging Chrome on the profile answers on its own port and the file is rewritten', async () => {
  const files = { '/p/DevToolsActivePort': '59261\n/devtools/browser/old\n' }
  const fs = { ...memfs(files), writeFileSync: (p, c) => { files[slash(p)] = c } }
  const exec = () => '7 /x/chrome --user-data-dir=/p --no-first-run https://accounts.google.com/\n8 /x/chrome --user-data-dir=/p --remote-debugging-port=0 --no-startup-window\n9 /x/chrome --type=renderer --user-data-dir=/p\n'
  const asked = []
  const ports = (pid) => { asked.push(pid); return pid === 8 ? [51033] : [1] }
  const fetch = async (url) => { if (url !== 'http://127.0.0.1:51033/json/version') throw new Error('ECONNREFUSED'); return { ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:51033/devtools/browser/new' }) } }
  const ws = await discoverIdentity('/p', { fs, fetch, exec, platform: 'linux', ports })
  assert.equal(ws, 'ws://127.0.0.1:51033/devtools/browser/new')
  assert.deepEqual(asked, [8]) // the plain sign-in Chrome and the renderer are never asked
  assert.equal(files['/p/DevToolsActivePort'], '51033\n/devtools/browser/new\n')
  assert.equal(await discoverIdentity('/p', { fs, fetch, exec: () => '', platform: 'linux', ports }), null)
})

test('connectChrome: a launched Chrome that never rewrites DevToolsActivePort is found from the process list', async () => {
  const files = { '/p/DevToolsActivePort': '59261\n/devtools/browser/old\n' } // stale from the Chrome the sign-in quit
  const fs = { ...memfs(files), writeFileSync: (p, c) => { files[slash(p)] = c } }
  const spawn = () => ({ unref() {}, on() {} }) // Chrome starts and listens on 51033 but leaves the file alone
  const fetch = async (url) => { if (url !== 'http://127.0.0.1:51033/json/version') throw new Error('ECONNREFUSED'); return { ok: true, json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:51033/devtools/browser/new' }) } }
  let discovers = 0
  const discover = async () => { discovers++; return discovers < 2 ? null : 'ws://127.0.0.1:51033/devtools/browser/new' }
  const puppeteer = { connect: async ({ browserWSEndpoint }) => ({ ws: browserWSEndpoint }) }
  let t = 0
  const now = () => { t += 500; return t }
  const r = await connectChrome({ dir: '/p', exe: '/x/chrome', fs, fetch, spawn, sleep: async () => {}, isProfileHeld: notHeld, discover, puppeteer, now, timeoutMs: 20000 })
  assert.equal(r.wsUrl, 'ws://127.0.0.1:51033/devtools/browser/new')
  assert.equal(discovers, 2)
})
