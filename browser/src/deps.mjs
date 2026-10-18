import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from 'node:child_process'
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, win32 } from 'node:path'
import { fileURLToPath } from 'node:url'

const NPM_RUN = join(dirname(fileURLToPath(import.meta.url)), 'npm-run.mjs')

const LOCK_STALE_MS = 10 * 60 * 1000
const WAIT_MAX_MS = 5 * 60 * 1000
// After linking the lock, wait this long and read it again before installing (see tryLock).
const SETTLE_MS = 100
const NPM_ARGS = ['install', '--omit=dev', '--no-audit', '--no-fund']

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM: the process exists but belongs to another user.
    return err.code !== 'ESRCH'
  }
}

function paths(root) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  const stamp = join(root, 'node_modules', '.pilcrino-installed')
  const lock = join(root, '.install.lock')
  const stamped = () => existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === version
  return { version, stamp, lock, stamped }
}

/** True when node_modules holds the packages for this package.json version. */
export function isInstalled(root) {
  return paths(root).stamped()
}

/**
 * The lock's text, inode and mtime, or null when it cannot be read (usually:
 * it is gone). The text is the owner's PID on the first line and, once npm
 * runs, npm's PID on the second: on Windows a parent killed from outside is
 * terminated without its SIGTERM handler, so its npm keeps writing; a lock
 * that names a live npm is still held.
 */
function readLock(lock) {
  try {
    const text = readFileSync(lock, 'utf8').trim()
    const st = statSync(lock)
    const [owner, npm] = text.split('\n').map((l) => l.trim())
    return { text, owner, npm, ino: st.ino, mtimeMs: st.mtimeMs }
  } catch {
    return null
  }
}

function lockIsMine(lock) {
  return readLock(lock)?.owner === String(process.pid)
}

/**
 * Adds npm's PID to our own lock, so a stale-lock check sees the installer
 * that is still running. Written whole through a temporary file and a rename,
 * so a contender never reads an empty lock (a truncating write would show one
 * for an instant, and an empty lock reads as stale).
 */
function recordNpmPid(lock, pid) {
  if (pid && lockIsMine(lock)) {
    const tmp = `${lock}.${process.pid}.npm`
    try { writeFileSync(tmp, `${process.pid}\n${pid}`); renameSync(tmp, lock) } catch { rmSync(tmp, { force: true }) }
  }
}

/** Removes the lock only when it holds this process's PID. */
function releaseLock(lock) {
  if (lockIsMine(lock)) rmSync(lock, { force: true })
}

/**
 * One attempt at the lock. Returns 'linked' (the lock now holds our PID; the
 * caller still settles and re-reads it before installing), 'retry' (a stale
 * lock was just removed, or the lock changed under us) or 'held' (a live
 * process holds it).
 *
 * The lock is exclusive and created whole: the PID goes into a private file
 * that is then hard-linked to the lock name (the link fails with EEXIST like an
 * O_EXCL open), so no process ever reads a lock without its PID.
 *
 * Reclaiming a stale lock is the racy part. Two starts can read the same dead
 * PID; if one removes it and links a fresh lock before the other removes "the
 * stale lock", the second removes the fresh one. Two defences narrow this:
 * a lock is only removed after a second read shows the same PID text and inode
 * that were judged stale, and the caller waits SETTLE_MS after linking and
 * checks the lock still holds its PID, so a contender that removed it in that
 * window costs a lap of the loop, not a second npm. An overlap is still
 * possible in theory: a contender stalled for longer than SETTLE_MS between its
 * second read and its removal (a stopped or heavily swapped process) can remove
 * a lock whose owner has already started npm. Closing that fully needs a kernel
 * lock (flock), which Node does not expose.
 *
 * Process identity is the PID alone, with the age rule below as the fallback
 * for a reused PID. Comparing the process start time as well would need ps or
 * /proc code per platform; the bootstrap shim retries a failed install instead,
 * so a reused PID delays the install by at most the age rule, not forever.
 */
function tryLock(lock, d) {
  const mine = String(process.pid)
  const tmp = `${lock}.${process.pid}.${Math.random().toString(36).slice(2)}`
  writeFileSync(tmp, mine)
  try {
    linkSync(tmp, lock)
    return 'linked'
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  } finally {
    rmSync(tmp, { force: true })
  }
  const seen = readLock(lock)
  if (seen === null) return 'retry'
  // A lock with our own PID is ours (left by an earlier attempt in this process).
  if (seen.owner === mine) return 'linked'
  const pids = [seen.owner, seen.npm].filter((p) => /^\d+$/.test(p ?? '')).map(Number)
  const alive = pids.filter((p) => d.pidAlive(p))
  const npmAlive = /^\d+$/.test(seen.npm ?? '') && alive.includes(Number(seen.npm))
  // A lock left by a killed install (its PIDs are gone, or unreadable) is cleared at once.
  // The age rule is a second check for an owner PID reused by another process; it never
  // overrides a lock whose npm line is alive, since a slow install is still an install.
  if (alive.length === 0 || (!npmAlive && d.now() - seen.mtimeMs > LOCK_STALE_MS)) {
    const again = readLock(lock)
    if (again !== null && again.text === seen.text && again.ino === seen.ino) rmSync(lock, { force: true })
    return 'retry'
  }
  return 'held'
}

/** Removes the lock only when this process holds it (used when exiting mid-install). */
export function releaseLockIfMine(root) {
  releaseLock(join(root, '.install.lock'))
}

function npmMissing(root) {
  return new Error(`npm was not found. Install Node 22 with npm, or run: node ${join(root, 'bin.mjs')} install`)
}

