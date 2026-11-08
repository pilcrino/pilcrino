import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareBuilds, readStamp, refreshExtensionCopy, STAMP_FILE } from '../src/extension-copy.mjs'

const MOD = fileURLToPath(new URL('../src/extension-copy.mjs', import.meta.url))
function scratch() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-ext-')))
  const src = join(root, 'src')
  mkdirSync(join(src, 'lib'), { recursive: true })
  writeFileSync(join(src, 'manifest.json'), '{"v":1}')
  writeFileSync(join(src, 'lib', 'a.js'), 'one')
  return { root, src, dest: join(root, 'home', '.pilcrino', 'extension') }
}
const refresh = (s, pluginVersion, extra = {}) => refreshExtensionCopy({ src: s.src, dest: s.dest, protocol: 1, pluginVersion, ...extra })

test('first install copies the folder and writes the stamp', async () => {
  const s = scratch()
  const r = await refresh(s, '0.63.0')
  assert.equal(r.action, 'installed')
  assert.equal(readFileSync(join(s.dest, 'lib', 'a.js'), 'utf8'), 'one')
  assert.deepEqual(readStamp(s.dest), { protocol: 1, plugin: '0.63.0' })
  assert.equal(existsSync(`${s.dest}.lock`), false)
  rmSync(s.root, { recursive: true, force: true })
})

test('same protocol, newer plugin version updates files and stamp; older keeps the copy', async () => {
  const s = scratch()
  await refresh(s, '0.63.0')
  writeFileSync(join(s.src, 'lib', 'a.js'), 'two')
  assert.equal((await refresh(s, '0.64.0')).action, 'updated')
  assert.equal(readFileSync(join(s.dest, 'lib', 'a.js'), 'utf8'), 'two')
  assert.equal(readStamp(s.dest).plugin, '0.64.0')
  writeFileSync(join(s.src, 'lib', 'a.js'), 'three')
  assert.equal((await refresh(s, '0.63.5')).action, 'kept')
  assert.equal((await refresh(s, '0.64.0')).action, 'kept')
  assert.equal(readFileSync(join(s.dest, 'lib', 'a.js'), 'utf8'), 'two')
  rmSync(s.root, { recursive: true, force: true })
})

test('an older protocol writer keeps a newer copy; a newer protocol writer updates an older copy', async () => {
  const s = scratch()
  await refreshExtensionCopy({ src: s.src, dest: s.dest, protocol: 2, pluginVersion: '0.63.0' })
  assert.equal((await refreshExtensionCopy({ src: s.src, dest: s.dest, protocol: 1, pluginVersion: '9.0.0' })).action, 'kept')
  assert.equal(readStamp(s.dest).protocol, 2)
  assert.equal((await refreshExtensionCopy({ src: s.src, dest: s.dest, protocol: 3, pluginVersion: '0.1.0' })).action, 'updated')
  assert.deepEqual(readStamp(s.dest), { protocol: 3, plugin: '0.1.0' })
  rmSync(s.root, { recursive: true, force: true })
})

test('a leftover .new and .old are removed at the start', async () => {
  const s = scratch()
  mkdirSync(`${s.dest}.new`, { recursive: true }); writeFileSync(join(`${s.dest}.new`, 'junk'), 'x')
  mkdirSync(`${s.dest}.old`, { recursive: true })
  await refresh(s, '0.63.0')
  assert.equal(existsSync(`${s.dest}.new`), false)
  assert.equal(existsSync(`${s.dest}.old`), false)
  assert.equal(existsSync(join(s.dest, STAMP_FILE)), true)
  rmSync(s.root, { recursive: true, force: true })
})

test('a lock held for the whole wait budget returns skipped_locked without writing', async () => {
  const s = scratch()
  mkdirSync(join(s.root, 'home', '.pilcrino'), { recursive: true })
  mkdirSync(`${s.dest}.lock`)
  const r = await refresh(s, '0.63.0', { lockWaitMs: 300 })
  assert.equal(r.action, 'skipped_locked')
  assert.equal(existsSync(s.dest), false)
  rmSync(s.root, { recursive: true, force: true })
})

test('a lock released after 500 ms is waited for, then the build is installed', async () => {
  const s = scratch()
  mkdirSync(join(s.root, 'home', '.pilcrino'), { recursive: true })
  mkdirSync(`${s.dest}.lock`)
  setTimeout(() => rmSync(`${s.dest}.lock`, { recursive: true, force: true }), 500)
  const t0 = Date.now()
  const r = await refresh(s, '0.63.0')
  assert.equal(r.action, 'installed')
  assert.ok(Date.now() - t0 >= 450)
  rmSync(s.root, { recursive: true, force: true })
})

test('a stale lock is taken over', async () => {
  const s = scratch()
  mkdirSync(join(s.root, 'home', '.pilcrino'), { recursive: true })
  mkdirSync(`${s.dest}.lock`)
  const past = new Date(Date.now() - 120_000)
  utimesSync(`${s.dest}.lock`, past, past)
  const r = await refresh(s, '0.63.0', { lockWaitMs: 300 })
  assert.equal(r.action, 'installed')
  rmSync(s.root, { recursive: true, force: true })
})

test('an older writer holding the lock, then a newer writer: the newest build ends installed', async () => {
  const s = scratch()
  // The child takes the lock itself, installs 0.63.0 while holding it for 400 ms, then releases.
  const script = `
    import { mkdirSync, rmSync, cpSync, writeFileSync } from 'node:fs'
    const [src, dest] = process.argv.slice(1)
    mkdirSync(dest + '/..', { recursive: true })
    mkdirSync(dest + '.lock')
    cpSync(src, dest, { recursive: true })
    writeFileSync(dest + '/lib/a.js', 'old build')
    writeFileSync(dest + '/${STAMP_FILE}', JSON.stringify({ protocol: 1, plugin: '0.63.0' }))
    process.stdout.write('locked\\n')
    await new Promise((r) => setTimeout(r, 400))
    rmSync(dest + '.lock', { recursive: true, force: true })
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', script, s.src, s.dest], { stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((r) => child.stdout.once('data', r))
  writeFileSync(join(s.src, 'lib', 'a.js'), 'new build')
  const r = await refresh(s, '0.64.0')
  await new Promise((r2) => child.once('close', r2))
  assert.equal(r.action, 'updated')
  assert.deepEqual(readStamp(s.dest), { protocol: 1, plugin: '0.64.0' })
  assert.equal(readFileSync(join(s.dest, 'lib', 'a.js'), 'utf8'), 'new build')
  rmSync(s.root, { recursive: true, force: true })
})

test('compareBuilds orders protocol before plugin semver and treats a missing stamp as older', () => {
  const mine = { protocol: 2, plugin: '0.63.0' }
  assert.equal(compareBuilds(null, mine), 'older')
  assert.equal(compareBuilds({ protocol: 1, plugin: '9.9.9' }, mine), 'older')
  assert.equal(compareBuilds({ protocol: 3, plugin: '0.0.1' }, mine), 'newer')
  assert.equal(compareBuilds({ protocol: 2, plugin: '0.63.0' }, mine), 'same')
  assert.equal(compareBuilds({ protocol: 2, plugin: '0.63.1' }, mine), 'newer')
  assert.equal(compareBuilds({ protocol: 2, plugin: '0.9.0' }, mine), 'older')
  assert.equal(compareBuilds({ protocol: 2, plugin: '0.100.0' }, mine), 'newer')
})
