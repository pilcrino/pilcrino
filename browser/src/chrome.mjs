import * as nodeFs from 'node:fs'
import { execFileSync, spawn as nodeSpawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join, posix, win32 } from 'node:path'
import { parse as parseYaml } from 'yaml'

export function profileDir(home = homedir()) {
  return join(home, '.pilcrino', 'browser')
}

export function codedError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra })
}

/**
 * Where Chrome is looked for, per platform. Linux prefers Google Chrome over
 * Chromium: Ubuntu's `chromium` is a snap, and snaps cannot read dot-folders
 * under $HOME, so the Pilcrino profile is invisible to it. Windows adds the
 * per-user install under %LOCALAPPDATA%.
 */
function defaultCandidates(platform, env) {
  switch (platform) {
    case 'darwin':
      return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    case 'win32':
      return [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ...(env.LOCALAPPDATA ? [win32.join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')] : []),
      ]
    default:
      return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  }
}

export function findChrome({ platform = process.platform, env = process.env, exists = nodeFs.existsSync, override } = {}) {
  // PILCRINO_CHROME is how the console passes browser.executable: console
  // workers run from the console package, not the blog, so a cwd scan would miss it.
  if (env.PILCRINO_CHROME) return env.PILCRINO_CHROME
  if (override) return override
  const searched = []
  for (const candidate of defaultCandidates(platform, env)) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      searched.push(candidate)
      if (exists(candidate)) return candidate
    } else {
      for (const dir of (env.PATH ?? '').split(platform === 'win32' ? ';' : ':').filter(Boolean)) {
        const p = (platform === 'win32' ? win32 : posix).join(dir, candidate)
        searched.push(p)
        if (exists(p)) return p
      }
    }
  }
  throw codedError('chrome_not_found', `Google Chrome was not found. Searched: ${searched.join(', ')}. Set browser.executable in blog-ops/config.yaml if it lives elsewhere.`, { searched })
}

/**
 * `browser.executable` from the blog's config.yaml, for interactive sessions
 * whose cwd is the blog. Parsed with the `yaml` package (same contract as the
 * console's config.ts), so block and inline forms both work. The console does
 * not rely on this: it passes PILCRINO_CHROME.
 */
export function readExecutableOverride(cwd, fs = nodeFs, parse = parseYaml) {
  const p = join(cwd, 'blog-ops', 'config.yaml')
  if (!fs.existsSync(p)) return undefined
  try {
    const doc = parse(fs.readFileSync(p, 'utf8'))
    const exe = doc?.browser?.executable
    return typeof exe === 'string' && exe.trim() ? exe.trim() : undefined
  } catch {
    return undefined
  }
}

export function readActivePort(dir, fs = nodeFs) {
  // Chrome deletes this file at shutdown, so a missing, unreadable or
  // malformed file all mean "not running", never an error.
  try {
    const p = join(dir, 'DevToolsActivePort')
    if (!fs.existsSync(p)) return null
    const [portLine, wsPath] = fs.readFileSync(p, 'utf8').split('\n')
    const port = Number(portLine)
    if (!Number.isInteger(port) || port <= 0 || !wsPath?.startsWith('/devtools/browser/')) return null
    return { port, wsPath: wsPath.trim() }
  } catch {
    return null
  }
}

