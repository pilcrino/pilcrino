import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, chmodSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run, parseProfile, validDate, installSnapshot, UsageError } from './competitor-profiles.mjs'

const DIR = 'blog-ops/profile/competitors'
const SCRIPT = fileURLToPath(new URL('./competitor-profiles.mjs', import.meta.url))

function sh(cwd, args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' })
}
function profile(name, slug, date, extra = '') {
  return `# ${name}\n\n**Site:** https://example.com\n**Last verified:** ${date}\n**Slug:** ${slug}\n\n${extra}\n`
}
function writeProfiles(repo, files) {
  mkdirSync(join(repo, DIR), { recursive: true })
  for (const [f, text] of Object.entries(files)) writeFileSync(join(repo, DIR, f), text)
}
function commitAll(repo, msg) {
  sh(repo, ['add', '-A'])
  sh(repo, ['commit', '-qm', msg])
}
function expectFields(actual, expected) {
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(actual[k], v, k)
}

let root, origin, seed, work

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cp-'))
  origin = join(root, 'origin.git')
  seed = join(root, 'seed')
  work = join(root, 'work')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  execFileSync('git', ['clone', '-q', origin, seed])
  writeProfiles(seed, {
    'amz-watcher.md': profile('AMZ Watcher', 'amz-watcher', '2026-07-26', 'old body'),
    'methodology.md': '# Methodology\n',
    '_summary.md': '# Summary\n',
  })
  commitAll(seed, 'old profiles')
  sh(seed, ['push', '-q', 'origin', 'HEAD:main'])
  execFileSync('git', ['clone', '-q', origin, work])
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function refresh(date = '2026-10-06', body = 'new body') {
  writeProfiles(seed, { 'amz-watcher.md': profile('AMZ Watcher', 'amz-watcher', date, body) })
  commitAll(seed, 'refresh')
  sh(seed, ['push', '-q', 'origin', 'HEAD:main'])
}
function status(repo) {
  return sh(repo, ['status', '--porcelain', '--untracked-files=all'])
}

// source

test('source: reads origin/main, not the stale working tree (already fetched)', () => {
  refresh()
  sh(work, ['fetch', '-q', 'origin'])
  const out = join(root, 'snap')
  const r = run({ cwd: work, dir: DIR, base: 'main', out })
  assert.equal(r.source, 'origin/main')
  assert.equal(r.commit, sh(work, ['rev-parse', 'origin/main']).trim())
  assert.deepEqual(r.profiles, [
    { slug: 'amz-watcher', name: 'AMZ Watcher', file: `${DIR}/amz-watcher.md`, lastVerified: '2026-10-06', path: join(out, 'amz-watcher.md') },
  ])
  assert.match(readFileSync(join(out, 'amz-watcher.md'), 'utf8'), /new body/)
  assert.match(readFileSync(join(work, DIR, 'amz-watcher.md'), 'utf8'), /old body/)
})

test('source: fetches a refresh pushed after the clone (the stale post branch case)', () => {
  refresh()
  const r = run({ cwd: work, dir: DIR, base: 'main' })
  assert.equal(r.fetched, true)
  assert.equal(r.profiles[0].lastVerified, '2026-10-06')
  assert.equal(r.out, null)
  assert.equal(r.profiles[0].path, null)
})

test('source: updates origin/<base> even when remote.origin.fetch excludes it', () => {
  refresh()
  sh(work, ['config', 'remote.origin.fetch', '+refs/heads/other:refs/remotes/origin/other'])
  sh(work, ['update-ref', '-d', 'refs/remotes/origin/main'])
  const r = run({ cwd: work, dir: DIR, base: 'main' })
  assert.equal(r.source, 'origin/main')
  assert.equal(r.profiles[0].lastVerified, '2026-10-06')
})

test('source: falls back to the working tree without an origin remote', () => {
  sh(work, ['remote', 'remove', 'origin'])
  const r = run({ cwd: work, dir: DIR, base: 'main' })
  expectFields(r, { source: 'worktree', commit: null, fetched: false, dirExists: true, methodology: true })
  assert.equal(r.profiles[0].lastVerified, '2026-07-26')
})

