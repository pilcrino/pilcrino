// Runs npm for the synchronous installer (`node bin.mjs install`, the CLI
// commands, the publish scripts), after naming itself on the install lock.
//
//   node npm-run.mjs <lock file> <owner pid> <file> <args...>
//
// The lock's first line is the installer that holds it; this wrapper adds its
// own PID as the second line before npm starts writing. If the installer is
// killed hard while npm runs (on Windows a kill runs no handler, and npm is
// left behind), the lock still names a live process, so no other installer
// reclaims it and runs a second npm over the same tree. The PID is appended as
// a second line, so the owner line is never touched and no rename is needed
// (Windows refuses one while another process reads the file). When the lock
// is gone or already belongs to another
// installer (the parent died before this wrapper ran and a successor took
// over), npm is NOT started: exit 75 tells the caller the lock was lost.
import { spawnSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'

export const LOCK_LOST = 75

const [lock, owner, file, ...args] = process.argv.slice(2)
let registered = false
try {
  if (readFileSync(lock, 'utf8').trim() === owner) {
    appendFileSync(lock, `\n${process.pid}`)
    registered = readFileSync(lock, 'utf8') === `${owner}\n${process.pid}`
  }
} catch {}
if (!registered) {
  process.stderr.write(`pilcrino-browser: the install lock ${lock} is no longer held by ${owner}; npm not started\n`)
  process.exit(LOCK_LOST)
}
const r = spawnSync(file, args, { stdio: 'inherit' })
if (r.error) {
  process.stderr.write(`${r.error.message}\n`)
  process.exit(r.error.code === 'ENOENT' ? 127 : 1)
}
process.exit(r.status ?? 1)
