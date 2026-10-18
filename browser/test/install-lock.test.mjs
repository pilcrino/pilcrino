// Real processes contending for browser/.install.lock, with a fake npm (a
// script named by PILCRINO_NPM_CLI, run under this node on every platform)
// that logs when each run starts and ends. No packages are needed: the shim
// and `node bin.mjs install` only use node: modules until the install is done.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const browser = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = JSON.parse(readFileSync(join(browser, 'package.json'), 'utf8')).version

// FAKE_NPM_MS: how long a run takes. FAKE_NPM_TERM_DELAY_MS: on SIGTERM, keep
// running this long before exiting (npm finishing a write). Each run appends
// "start <pid> <t>" and "end <pid> <t>" to FAKE_NPM_LOG.
const FAKE_NPM = `const fs = require('node:fs')
const log = process.env.FAKE_NPM_LOG
const now = () => performance.timeOrigin + performance.now()
fs.appendFileSync(log, 'start ' + process.pid + ' ' + now() + '\\n')
let ending = false
const finish = (code) => {
  if (code === 0) fs.mkdirSync('node_modules', { recursive: true })
  fs.appendFileSync(log, 'end ' + process.pid + ' ' + now() + '\\n')
  process.exit(code)
}
process.on('SIGTERM', () => {
  if (ending) return
  ending = true
  setTimeout(() => finish(143), Number(process.env.FAKE_NPM_TERM_DELAY_MS || 0))
})
setTimeout(() => { if (!ending) finish(0) }, Number(process.env.FAKE_NPM_MS || 300))
`

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'pb-lock-'))
  const root = join(dir, 'browser')
  mkdirSync(root)
  for (const f of ['bin.mjs', 'package.json']) cpSync(join(browser, f), join(root, f))
  cpSync(join(browser, 'src'), join(root, 'src'), { recursive: true })
  const fakeNpm = join(dir, 'fake-npm-cli.js')
  writeFileSync(fakeNpm, FAKE_NPM)
  const log = join(dir, 'npm.log')
  writeFileSync(log, '')
  return { dir, root, log, env: { ...process.env, PILCRINO_NPM_CLI: fakeNpm, FAKE_NPM_LOG: log } }
}

function runs(log) {
  const byPid = new Map()
  for (const line of readFileSync(log, 'utf8').split('\n').filter(Boolean)) {
    const [kind, pid, t] = line.split(' ')
    const r = byPid.get(pid) ?? { pid: Number(pid) }
    r[kind] = Number(t)
    byPid.set(pid, r)
  }
  return [...byPid.values()].sort((a, b) => a.start - b.start)
}

