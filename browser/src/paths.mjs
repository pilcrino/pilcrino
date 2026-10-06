import * as nodeFs from 'node:fs'
import { delimiter as osDelimiter, dirname, isAbsolute, resolve, sep } from 'node:path'
import { codedError } from './chrome.mjs'

export function outRoots({ env = process.env, cwd = process.cwd(), delimiter = osDelimiter } = {}) {
  const raw = env.PILCRINO_BROWSER_OUT
  if (raw && raw.trim()) return raw.split(delimiter).map((s) => s.trim()).filter(Boolean)
  return [cwd]
}

// Realpath of the deepest existing ancestor (lstat, so a dangling symlink
// counts as an existing entry), plus the remaining segments. A symlink that
// cannot be resolved is refused through onDangling, or kept as-is when absent.
function realParent(p, fs, onDangling) {
  const rest = []
  let cur = p
  for (;;) {
    let st = null
    try { st = fs.lstatSync(cur) } catch { st = null }
    if (st) {
      let real
      try { real = fs.realpathSync(cur) } catch {
        if (onDangling) onDangling(cur)
        real = cur
      }
      return resolve(real, ...rest)
    }
    rest.unshift(cur.slice(cur.lastIndexOf(sep) + 1))
    const up = dirname(cur)
    if (up === cur) return resolve(cur, ...rest)
    cur = up
  }
}

const inside = (p, root) => p === root || p.startsWith(root.endsWith(sep) ? root : root + sep)

/**
 * The only path check in the server. Every file the server writes goes
 * through here: absolute, inside an allowed root after symlink resolution,
 * never under the Chrome profile, never through a .git segment, never
 * through a dot segment below the root.
 */
export function resolveOutFile(outFile, roots, { profile, fs = nodeFs } = {}) {
  const bad = (why) => codedError('bad_path', `outFile ${JSON.stringify(outFile)} refused: ${why}. Allowed roots: ${roots.join(', ')}`)
  if (typeof outFile !== 'string' || !isAbsolute(outFile)) throw bad('must be an absolute path')
  const real = realParent(outFile, fs, (l) => { throw bad(`${l} is a symlink that cannot be resolved`) })
  if (real.split(sep).includes('.git')) throw bad('contains a .git segment')
  const realProfile = realParent(profile, fs)
  if (inside(real, realProfile)) throw bad('is inside the Pilcrino browser profile')
  const matched = roots.filter((r) => fs.existsSync(r)).map((r) => fs.realpathSync(r)).filter((r) => inside(real, r))
  if (!matched.length) throw bad('is outside every allowed root')
  // A root may itself sit under dot directories (post worktrees live under
  // .worktrees/); only the segments below the matched root are checked.
  const dotFree = (root) => real.slice(root.length).split(sep).every((seg) => !seg.startsWith('.'))
  if (!matched.some(dotFree)) throw bad('has a segment starting with a dot below its root')
  fs.mkdirSync(dirname(real), { recursive: true })
  return real
}