test('source: keeps the last-known origin/<base> when the fetch fails', () => {
  sh(work, ['remote', 'set-url', 'origin', join(root, 'gone.git')])
  refresh()
  const r = run({ cwd: work, dir: DIR, base: 'main' })
  expectFields(r, { source: 'origin/main', fetched: false })
  assert.equal(r.profiles[0].lastVerified, '2026-07-26')
})

test('source: times out a hung fetch and reports fetched: false', { timeout: 20000 }, () => {
  const ssh = join(root, 'hang-ssh')
  writeFileSync(ssh, '#!/bin/sh\nsleep 30\n')
  chmodSync(ssh, 0o755)
  sh(work, ['remote', 'set-url', 'origin', 'ssh://example.invalid/repo.git'])
  const prev = process.env.GIT_SSH_COMMAND
  process.env.GIT_SSH_COMMAND = ssh
  try {
    const t0 = Date.now()
    const r = run({ cwd: work, dir: DIR, base: 'main', fetchTimeoutMs: 1500 })
    assert.ok(Date.now() - t0 < 10000)
    expectFields(r, { source: 'origin/main', fetched: false })
  } finally {
    if (prev === undefined) delete process.env.GIT_SSH_COMMAND
    else process.env.GIT_SSH_COMMAND = prev
  }
})

test('source: reads every file from one pinned commit even if the ref moves mid-read', () => {
  refresh('2026-10-01', 'pinned body')
  sh(work, ['fetch', '-q', 'origin'])
  let moved = false
  const git = (args, opts = {}) => {
    const r = spawnSync('git', args, { encoding: 'utf8', cwd: opts.cwd, env: opts.env, timeout: opts.timeout, stdio: ['ignore', 'pipe', 'pipe'] })
    if (args[0] === 'ls-tree' && !moved) {
      moved = true
      refresh('2026-10-06', 'moved body')
      sh(work, ['fetch', '-q', 'origin'])
    }
    return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
  }
  const out = join(root, 'snap')
  const r = run({ cwd: work, dir: DIR, base: 'main', out }, { git })
  assert.equal(moved, true)
  assert.equal(r.profiles[0].lastVerified, '2026-10-01')
  assert.match(readFileSync(join(out, 'amz-watcher.md'), 'utf8'), /pinned body/)
})

test('source: reads profiles under a non-ASCII directory from the pinned commit', () => {
  const odd = 'docs/конкуренты'
  mkdirSync(join(seed, odd), { recursive: true })
  writeFileSync(join(seed, odd, 'lasso.md'), profile('Lasso', 'lasso', '2026-10-06'))
  writeFileSync(join(seed, odd, 'methodology.md'), '# M\n')
  commitAll(seed, 'odd dir')
  sh(seed, ['push', '-q', 'origin', 'HEAD:main'])
  const r = run({ cwd: work, dir: odd, base: 'main' })
  expectFields(r, { source: 'origin/main', dirExists: true, methodology: true })
  assert.deepEqual(r.profiles.map((p) => p.file), [`${odd}/lasso.md`])
})

test('source: reports an absent competitor directory as an empty answer', () => {
  const r = run({ cwd: work, dir: 'no/such/dir', base: 'main' })
  expectFields(r, { dirExists: false, methodology: false, profiles: [] })
})

// parsing

test('parsing: skips _summary.md and reports methodology.md without listing it', () => {
  const out = join(root, 'snap')
  const r = run({ cwd: work, dir: DIR, base: 'main', out })
  assert.equal(r.methodology, true)
  assert.deepEqual(r.profiles.map((p) => p.slug), ['amz-watcher'])
  assert.deepEqual(readdirSync(out).sort(), ['amz-watcher.md', 'methodology.md'])
})

for (const [input, expected] of [
  ['2026-10-06', '2026-10-06'],
  ['2026-02-30', null],
  ['2026-13-01', null],
  ['06/10/2026', null],
  ['', null],
  [undefined, null],
]) {
  test(`parsing: validDate(${JSON.stringify(input)}) is ${JSON.stringify(expected)}`, () => {
    assert.equal(validDate(input), expected)
  })
}