/** The WebSocket URL of the Pilcrino profile's Chrome, or null when it is not running. */
export async function probeIdentity(dir, { fs = nodeFs, fetch = globalThis.fetch } = {}) {
  const active = readActivePort(dir, fs)
  if (!active) return null
  try {
    const res = await fetch(`http://127.0.0.1:${active.port}/json/version`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const body = await res.json()
    const ws = body.webSocketDebuggerUrl
    if (typeof ws !== 'string') return null
    if (new URL(ws).pathname !== active.wsPath) return null
    return ws
  } catch {
    return null
  }
}

/**
 * The TCP ports a process listens on: Get-NetTCPConnection on Windows, lsof
 * elsewhere, `ss` on a Linux without lsof. Unknown or failed means none.
 */
export function listeningPorts(pid, { exec = execFileSync, platform = process.platform } = {}) {
  const run = (bin, args) => String(exec(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }))
  const ports = (list) => [...new Set(list.filter((n) => Number.isInteger(n) && n > 0))]
  try {
    if (platform === 'win32') {
      const out = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Get-NetTCPConnection -OwningProcess ${Number(pid)} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.LocalPort }`])
      return ports(out.split(/\s+/).filter((t) => /^\d+$/.test(t)).map(Number))
    }
    try {
      // -Fn prints one `n<address>` line per socket, e.g. `n127.0.0.1:51033`.
      const out = run('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN', '-Fn'])
      return ports(out.split('\n').filter((l) => l.startsWith('n')).map((l) => Number(l.slice(l.lastIndexOf(':') + 1))))
    } catch {
      if (platform !== 'linux') return []
      // ss -ltnpH: `LISTEN 0 10 127.0.0.1:51033 0.0.0.0:* users:(("chrome",pid=6116,fd=45))`
      const out = run('ss', ['-ltnpH'])
      return ports(out.split('\n').filter((l) => l.includes(`pid=${Number(pid)},`)).map((l) => { const local = l.trim().split(/\s+/)[3] ?? ''; return Number(local.slice(local.lastIndexOf(':') + 1)) }))
    }
  } catch {
    return []
  }
}

/**
 * Finds the Pilcrino Chrome without DevToolsActivePort: the process list
 * names the main process launched with the debugging port, the OS gives
 * the ports it listens on, and `/json/version` on each of them answers with
 * the WebSocket URL. Chrome on Windows was seen (19 Oct 2026, after a
 * sign-in window closed) listening for 47 s without rewriting the file, so
 * the file is rewritten here from the answer for the sessions that follow.
 * Null when no such Chrome answers.
 */
export async function discoverIdentity(dir, { fs = nodeFs, fetch = globalThis.fetch, exec = execFileSync, platform = process.platform, ports = listeningPorts } = {}) {
  const entries = profileProcessEntries(dir, { exec, platform }).filter((e) => !isPlainCommand(e.command))
  for (const { pid } of entries) {
    for (const port of ports(pid, { exec, platform })) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) })
        if (!res.ok) continue
        const ws = (await res.json()).webSocketDebuggerUrl
        if (typeof ws !== 'string') continue
        try { fs.writeFileSync(join(dir, 'DevToolsActivePort'), `${port}\n${new URL(ws).pathname}\n`) } catch {}
        return ws
      } catch {}
    }
  }
  return null
}

export function launchChrome(exe, dir, { spawn = nodeSpawn } = {}) {
  const child = spawn(exe, [`--user-data-dir=${dir}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--no-startup-window'], { detached: true, stdio: 'ignore' })
  child.on?.('error', () => {})
  child.unref?.()
}

export const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Splits a Windows command line the way CreateProcess does for the common
 * cases: whitespace separates arguments, double quotes group them, `\"` is a
 * literal quote, and backslashes elsewhere are kept as they are (paths).
 */
export function splitWindowsArgs(line) {
  const args = []
  let cur = ''
  let inQuotes = false
  let seen = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '\\' && line[i + 1] === '"') { cur += '"'; seen = true; i++; continue }
    if (c === '"') { inQuotes = !inQuotes; seen = true; continue }
    if (!inQuotes && /\s/.test(c)) {
      if (seen) { args.push(cur); cur = ''; seen = false }
      continue
    }
    cur += c
    seen = true
  }
  if (seen) args.push(cur)
  return args
}

// PowerShell's own output encoding is the console code page unless set, which
// would garble a profile under a user name like José; the prefix forces UTF-8.
const WIN_PROCESS_LIST = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-CimInstance Win32_Process | % { '{0} {1}' -f $_.ProcessId, $_.CommandLine }"

/** The platform's process-list command and arguments. */
export function processListCommand(platform = process.platform) {
  return platform === 'win32'
    ? ['powershell', ['-NoProfile', '-NonInteractive', '-Command', WIN_PROCESS_LIST]]
    : ['ps', ['-axww', '-o', 'pid=,command=']]
}

/**
 * Whether a command line names this profile: a `--user-data-dir=` argument
 * whose value is exactly `dir` (so `.../browser2` never matches
 * `.../browser`), and no `--type=` (a helper, not a main process). On
 * Windows the line is split into arguments first, since the executable and
 * the profile path are quoted when they carry spaces, and the comparison is
 * case-insensitive after normalising separators.
 */
export function commandOnProfile(command, dir, platform = process.platform) {
  if (platform === 'win32') {
    const args = splitWindowsArgs(command)
    if (args.some((a) => a.startsWith('--type='))) return false
    const want = win32.normalize(dir).toLowerCase()
    return args.some((a) => a.startsWith('--user-data-dir=') && win32.normalize(a.slice('--user-data-dir='.length)).toLowerCase() === want)
  }
  const flag = `--user-data-dir=${dir}`
  const at = command.indexOf(flag)
  if (at < 0) return false
  const next = command[at + flag.length]
  return (next === undefined || next === ' ') && !/ --type=/.test(command)
}

/**
 * Chrome's main processes on this profile as `{ pid, command }` (helpers carry
 * `--type=` and are left out). Read through `ps`, or PowerShell on Windows,
 * so a missing tool or any other failure reads as nothing running.
 */
export function profileProcessEntries(dir, { exec = execFileSync, platform = process.platform } = {}) {
  let out
  try {
    const [bin, args] = processListCommand(platform)
    out = String(exec(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }))
  } catch {
    return []
  }
  const entries = []
  for (const raw of out.split('\n')) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(raw.replace(/\r$/, ''))
    if (!m) continue
    const command = m[2]
    if (commandOnProfile(command, dir, platform)) entries.push({ pid: Number(m[1]), command })
  }
  return entries
}

/** The command lines of Chrome's main processes on this profile. */
export function profileProcesses(dir, opts) {
  return profileProcessEntries(dir, opts).map((e) => e.command)
}