/**
 * The command that runs npm: `[file, args]`. On Windows `npm` is `npm.cmd`,
 * which Node refuses to spawn without a shell, and a shell would make the
 * child `cmd.exe` rather than npm, so bin.mjs could no longer stop the real
 * installer before releasing the lock. So npm's JavaScript entry runs under
 * this very Node instead. PILCRINO_NPM_CLI names that entry explicitly (tests
 * use it for a fake npm on every platform). A missing entry file is reported
 * before any spawn: Node would otherwise start and fail with MODULE_NOT_FOUND,
 * which reads as a generic install failure.
 */
export function npmCommand(root, { platform = process.platform, env = process.env, exists = existsSync, execPath = process.execPath } = {}) {
  let cli = env.PILCRINO_NPM_CLI
  if (!cli && platform === 'win32') cli = win32.join(win32.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!cli) return ['npm', NPM_ARGS]
  if (!exists(cli)) throw npmMissing(root)
  return [execPath, [cli, ...NPM_ARGS]]
}

const npmEnv = () => ({ ...process.env, npm_config_loglevel: 'error' })

function lostLock(lock) {
  process.stderr.write(`pilcrino-browser: another installer took ${lock} during npm install; waiting for its result\n`)
}

/**
 * Makes sure browser/node_modules holds the packages for this package.json
 * version, synchronously (`node bin.mjs install` and the CLI commands). Many
 * processes may start at once (one MCP server per Claude session), so the
 * install runs under a lock and every other process waits for the stamp.
 * Diagnostics go to stderr: stdout is the MCP channel.
 */
export function ensureInstalled(root, deps = {}) {
  const spawnSync = deps.spawnSync ?? nodeSpawnSync
  const d = { sleep: deps.sleep ?? sleepSync, now: deps.now ?? Date.now, pidAlive: deps.pidAlive ?? pidAlive, settleMs: deps.settleMs ?? SETTLE_MS }
  const { version, stamp, lock, stamped } = paths(root)
  if (stamped()) return { installed: false }

  const start = d.now()
  for (;;) {
    const state = tryLock(lock, d)
    if (state === 'retry') continue
    if (state === 'held') {
      if (d.now() - start > WAIT_MAX_MS) throw new Error(`another install has held ${lock} for over 5 minutes; remove it and retry`)
      d.sleep(500)
      if (stamped()) return { installed: false }
      continue
    }
    if (d.settleMs > 0) d.sleep(d.settleMs)
    if (!lockIsMine(lock)) continue
    try {
      if (stamped()) return { installed: false }
      process.stderr.write(`pilcrino-browser: installing packages in ${root}\n`)
      // fd 1 is the MCP channel, so npm's stdout goes to our stderr.
      const [file, args] = npmCommand(root, deps)
      // npm runs under a wrapper that names itself on the lock first (see npm-run.mjs), so a
      // caller killed hard mid-install still leaves a lock that reads as held while npm writes.
      const r = spawnSync(process.execPath, [NPM_RUN, lock, String(process.pid), file, ...args], { cwd: root, stdio: ['ignore', 2, 2], env: npmEnv() })
      if (r.error?.code === 'ENOENT' || r.status === 127) throw npmMissing(root)
      if (r.status !== 0) throw new Error(`npm install failed in ${root} (exit ${r.status ?? r.signal})`)
      // A lost lock means another installer is running npm now: it writes the stamp, not us.
      if (!lockIsMine(lock)) { lostLock(lock); continue }
      mkdirSync(join(root, 'node_modules'), { recursive: true })
      writeFileSync(stamp, version)
      return { installed: true }
    } finally {
      releaseLock(lock)
    }
  }
}

/**
 * The same install without blocking the event loop, for the MCP server's first
 * start after a plugin update: the bootstrap shim keeps answering the client
 * while npm runs. `deps.onSpawn(child)` receives the npm process so the caller
 * can stop it when the client goes away mid-install.
 */
export async function installAsync(root, deps = {}) {
  const spawn = deps.spawn ?? nodeSpawn
  const d = {
    sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: deps.now ?? Date.now,
    pidAlive: deps.pidAlive ?? pidAlive,
    settleMs: deps.settleMs ?? SETTLE_MS,
  }
  const { version, stamp, lock, stamped } = paths(root)
  if (stamped()) return { installed: false }

  const start = d.now()
  for (;;) {
    const state = tryLock(lock, d)
    if (state === 'retry') continue
    if (state === 'held') {
      if (d.now() - start > WAIT_MAX_MS) throw new Error(`another install has held ${lock} for over 5 minutes; remove it and retry`)
      await d.sleep(500)
      if (stamped()) return { installed: false }
      continue
    }
    if (d.settleMs > 0) await d.sleep(d.settleMs)
    if (!lockIsMine(lock)) continue
    try {
      if (stamped()) return { installed: false }
      process.stderr.write(`pilcrino-browser: installing packages in ${root}\n`)
      const code = await new Promise((resolve, reject) => {
        // fd 1 is the MCP channel, so npm's stdout goes to our stderr.
        let file, args
        try { [file, args] = npmCommand(root, deps) } catch (err) { reject(err); return }
        const child = spawn(file, args, { cwd: root, stdio: ['ignore', 2, 2], env: npmEnv() })
        recordNpmPid(lock, child.pid)
        deps.onSpawn?.(child)
        child.on('error', (err) => reject(err.code === 'ENOENT' ? npmMissing(root) : err))
        child.on('close', (status, signal) => resolve(status ?? signal))
      })
      if (code !== 0) throw new Error(`npm install failed in ${root} (exit ${code})`)
      // A lost lock means another installer is running npm now: it writes the stamp, not us.
      if (!lockIsMine(lock)) { lostLock(lock); continue }
      mkdirSync(join(root, 'node_modules'), { recursive: true })
      writeFileSync(stamp, version)
      return { installed: true }
    } finally {
      releaseLock(lock)
    }
  }
}
