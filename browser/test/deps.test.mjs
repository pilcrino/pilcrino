import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ensureInstalled } from '../src/deps.mjs'

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
