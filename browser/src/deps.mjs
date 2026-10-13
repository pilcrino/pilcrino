import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from 'node:child_process'
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCK_STALE_MS = 10 * 60 * 1000
const WAIT_MAX_MS = 5 * 60 * 1000
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
 * Takes the lock or says why not. The lock is exclusive and created whole: the
 * PID goes into a private file that is then hard-linked to the lock name (the
 * link fails with EEXIST like an O_EXCL open), so no process ever reads a lock
 * without its PID. Returns 'taken', 'retry' (a stale lock was just removed) or
 * 'held' (a live process holds it).
 */
function tryLock(lock, d) {
  const tmp = `${lock}.${process.pid}.${Math.random().toString(36).slice(2)}`
  writeFileSync(tmp, String(process.pid))
  try {
    linkSync(tmp, lock)
    return 'taken'
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  } finally {
    rmSync(tmp, { force: true })
  }
  let text, age
  try {
    text = readFileSync(lock, 'utf8').trim()
    age = d.now() - statSync(lock).mtimeMs
  } catch {
    return 'retry'
  }
  const pid = /^\d+$/.test(text) ? Number(text) : 0
  // A lock left by a killed install (its PID is gone, or unreadable) is cleared at once.
  // The age rule stays as a second check, for a PID that was reused by another process.
  if (pid <= 0 || !d.pidAlive(pid) || age > LOCK_STALE_MS) {
    rmSync(lock, { force: true })
    return 'retry'
  }
  return 'held'
}

/** Removes the lock only when this process holds it (used when exiting mid-install). */
export function releaseLockIfMine(root) {
  const lock = join(root, '.install.lock')
  try {
    if (readFileSync(lock, 'utf8').trim() === String(process.pid)) rmSync(lock, { force: true })
  } catch {}
}

function npmMissing(root) {
  return new Error(`npm was not found. Install Node 22 with npm, or run: node ${join(root, 'bin.mjs')} install`)
}

const npmEnv = () => ({ ...process.env, npm_config_loglevel: 'error' })

/**
 * Makes sure browser/node_modules holds the packages for this package.json
 * version, synchronously (`node bin.mjs install` and the CLI commands). Many
 * processes may start at once (one MCP server per Claude session), so the
 * install runs under a lock and every other process waits for the stamp.
 * Diagnostics go to stderr: stdout is the MCP channel.
 */
export function ensureInstalled(root, deps = {}) {
  const spawnSync = deps.spawnSync ?? nodeSpawnSync
  const d = { sleep: deps.sleep ?? sleepSync, now: deps.now ?? Date.now, pidAlive: deps.pidAlive ?? pidAlive }
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
    try {
      if (stamped()) return { installed: false }
      process.stderr.write(`pilcrino-browser: installing packages in ${root}\n`)
      // fd 1 is the MCP channel, so npm's stdout goes to our stderr.
      const r = spawnSync('npm', NPM_ARGS, { cwd: root, stdio: ['ignore', 2, 2], env: npmEnv() })
      if (r.error?.code === 'ENOENT') throw npmMissing(root)
      if (r.status !== 0) throw new Error(`npm install failed in ${root} (exit ${r.status})`)
      mkdirSync(join(root, 'node_modules'), { recursive: true })
      writeFileSync(stamp, version)
      return { installed: true }
    } finally {
      rmSync(lock, { force: true })
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
  const d = { sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))), now: deps.now ?? Date.now, pidAlive: deps.pidAlive ?? pidAlive }
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
    try {
      if (stamped()) return { installed: false }
      process.stderr.write(`pilcrino-browser: installing packages in ${root}\n`)
      const code = await new Promise((resolve, reject) => {
        // fd 1 is the MCP channel, so npm's stdout goes to our stderr.
        const child = spawn('npm', NPM_ARGS, { cwd: root, stdio: ['ignore', 2, 2], env: npmEnv() })
        deps.onSpawn?.(child)
        child.on('error', (err) => reject(err.code === 'ENOENT' ? npmMissing(root) : err))
        child.on('close', (status, signal) => resolve(status ?? signal))
      })
      if (code !== 0) throw new Error(`npm install failed in ${root} (exit ${code})`)
      mkdirSync(join(root, 'node_modules'), { recursive: true })
      writeFileSync(stamp, version)
      return { installed: true }
    } finally {
      rmSync(lock, { force: true })
    }
  }
}
