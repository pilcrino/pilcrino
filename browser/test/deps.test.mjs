import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
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
    platform: 'linux', env: {},
    spawnSync: (cmd, args) => { argv.push([cmd, ...args]); mkdirSync(join(d, 'node_modules'), { recursive: true }); return { status: 0 } },
  })
  assert.equal(r.installed, true)
  // npm runs under the wrapper that names itself on the lock: node npm-run.mjs <lock> <owner> npm install ...
  assert.equal(argv.length, 1)
  assert.equal(argv[0][0], process.execPath)
  assert.match(argv[0][1], /npm-run\.mjs$/)
  assert.deepEqual(argv[0].slice(2), [join(d, '.install.lock'), String(process.pid), 'npm', 'install', '--omit=dev', '--no-audit', '--no-fund'])
  assert.equal(readFileSync(join(d, 'node_modules', '.pilcrino-installed'), 'utf8'), '0.40.0')
  assert.equal(existsSync(join(d, '.install.lock')), false)
  rmSync(d, { recursive: true, force: true })
})

test('waits for another installer holding the lock, then finds the stamp', () => {
  const d = root()
  // The parent process is alive and is not us: a lock with our own PID would count as ours.
  writeFileSync(join(d, '.install.lock'), String(process.ppid))
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
    settleMs: 0,
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
  const r = ensureInstalled(d, { settleMs: 0, sleep: () => { slept++ }, spawnSync: () => ({ status: 0 }) })
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
    settleMs: 0, platform: 'linux', env: {},
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
  writeFileSync(join(d, '.install.lock'), String(process.ppid))
  let waits = 0
  const r = await installAsync(d, {
    spawn: () => { throw new Error('must not install') },
    sleep: async () => { if (++waits === 2) { mkdirSync(join(d, 'node_modules'), { recursive: true }); writeFileSync(join(d, 'node_modules', '.pilcrino-installed'), '0.40.0') } },
  })
  assert.equal(r.installed, false)
  assert.equal(waits, 2)
  assert.equal(readFileSync(join(d, '.install.lock'), 'utf8'), String(process.ppid))
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

test('installAsync: a missing npm rejects with the one-line hint', async () => {
  const d = root()
  await assert.rejects(
    installAsync(d, {
      settleMs: 0,
      spawn: () => {
        const c = new EventEmitter()
        setImmediate(() => c.emit('error', Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' })))
        return c
      },
    }),
    /npm was not found\. Install Node 22 with npm, or run: node .*bin\.mjs install/,
  )
  assert.equal(existsSync(join(d, '.install.lock')), false)
  rmSync(d, { recursive: true, force: true })
})

test('installAsync: npm killed by a signal names the signal as the exit', async () => {
  const d = root()
  await assert.rejects(
    installAsync(d, { settleMs: 0, spawn: () => { const c = new EventEmitter(); setImmediate(() => c.emit('close', null, 'SIGTERM')); return c } }),
    /npm install failed in .* \(exit SIGTERM\)/,
  )
  rmSync(d, { recursive: true, force: true })
})

test('a lock that holds our own PID is ours', () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), String(process.pid))
  let ran = 0
  const r = ensureInstalled(d, { settleMs: 0, sleep: () => { throw new Error('must not wait') }, spawnSync: () => { ran++; return { status: 0 } } })
  assert.equal(r.installed, true)
  assert.equal(ran, 1)
  assert.equal(existsSync(join(d, '.install.lock')), false)
  rmSync(d, { recursive: true, force: true })
})

test('a lock taken over during the settle delay is not installed under', () => {
  const d = root()
  const lock = join(d, '.install.lock')
  let sleeps = 0
  const r = ensureInstalled(d, {
    settleMs: 100,
    sleep: () => {
      sleeps++
      // First sleep is the settle: another start replaces our fresh lock.
      if (sleeps === 1) { rmSync(lock); writeFileSync(lock, String(process.ppid)); return }
      // Then we wait on its live lock until it stamps.
      mkdirSync(join(d, 'node_modules'), { recursive: true })
      writeFileSync(join(d, 'node_modules', '.pilcrino-installed'), '0.40.0')
    },
    spawnSync: () => { throw new Error('must not install') },
  })
  assert.equal(r.installed, false)
  assert.equal(readFileSync(lock, 'utf8'), String(process.ppid))
  rmSync(d, { recursive: true, force: true })
})

test('a stale lock replaced between the check and the removal is left alone', () => {
  const d = root()
  const lock = join(d, '.install.lock')
  writeFileSync(lock, '999999')
  const r = ensureInstalled(d, {
    settleMs: 0,
    // While this start judges 999999 dead, another start reclaims the lock and links its own.
    pidAlive: (pid) => {
      if (pid === 999999) { rmSync(lock); writeFileSync(lock, String(process.ppid)); return false }
      return true
    },
    sleep: () => {
      mkdirSync(join(d, 'node_modules'), { recursive: true })
      writeFileSync(join(d, 'node_modules', '.pilcrino-installed'), '0.40.0')
    },
    spawnSync: () => { throw new Error('must not install') },
  })
  assert.equal(r.installed, false)
  assert.equal(readFileSync(lock, 'utf8'), String(process.ppid))
  rmSync(d, { recursive: true, force: true })
})

test('installAsync: a lock lost during npm is neither stamped nor released', async () => {
  const d = root()
  const lock = join(d, '.install.lock')
  const stamp = join(d, 'node_modules', '.pilcrino-installed')
  let stampSeenOnWait
  const r = await installAsync(d, {
    settleMs: 0,
    spawn: () => {
      const c = new EventEmitter()
      setImmediate(() => {
        rmSync(lock)
        writeFileSync(lock, String(process.ppid))
        c.emit('close', 0, null)
      })
      return c
    },
    sleep: async () => {
      stampSeenOnWait = existsSync(stamp)
      mkdirSync(join(d, 'node_modules'), { recursive: true })
      writeFileSync(stamp, '0.40.0')
    },
  })
  assert.equal(r.installed, false)
  assert.equal(stampSeenOnWait, false)
  assert.equal(readFileSync(lock, 'utf8'), String(process.ppid))
  rmSync(d, { recursive: true, force: true })
})

test('npmCommand: PILCRINO_NPM_CLI wins on every platform, win32 defaults to npm-cli.js next to node, a missing cli is reported before any spawn', async () => {
  const { npmCommand } = await import('../src/deps.mjs')
  const root = '/r'
  const args = ['install', '--omit=dev', '--no-audit', '--no-fund']
  assert.deepEqual(npmCommand(root, { platform: 'linux', env: {}, exists: () => true, execPath: '/n/node' }), ['npm', args])
  assert.deepEqual(npmCommand(root, { platform: 'linux', env: { PILCRINO_NPM_CLI: '/fake/npm-cli.js' }, exists: () => true, execPath: '/n/node' }), ['/n/node', ['/fake/npm-cli.js', ...args]])
  assert.deepEqual(npmCommand(root, { platform: 'win32', env: {}, exists: () => true, execPath: 'C:\\nodejs\\node.exe' }), ['C:\\nodejs\\node.exe', ['C:\\nodejs\\node_modules\\npm\\bin\\npm-cli.js', ...args]])
  assert.throws(() => npmCommand(root, { platform: 'win32', env: {}, exists: () => false, execPath: 'C:\\nodejs\\node.exe' }), /npm was not found/)
})

test('ensureInstalled runs the fake npm named by PILCRINO_NPM_CLI under this node', () => {
  const d = root()
  const cli = join(d, 'fake-npm-cli.js')
  writeFileSync(cli, "require('node:fs').mkdirSync('node_modules', { recursive: true })\n")
  const argv = []
  const r = ensureInstalled(d, {
    env: { ...process.env, PILCRINO_NPM_CLI: cli },
    spawnSync: (cmd, args) => { argv.push([cmd, ...args]); mkdirSync(join(d, 'node_modules'), { recursive: true }); return { status: 0 } },
  })
  assert.equal(r.installed, true)
  assert.deepEqual(argv[0].slice(5), [cli, 'install', '--omit=dev', '--no-audit', '--no-fund'])
})

test('a lock whose owner is dead but whose npm line is alive is still held', async () => {
  const d = root()
  writeFileSync(join(d, '.install.lock'), `${deadPid()}\n${process.pid}`)
  let slept = 0
  const t0 = Date.now()
  await assert.rejects(
    installAsync(d, { settleMs: 0, platform: 'linux', env: {}, now: () => t0 + slept * 400_000, sleep: async () => { slept++ }, spawn: () => { throw new Error('must not install while npm runs') } }),
    /another install has held/,
  )
  assert.ok(slept >= 1)
})

test('installAsync records the npm child pid on its own lock while npm runs', async () => {
  const d = root()
  let seen = ''
  const r = await installAsync(d, {
    settleMs: 0, platform: 'linux', env: {},
    spawn: () => {
      const child = new EventEmitter()
      child.pid = 424242
      setTimeout(() => { seen = readFileSync(join(d, '.install.lock'), 'utf8'); mkdirSync(join(d, 'node_modules'), { recursive: true }); child.emit('close', 0, null) }, 10)
      return child
    },
  })
  assert.equal(r.installed, true)
  assert.equal(seen, `${process.pid}\n424242`)
  assert.equal(existsSync(join(d, '.install.lock')), false)
})

test('an aged lock whose npm line is alive is still held (age never overrides a live installer)', async () => {
  const { utimesSync } = await import('node:fs')
  const d = root()
  const lock = join(d, '.install.lock')
  const dead = deadPid()
  writeFileSync(lock, `${dead}\n${process.pid}`)
  const old = new Date(Date.now() - 60 * 60 * 1000)
  utimesSync(lock, old, old)
  let slept = 0
  const t0 = Date.now()
  await assert.rejects(
    installAsync(d, { settleMs: 0, platform: 'linux', env: {}, now: () => t0 + slept * 400_000, sleep: async () => { slept++ }, spawn: () => { throw new Error('must not install while npm runs') } }),
    /another install has held/,
  )
  assert.equal(readFileSync(lock, 'utf8'), `${dead}\n${process.pid}`, 'the lock was left alone')
})

test('an aged lock with a dead owner and no npm line is reclaimed', async () => {
  const { utimesSync } = await import('node:fs')
  const d = root()
  const lock = join(d, '.install.lock')
  writeFileSync(lock, String(deadPid()))
  const old = new Date(Date.now() - 60 * 60 * 1000)
  utimesSync(lock, old, old)
  const r = await installAsync(d, {
    settleMs: 0, platform: 'linux', env: {},
    spawn: () => { const c = new EventEmitter(); setTimeout(() => { mkdirSync(join(d, 'node_modules'), { recursive: true }); c.emit('close', 0, null) }, 5); return c },
  })
  assert.equal(r.installed, true)
})

test('npm-run.mjs names itself on the lock before npm starts, then passes npm\'s exit code through', async () => {
  const d = root()
  const lock = join(d, '.install.lock')
  writeFileSync(lock, String(process.pid))
  const fake = join(d, 'fake-npm.js')
  // The fake npm copies the lock as it sees it, so the test can check the wrapper wrote first.
  writeFileSync(fake, "require('node:fs').copyFileSync(process.argv[2], process.argv[2] + '.seen'); process.exit(Number(process.env.FAKE_EXIT || 0))")
  const wrapper = join(dirname(fileURLToPath(await import.meta.resolve('../src/deps.mjs'))), 'npm-run.mjs')
  const r = spawnSync(process.execPath, [wrapper, lock, String(process.pid), process.execPath, fake, lock], { encoding: 'utf8', env: { ...process.env, FAKE_EXIT: '3' } })
  assert.equal(r.status, 3, r.stderr)
  const seen = readFileSync(lock + '.seen', 'utf8').split('\n')
  assert.equal(seen[0], String(process.pid))
  assert.match(seen[1], /^\d+$/)
  const missing = spawnSync(process.execPath, [wrapper, lock, String(process.pid), join(d, 'no-such-npm'), 'install'], { encoding: 'utf8' })
  assert.equal(missing.status, 127)
})