/**
 * The executable a `ps` command line starts with: everything before the first
 * ` --`, since a macOS Chrome path carries spaces ("Google Chrome.app").
 */
export function commandExecutable(command) {
  const trimmed = command.trim()
  if (trimmed.startsWith('"')) {
    // A quoted Windows executable: everything up to the closing quote.
    const end = trimmed.indexOf('"', 1)
    if (end > 0) return trimmed.slice(1, end)
  }
  const at = trimmed.indexOf(' --')
  return (at < 0 ? trimmed : trimmed.slice(0, at)).trim()
}

const sameExecutable = (a, b, platform) => (platform === 'win32' ? win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase() : a === b)

/**
 * Whether a command line runs Chrome: its executable is the Chrome binary this
 * session resolved (`exe`), or a Chrome binary by name: macOS's
 * `.../Google Chrome`, Linux's `.../chrome` (what the `google-chrome`
 * wrapper execs) and Windows's `chrome.exe`. Any other program that happens
 * to carry the profile argument is not Chrome and is never signalled.
 */
export function isChromeCommand(command, exe, platform = process.platform) {
  const bin = commandExecutable(command)
  if (exe && sameExecutable(bin, exe, platform)) return true
  if (bin.endsWith('/Google Chrome') || bin.endsWith('/chrome')) return true
  return (platform === 'win32' ? win32 : posix).basename(bin).toLowerCase() === 'chrome.exe'
}

/** A command line without the remote-control port names the sign-in window. */
export const isPlainCommand = (command) => !command.includes('--remote-debugging-port')

/** Any Chrome still runs on the profile, with or without the debugging port. */
export function isProfileRunning(dir, opts) {
  return profileProcesses(dir, opts).length > 0
}

/**
 * A Chrome without the debugging port holds the profile: the sign-in window
 * `open_login` started. A Chrome launched with the port is left out, so a
 * session that is still waiting for another session's launch to answer is
 * never mistaken for it.
 */
export function isProfileHeld(dir, opts) {
  return profileProcesses(dir, opts).some(isPlainCommand)
}

/**
 * How the owner quits the sign-in Chrome by hand on this platform. On Windows
 * and Linux, Chrome exits when its last window closes (the sign-in Chrome has
 * only that window), and Linux Chrome has no quit shortcut of its own.
 */
export function quitKeys(platform = process.platform) {
  if (platform === 'darwin') return 'Cmd+Q'
  if (platform === 'win32') return 'Alt+F4'
  return 'Ctrl+Shift+W'
}

export const SIGNIN_WINDOW_OPEN = `The Pilcrino sign-in window is still open. Quit it with ${quitKeys()}, then try again.`

/**
 * Connects to the profile's Chrome, launching it when nothing answers. A
 * Chrome on the profile without the debugging port (the sign-in window) fails
 * fast with `signin_window_open`: a launch would only hand its arguments to
 * that window and never answer. After
 * a launch the success conditions are the identity match on
 * DevToolsActivePort or, failing that, a debugging Chrome on the profile
 * found from the process list (`discoverIdentity`): a launcher that loses
 * Chrome's profile lock exits without writing anything, and this process
 * still finds the Chrome the other session started.
 */
export async function connectChrome({ dir, exe, fs = nodeFs, fetch = globalThis.fetch, spawn = nodeSpawn, sleep = sleepMs, isProfileHeld: held = isProfileHeld, discover = discoverIdentity, puppeteer, timeoutMs = 20000, now = Date.now }) {
  const start = now()
  const left = () => timeoutMs - (now() - start)
  const unavailable = () => codedError('browser_unavailable', `The Pilcrino browser did not start within ${timeoutMs / 1000}s (profile ${dir}, executable ${exe}).`)
  let wsUrl = await probeIdentity(dir, { fs, fetch })
  if (!wsUrl) {
    if (held(dir)) throw codedError('signin_window_open', SIGNIN_WINDOW_OPEN)
    fs.mkdirSync?.(dir, { recursive: true })
    launchChrome(exe, dir, { spawn })
    const launched = now()
    let lastDiscover = launched
    while (!wsUrl) {
      if (left() <= 0) throw unavailable()
      await sleep(250)
      wsUrl = await probeIdentity(dir, { fs, fetch })
      // The file is the fast path; a Chrome that listens without having
      // written it (seen on Windows) is found from the process list, at most
      // once a second from two seconds after the launch.
      if (!wsUrl && now() - launched >= 2000 && now() - lastDiscover >= 1000) {
        lastDiscover = now()
        wsUrl = await discover(dir, { fs, fetch })
      }
    }
  }
  // The whole connection shares one deadline: the connect itself is bounded by
  // what is left of it, and a connect that lands after the timeout is closed
  // so no untracked connection lingers.
  const attempt = puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null })
  let timer
  const browser = await Promise.race([
    attempt,
    new Promise((_, reject) => { timer = setTimeout(() => { attempt.then((b) => b.disconnect?.()).catch(() => {}); reject(unavailable()) }, Math.max(left(), 1000)) }),
  ]).finally(() => clearTimeout(timer))
  return { browser, wsUrl }
}
