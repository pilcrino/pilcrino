import { spawnSync as nodeSpawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCK_STALE_MS = 10 * 60 * 1000
const WAIT_MAX_MS = 5 * 60 * 1000

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Makes sure browser/node_modules holds the packages for this package.json
 * version. Many MCP server processes may start at once (one per Claude
 * session), so the install runs under an O_EXCL lock and every other process
 * waits for the stamp. Diagnostics go to stderr: stdout is the MCP channel.
 */
export function ensureInstalled(root, deps = {}) {
  const spawnSync = deps.spawnSync ?? nodeSpawnSync
  const sleep = deps.sleep ?? sleepSync
  const now = deps.now ?? Date.now
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  const stamp = join(root, 'node_modules', '.pilcrino-installed')
  const lock = join(root, '.install.lock')
  const stamped = () => existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === version

  if (stamped()) return { installed: false }

  const start = now()
  for (;;) {
    let fd
    try {
      fd = openSync(lock, 'wx')
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
      let age = 0
      try { age = now() - statSync(lock).mtimeMs } catch { continue }
      if (age > LOCK_STALE_MS) { rmSync(lock, { force: true }); continue }
      if (now() - start > WAIT_MAX_MS) throw new Error(`another install has held ${lock} for over 5 minutes; remove it and retry`)
      sleep(500)
      if (stamped()) return { installed: false }
      continue
    }
    try {
      writeFileSync(fd, String(process.pid))
      if (stamped()) return { installed: false }
      process.stderr.write(`pilcrino-browser: installing packages in ${root}\n`)
      // fd 1 is the MCP channel, so npm's stdout goes to our stderr.
      const r = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: root, stdio: ['ignore', 2, 2], env: { ...process.env, npm_config_loglevel: 'error' } })
      if (r.error?.code === 'ENOENT') throw new Error(`npm was not found. Install Node 22 with npm, or run: node ${join(root, 'bin.mjs')} install`)
      if (r.status !== 0) throw new Error(`npm install failed in ${root} (exit ${r.status})`)
      mkdirSync(join(root, 'node_modules'), { recursive: true })
      writeFileSync(stamp, version)
      return { installed: true }
    } finally {
      closeSync(fd)
      rmSync(lock, { force: true })
    }
  }
}