test('parsing: parses name, slug and date; falls back to the file name; null on a bad or missing date', () => {
  assert.deepEqual(parseProfile(profile('Lasso', '`lasso`', '2026-09-03'), `${DIR}/lasso.md`), { slug: 'lasso', name: 'Lasso', file: `${DIR}/lasso.md`, lastVerified: '2026-09-03' })
  assert.deepEqual(parseProfile('# X Tool\n\n**Last verified:** 2026-02-30\n', `${DIR}/x-tool.md`), { slug: 'x-tool', name: 'X Tool', file: `${DIR}/x-tool.md`, lastVerified: null })
  assert.equal(parseProfile('# Y\n', `${DIR}/y.md`).lastVerified, null)
  assert.equal(parseProfile('# Z\n**Last verified:** 2026-09-03 (pricing only)\n', `${DIR}/z.md`).lastVerified, null)
})

// snapshot

test('snapshot: replaces a populated snapshot whole; a profile deleted on origin disappears', () => {
  const out = join(root, 'snap')
  run({ cwd: work, dir: DIR, base: 'main', out })
  rmSync(join(seed, DIR, 'amz-watcher.md'))
  writeProfiles(seed, { 'lasso.md': profile('Lasso', 'lasso', '2026-10-06') })
  commitAll(seed, 'swap')
  sh(seed, ['push', '-q', 'origin', 'HEAD:main'])
  const r = run({ cwd: work, dir: DIR, base: 'main', out })
  assert.deepEqual(r.profiles.map((p) => p.slug), ['lasso'])
  assert.deepEqual(readdirSync(out).sort(), ['lasso.md', 'methodology.md'])
  assert.deepEqual(readdirSync(root).filter((f) => f.startsWith('.snap')), [])
})

test('snapshot: a failing git show exits with an error and leaves the previous snapshot intact', () => {
  const out = join(root, 'snap')
  run({ cwd: work, dir: DIR, base: 'main', out })
  const git = (args, opts = {}) => {
    if (args[0] === 'show') return { ok: false, stdout: '', stderr: 'fatal: boom' }
    const r = spawnSync('git', args, { encoding: 'utf8', cwd: opts.cwd, env: opts.env, timeout: opts.timeout, stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
  }
  assert.throws(() => run({ cwd: work, dir: DIR, base: 'main', out }, { git }), /boom/)
  assert.deepEqual(readdirSync(out).sort(), ['amz-watcher.md', 'methodology.md'])
})

test('snapshot: a failed install restores the old snapshot', () => {
  const out = join(root, 'snap')
  mkdirSync(out)
  writeFileSync(join(out, 'old.md'), 'old')
  let calls = 0
  const rename = (a, b) => {
    calls++
    if (calls === 2) throw new Error('rename blocked')
    renameSync(a, b)
  }
  assert.throws(() => installSnapshot(out, [{ file: `${DIR}/a.md`, text: 'a' }], rename), /blocked/)
  assert.deepEqual(readdirSync(out), ['old.md'])
  assert.deepEqual(readdirSync(root).filter((f) => f.startsWith('.snap')), [])
})

for (const [label, out] of [
  ['equal', DIR],
  ['inside', `${DIR}/snap`],
  ['containing', 'blog-ops'],
]) {
  test(`snapshot: rejects --out ${label} the profile dir and deletes nothing`, () => {
    assert.throws(() => run({ cwd: work, dir: DIR, base: 'main', out }), UsageError)
    assert.deepEqual(readdirSync(join(work, DIR)).sort(), ['_summary.md', 'amz-watcher.md', 'methodology.md'])
  })
}

test('snapshot: leaves git status unchanged in both modes', () => {
  refresh()
  const before = status(work)
  run({ cwd: work, dir: DIR, base: 'main' })
  run({ cwd: work, dir: DIR, base: 'main', out: join(root, 'snap') })
  assert.equal(status(work), before)
})

// CLI

test('cli: prints JSON and exits 0', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', DIR, '--base', 'main'], { cwd: work, encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.equal(JSON.parse(r.stdout).profiles[0].slug, 'amz-watcher')
})

test('cli: exits 2 on a usage error', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', DIR], { cwd: work, encoding: 'utf8' })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /usage/)
})

test('cli: exits 1 on a write error', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', DIR, '--base', 'main', '--out', '/dev/null/snap'], { cwd: work, encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.notEqual(r.stderr, '')
})
