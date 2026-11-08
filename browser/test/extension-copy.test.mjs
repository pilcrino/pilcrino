import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
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

test('a leftover .new and a leftover .old beside a complete copy are removed at the start', async () => {
  const s = scratch()
  await refresh(s, '0.63.0')
  mkdirSync(`${s.dest}.new`, { recursive: true }); writeFileSync(join(`${s.dest}.new`, 'junk'), 'x')
  mkdirSync(`${s.dest}.old`, { recursive: true })
  await refresh(s, '0.63.0')
  assert.equal(existsSync(`${s.dest}.new`), false)
  assert.equal(existsSync(`${s.dest}.old`), false)
  assert.equal(existsSync(join(s.dest, STAMP_FILE)), true)
  rmSync(s.root, { recursive: true, force: true })
})

test('an interrupted promotion (only extension.old left) is recovered before comparing, so an older writer cannot downgrade', async () => {
  const s = scratch()
  await refresh(s, '0.64.0')
  writeFileSync(join(s.dest, 'lib', 'a.js'), 'newest build')
  renameSync(s.dest, `${s.dest}.old`) // died between the two renames
  assert.equal(existsSync(s.dest), false)
  const r = await refresh(s, '0.63.0')
  assert.equal(r.action, 'kept')
  assert.equal(existsSync(`${s.dest}.old`), false)
  assert.deepEqual(readStamp(s.dest), { protocol: 1, plugin: '0.64.0' })
  assert.equal(readFileSync(join(s.dest, 'lib', 'a.js'), 'utf8'), 'newest build')
  rmSync(s.root, { recursive: true, force: true })
})

test('a failed replacement copy leaves the installed build in place', async () => {
  const s = scratch()
  await refresh(s, '0.63.0')
  const fs = await import('node:fs')
  const broken = { ...fs, cpSync: () => { throw new Error('disk full') } }
  await assert.rejects(refreshExtensionCopy({ src: s.src, dest: s.dest, protocol: 1, pluginVersion: '0.64.0', fs: broken }), /disk full/)
  assert.deepEqual(readStamp(s.dest), { protocol: 1, plugin: '0.63.0' })
  assert.equal(readFileSync(join(s.dest, 'lib', 'a.js'), 'utf8'), 'one')
  assert.equal(existsSync(`${s.dest}.lock`), false)
  rmSync(s.root, { recursive: true, force: true })
})

test('PILCRINO_EXTENSION_DIR overrides the default destination', async () => {
  const { defaultExtensionDir } = await import('../src/extension-copy.mjs')
  assert.equal(defaultExtensionDir('/home/x', { PILCRINO_EXTENSION_DIR: '/tmp/elsewhere' }), '/tmp/elsewhere')
  assert.equal(defaultExtensionDir('/home/x', {}), join('/home/x', '.pilcrino', 'extension'))
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
  const script = join(s.root, 'older-writer.mjs')
  writeFileSync(script, `
    import { mkdirSync, rmSync, cpSync, writeFileSync } from 'node:fs'
    import { join, dirname } from 'node:path'
    const [src, dest] = process.argv.slice(2)
    mkdirSync(dirname(dest), { recursive: true })
    mkdirSync(dest + '.lock')
    cpSync(src, dest, { recursive: true })
    writeFileSync(join(dest, 'lib', 'a.js'), 'old build')
    writeFileSync(join(dest, '${STAMP_FILE}'), JSON.stringify({ protocol: 1, plugin: '0.63.0' }))
    process.stdout.write('locked' + String.fromCharCode(10))
    await new Promise((r) => setTimeout(r, 400))
    rmSync(dest + '.lock', { recursive: true, force: true })
  `)
  const child = spawn(process.execPath, [script, s.src, s.dest], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (c) => { stderr += c })
  const exited = new Promise((r) => child.once('close', (code) => r(code)))
  const ready = await Promise.race([
    new Promise((r) => child.stdout.once('data', () => r('ready'))),
    exited.then((code) => `exited ${code}: ${stderr}`),
  ])
  assert.equal(ready, 'ready')
  writeFileSync(join(s.src, 'lib', 'a.js'), 'new build')
  const r = await refresh(s, '0.64.0')
  await exited
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
