import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, realpathSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { outRoots, resolveOutFile } from '../src/paths.mjs'

test('outRoots: env list or cwd', () => {
  assert.deepEqual(outRoots({ env: { PILCRINO_BROWSER_OUT: '/a:/b' }, cwd: '/c', delimiter: ':' }), ['/a', '/b'])
  assert.deepEqual(outRoots({ env: {}, cwd: '/c', delimiter: ':' }), ['/c'])
})

test('resolveOutFile: accepts a file inside a root and creates the parent', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-root-')))
  const p = resolveOutFile(join(root, 'research', '_raw', '_serp.json'), [root], { profile: '/nope' })
  assert.equal(p, join(root, 'research', '_raw', '_serp.json'))
  rmSync(root, { recursive: true, force: true })
})

test('resolveOutFile: accepts a console state root under ~/.pilcrino/<blog>', () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'pb-home-')))
  const profile = join(home, '.pilcrino', 'browser')
  const root = join(home, '.pilcrino', 'blog-1', 'research', 'r1', 'scratch')
  mkdirSync(root, { recursive: true })
  assert.equal(resolveOutFile(join(root, 'x.json'), [root], { profile }), join(root, 'x.json'))
  rmSync(home, { recursive: true, force: true })
})

test('resolveOutFile: refuses relative, outside, profile, .git and symlink escapes, leaving targets untouched', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'pb-base-')))
  const root = join(base, 'root'); mkdirSync(root)
  const outside = join(base, 'outside'); mkdirSync(outside)
  writeFileSync(join(outside, 'keep.json'), 'original')
  symlinkSync(outside, join(root, 'link'))
  const profile = join(base, 'profile'); mkdirSync(profile)
  const bad = (p) => assert.throws(() => resolveOutFile(p, [root], { profile }), (e) => e.code === 'bad_path')
  bad('relative.json')
  bad(join(outside, 'x.json'))
  bad(join(profile, 'x.json'))
  bad(join(root, '.git', 'x.json'))
  bad(join(root, 'link', 'keep.json'))
  assert.equal(readFileSync(join(outside, 'keep.json'), 'utf8'), 'original')
  rmSync(base, { recursive: true, force: true })
})

test('resolveOutFile: a dangling symlink leaving the root is refused and nothing is created at the target', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'pb-dang-')))
  const root = join(base, 'root'); mkdirSync(root)
  const outside = join(base, 'outside'); mkdirSync(outside)
  symlinkSync(join(outside, 'new.png'), join(root, 'dangling.png'))
  symlinkSync(join(outside, 'newdir'), join(root, 'dangdir'))
  const profile = join(base, 'profile')
  for (const p of [join(root, 'dangling.png'), join(root, 'dangdir', 'x.png')]) {
    assert.throws(() => resolveOutFile(p, [root], { profile }), (e) => e.code === 'bad_path')
  }
  assert.equal(existsSync(join(outside, 'new.png')), false)
  assert.equal(existsSync(join(outside, 'newdir')), false)
  rmSync(base, { recursive: true, force: true })
})

test('resolveOutFile: a non-existent profile is compared through realpath aliases', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'pb-alias-')))
  const real = join(base, 'real'); mkdirSync(real)
  symlinkSync(real, join(base, 'alias'))
  const profile = join(base, 'alias', 'browser') // does not exist yet, parent is an alias
  const root = real
  assert.throws(() => resolveOutFile(join(real, 'browser', 'x.json'), [root], { profile }), (e) => e.code === 'bad_path')
  rmSync(base, { recursive: true, force: true })
})

test('resolveOutFile: dot segments below the root are refused; a root under dot directories is fine', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'pb-dot-')))
  const root = join(base, 'repo', '.worktrees', 'x'); mkdirSync(root, { recursive: true })
  const profile = join(base, 'profile')
  assert.throws(() => resolveOutFile(join(root, '.claude', 'settings.json'), [root], { profile }), (e) => e.code === 'bad_path')
  assert.throws(() => resolveOutFile(join(root, 'research', '.hidden', 'a.json'), [root], { profile }), (e) => e.code === 'bad_path')
  assert.throws(() => resolveOutFile(join(root, '.env'), [root], { profile }), (e) => e.code === 'bad_path')
  assert.equal(existsSync(join(root, '.claude')), false)
  const ok = join(root, 'research', '_raw', 'a.json')
  assert.equal(resolveOutFile(ok, [root], { profile }), ok)
  rmSync(base, { recursive: true, force: true })
})
