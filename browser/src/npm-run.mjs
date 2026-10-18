// Runs npm for the synchronous installer (`node bin.mjs install`, the CLI
// commands, the clipboard script), after naming itself on the install lock.
//
//   node npm-run.mjs <lock file> <owner pid> <file> <args...>
//
// The lock's first line is the installer that holds it; this wrapper adds its
// own PID as the second line before npm starts writing. If the installer is
// killed hard while npm runs (on Windows a kill runs no handler, and npm is
// left behind), the lock still names a live process, so no other installer
// reclaims it and runs a second npm over the same tree. The record is written
// whole through a temporary file and a rename: a lock is never empty, not even
// for an instant.
import { spawnSync } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

const [lock, owner, file, ...args] = process.argv.slice(2)
try {
  const current = readFileSync(lock, 'utf8').split('\n')[0].trim()
  if (current === owner) {
    const tmp = `${lock}.${process.pid}.npm`
    writeFileSync(tmp, `${owner}\n${process.pid}`)
    renameSync(tmp, lock)
  }
} catch {}
const r = spawnSync(file, args, { stdio: 'inherit' })
if (r.error) {
  process.stderr.write(`${r.error.message}\n`)
  process.exit(r.error.code === 'ENOENT' ? 127 : 1)
}
process.exit(r.status ?? 1)
