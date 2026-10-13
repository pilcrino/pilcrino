import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { ensureInstalled, installAsync } from '../src/deps.mjs'

function root() {
  const d = mkdtempSync(join(tmpdir(), 'pb-deps-'))
  writeFileSync(join(d, 'package.json'), JSON.stringify({ version: '0.40.0' }))
  return d
}

test('skips install when the stamp names the current version', () => {
  const d = root()
  mkdirSync(join(d, 'node_modules'))
  writeFileSync(join(d, 'node_modules', '.pilcrino-installed'), '0.40.0')
  let calls = 0
  const r = ensureInstalled(d, { spawnSync: () => { calls++; return { status: 0 } } })
  assert.equal(r.installed, false)
  assert.equal(calls, 0)
  rmSync(d, { recursive: true, force: true })
})

test('installs once and writes the stamp when missing', () => {
  const d = root()
  const argv = []
  const r = ensureInstalled(d, {
    spawnSync: (cmd, args) => { argv.push([cmd, ...args]); mkdirSync(join(d, 'node_modules'), { recursive: true }); return { status: 0 } },
  })
  assert.equal(r.installed, true)
  assert.deepEqual(argv, [['npm', 'install', '--omit=dev', '--no-audit', '--no-fund']])
  assert.equal(readFileSync(join(d, 'node_modules', '.pilcrino-installed'), 'utf8'), '0.40.0')
  assert.equal(existsSync(join(d, '.install.lock')), false)
  rmSync(d, { recursive: true, force: true })
})

test('waits for another installer holding the lock, then finds the stamp', () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), String(process.pid))
  let t = 0
  const r = ensureInstalled(d, {
    spawnSync: () => { throw new Error('must not install') },
    sleep: () => { t += 500; if (t >= 1000) { mkdirSync(join(d, 'node_modules'), { recursive: true }); writeFileSync(join(d, 'node_modules', '.pilcrino-installed'), '0.40.0'); rmSync(join(d, '.install.lock')) } },
  })
  assert.equal(r.installed, false)
  rmSync(d, { recursive: true, force: true })
})

test('reports a missing npm in one line', () => {
  const d = root()
  assert.throws(
    () => ensureInstalled(d, { spawnSync: () => ({ status: null, error: Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' }) }) }),
    /npm was not found\. Install Node 22 with npm, or run: node .*bin\.mjs install/,
  )
  rmSync(d, { recursive: true, force: true })
})

// A PID that belonged to a process which has already exited.
function deadPid() {
  return spawnSync(process.execPath, ['-e', '0']).pid
}

test('a lock whose PID is dead is removed at once, whatever its age', () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), String(deadPid()))
  let slept = 0
  const r = ensureInstalled(d, {
    sleep: () => { slept++ },
    spawnSync: () => { mkdirSync(join(d, 'node_modules'), { recursive: true }); return { status: 0 } },
  })
  assert.equal(r.installed, true)
  assert.equal(slept, 0)
  assert.equal(existsSync(join(d, '.install.lock')), false)
  rmSync(d, { recursive: true, force: true })
})

test('a lock with an unparsable PID counts as dead', () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), '')
  let slept = 0
  const r = ensureInstalled(d, { sleep: () => { slept++ }, spawnSync: () => ({ status: 0 }) })
  assert.equal(r.installed, true)
  assert.equal(slept, 0)
  rmSync(d, { recursive: true, force: true })
})

test('a young lock with a live PID is waited on, then gives up after 5 minutes', () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), '4242')
  let t = Date.now()
  let slept = 0
  assert.throws(
    () => ensureInstalled(d, {
      pidAlive: (pid) => pid === 4242,
      now: () => t,
      sleep: () => { slept++; t += 61_000 },
      spawnSync: () => { throw new Error('must not install') },
    }),
    /held .*\.install\.lock for over 5 minutes/,
  )
  assert.ok(slept >= 4)
  assert.equal(existsSync(join(d, '.install.lock')), true)
  rmSync(d, { recursive: true, force: true })
})

test('installAsync: a dead-PID lock is cleared, npm runs, the stamp is written', async () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), String(deadPid()))
  const argv = []
  const r = await installAsync(d, {
    sleep: async () => { throw new Error('must not wait') },
    spawn: (cmd, args) => {
      argv.push([cmd, ...args])
      const child = new EventEmitter()
      setTimeout(() => { mkdirSync(join(d, 'node_modules'), { recursive: true }); child.emit('close', 0, null) }, 10)
      return child
    },
  })
  assert.equal(r.installed, true)
  assert.deepEqual(argv, [['npm', 'install', '--omit=dev', '--no-audit', '--no-fund']])
  assert.equal(readFileSync(join(d, 'node_modules', '.pilcrino-installed'), 'utf8'), '0.40.0')
  assert.equal(existsSync(join(d, '.install.lock')), false)
  rmSync(d, { recursive: true, force: true })
})

test('installAsync: waits on a live lock until another process writes the stamp', async () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), String(process.pid))
  let waits = 0
  const r = await installAsync(d, {
    spawn: () => { throw new Error('must not install') },
    sleep: async () => { if (++waits === 2) { mkdirSync(join(d, 'node_modules'), { recursive: true }); writeFileSync(join(d, 'node_modules', '.pilcrino-installed'), '0.40.0') } },
  })
  assert.equal(r.installed, false)
  assert.equal(waits, 2)
  assert.equal(readFileSync(join(d, '.install.lock'), 'utf8'), String(process.pid))
  rmSync(d, { recursive: true, force: true })
})

test('installAsync: a failing npm rejects with the exit code and releases the lock', async () => {
  const d = root()
  await assert.rejects(
    installAsync(d, { spawn: () => { const c = new EventEmitter(); setImmediate(() => c.emit('close', 1, null)); return c } }),
    /npm install failed in .* \(exit 1\)/,
  )
  assert.equal(existsSync(join(d, '.install.lock')), false)
  rmSync(d, { recursive: true, force: true })
})