function start(sb, args, extraEnv = {}) {
  const child = spawn(process.execPath, [join(sb.root, 'bin.mjs'), ...args], {
    cwd: sb.root,
    env: { ...sb.env, ...extraEnv },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (c) => { stderr += c })
  const exited = new Promise((r) => child.once('exit', (code, signal) => r({ code, signal, at: performance.timeOrigin + performance.now() })))
  return { child, exited, stderr: () => stderr }
}

const until = async (pred, ms = 10_000) => {
  const end = Date.now() + ms
  while (!pred()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

// On Windows a kill is TerminateProcess: the fake npm cannot delay its exit, so the lock-holding part of this test has no meaning there.
test('a signal mid-install keeps the lock until npm has exited', { timeout: 30_000, skip: process.platform === 'win32' && 'SIGTERM is a hard kill on Windows' }, async () => {
  const sb = sandbox()
  try {
    // The shim (no command) starts npm at once; this npm runs long and takes 1 s to stop on SIGTERM.
    const first = start(sb, [], { FAKE_NPM_MS: '30000', FAKE_NPM_TERM_DELAY_MS: '1000' })
    await until(() => runs(sb.log).length === 1)
    // The lock names the shim on its first line and, once npm runs, npm on its second.
    const lockLines = readFileSync(join(sb.root, '.install.lock'), 'utf8').split('\n')
    assert.equal(lockLines[0], String(first.child.pid))
    assert.equal(lockLines[1], String(runs(sb.log)[0].pid))

    first.child.kill('SIGTERM')
    const second = start(sb, ['install'], { FAKE_NPM_MS: '200' })
    const [a, b] = await Promise.all([first.exited, second.exited])
    assert.equal(a.code, 0, first.stderr())
    assert.equal(b.code, 0, second.stderr())

    const [r1, r2] = runs(sb.log)
    assert.ok(r1.end !== undefined && r2 !== undefined, readFileSync(sb.log, 'utf8'))
    // The first npm honoured its 1 s delay, the shim exited only after it, and the
    // second installer's npm started only after the first had exited.
    assert.ok(r1.end - r1.start >= 1000)
    assert.ok(a.at >= r1.end, `shim exited at ${a.at}, npm ended at ${r1.end}`)
    assert.ok(r2.start >= r1.end, `second npm started ${r1.end - r2.start} ms before the first ended`)
    assert.equal(readFileSync(join(sb.root, 'node_modules', '.pilcrino-installed'), 'utf8'), version)
    assert.equal(existsSync(join(sb.root, '.install.lock')), false)
  } finally {
    rmSync(sb.dir, { recursive: true, force: true })
  }
})

test('the synchronous installer killed hard mid-install leaves a lock that a second installer honours', { timeout: 60_000 }, async () => {
  const sb = sandbox()
  try {
    const first = start(sb, ['install'], { FAKE_NPM_MS: '4000' })
    await until(() => runs(sb.log).length === 1)
    first.child.kill('SIGKILL')
    await first.exited
    // The wrapper named itself on the lock, and it is alive while the fake npm runs.
    const lines = readFileSync(join(sb.root, '.install.lock'), 'utf8').split('\n')
    assert.equal(lines[0], String(first.child.pid))
    assert.match(lines[1], /^\d+$/)
    const second = start(sb, ['install'], { FAKE_NPM_MS: '200' })
    const b = await second.exited
    assert.equal(b.code, 0, second.stderr())
    const [r1, r2] = runs(sb.log)
    assert.ok(r2, `no second npm run in:\n${readFileSync(sb.log, 'utf8')}`)
    if (process.platform === 'win32') {
      // Node on Windows puts a non-detached child into a job object that dies with its parent,
      // so the first npm never finishes; the second reclaims the dead lock and installs.
      assert.equal(r1.end, undefined, `the first npm outlived its killed parent:\n${readFileSync(sb.log, 'utf8')}`)
    } else {
      assert.ok(r2.start >= r1.end, `second npm started ${r1.end - r2.start} ms before the first ended`)
    }
    assert.equal(existsSync(join(sb.root, '.install.lock')), false)
  } finally {
    rmSync(sb.dir, { recursive: true, force: true })
  }
})

test('two installers started at once never run npm together', { timeout: 120_000 }, async () => {
  const ITERATIONS = 12
  for (let i = 0; i < ITERATIONS; i++) {
    const sb = sandbox()
    try {
      // Every other round starts from a lock left by a killed install, so both
      // contenders go through the stale-lock reclaim at the same moment.
      if (i % 2 === 0) writeFileSync(join(sb.root, '.install.lock'), String(spawnSync(process.execPath, ['-e', '0']).pid))
      const a = start(sb, ['install'], { FAKE_NPM_MS: '300' })
      const b = start(sb, ['install'], { FAKE_NPM_MS: '300' })
      const [ea, eb] = await Promise.all([a.exited, b.exited])
      assert.equal(ea.code, 0, a.stderr())
      assert.equal(eb.code, 0, b.stderr())
      const all = runs(sb.log)
      for (let j = 1; j < all.length; j++) {
        assert.ok(all[j].start >= all[j - 1].end, `round ${i}: npm runs overlapped\n${readFileSync(sb.log, 'utf8')}`)
      }
      // One npm run, hence one stamp write; the other installer found the stamp.
      assert.equal(all.length, 1, `round ${i}: ${all.length} npm runs\n${readFileSync(sb.log, 'utf8')}`)
      assert.equal(readFileSync(join(sb.root, 'node_modules', '.pilcrino-installed'), 'utf8'), version)
      assert.equal(existsSync(join(sb.root, '.install.lock')), false)
    } finally {
      rmSync(sb.dir, { recursive: true, force: true })
    }
  }
})
