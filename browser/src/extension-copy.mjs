import * as nodeFs from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Keeps ~/.pilcrino/extension, the folder the owner loaded unpacked, equal to
 * the plugin's extension/ folder. Two writers may run (the owner's Claude Code
 * plugin and the app's pinned copy, at different plugin versions), so the
 * decision and the swap happen under a lock and the newest build always wins:
 * a copy is replaced only by a newer protocol, or by a newer plugin version at
 * the same protocol. The installed folder is moved aside before the new one is
 * renamed in (a rename cannot replace a non-empty folder) and restored if that
 * rename fails, so a complete copy is always on disk.
 */
export const STAMP_FILE = 'pilcrino-stamp.json'
export const defaultExtensionDir = (home = homedir()) => join(home, '.pilcrino', 'extension')

const semverParts = (v) => String(v ?? '0').split('.').map((p) => parseInt(p, 10) || 0)
function compareSemver(a, b) {
  const [x, y] = [semverParts(a), semverParts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

/** How the installed copy's stamp compares with mine: 'newer', 'same' or 'older'. A missing or unreadable stamp is 'older'. */
export function compareBuilds(copyStamp, mine) {
  if (!copyStamp || !Number.isInteger(copyStamp.protocol)) return 'older'
  if (copyStamp.protocol !== mine.protocol) return copyStamp.protocol > mine.protocol ? 'newer' : 'older'
  const c = compareSemver(copyStamp.plugin, mine.plugin)
  return c === 0 ? 'same' : c > 0 ? 'newer' : 'older'
}

export function readStamp(dest, fs = nodeFs) {
  try { return JSON.parse(fs.readFileSync(join(dest, STAMP_FILE), 'utf8')) } catch { return null }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function takeLock(lock, { fs, now, lockWaitMs, lockStaleMs }) {
  const start = now()
  for (;;) {
    try { fs.mkdirSync(lock); return true } catch (err) { if (err?.code !== 'EEXIST') throw err }
    try {
      const age = now() - fs.statSync(lock).mtimeMs
      if (age > lockStaleMs) { fs.rmSync(lock, { recursive: true, force: true }); continue }
    } catch {}
    if (now() - start >= lockWaitMs) return false
    await sleep(100)
  }
}

export async function refreshExtensionCopy({ src, dest = defaultExtensionDir(), protocol, pluginVersion, fs = nodeFs, now = Date.now, lockWaitMs = 5000, lockStaleMs = 60000 }) {
  const mine = { protocol, plugin: pluginVersion }
  const lock = `${dest}.lock`
  const fresh = `${dest}.new`
  const old = `${dest}.old`
  fs.mkdirSync(join(dest, '..'), { recursive: true })
  if (!(await takeLock(lock, { fs, now, lockWaitMs, lockStaleMs }))) return { action: 'skipped_locked', stamp: readStamp(dest, fs) }
  try {
    for (const leftover of [fresh, old]) fs.rmSync(leftover, { recursive: true, force: true })
    const current = readStamp(dest, fs)
    const installed = fs.existsSync(dest)
    if (installed && compareBuilds(current, mine) !== 'older') return { action: 'kept', stamp: current }
    fs.cpSync(src, fresh, { recursive: true })
    fs.writeFileSync(join(fresh, STAMP_FILE), JSON.stringify(mine, null, 2) + '\n')
    if (installed) fs.renameSync(dest, old)
    try {
      fs.renameSync(fresh, dest)
    } catch (err) {
      if (installed) { try { fs.renameSync(old, dest) } catch {} }
      throw err
    }
    fs.rmSync(old, { recursive: true, force: true })
    return { action: installed ? 'updated' : 'installed', stamp: mine }
  } finally {
    fs.rmSync(lock, { recursive: true, force: true })
  }
}
