import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { retire, pullWithArchive, ExitError } from './archive-draft.mjs'

const SCRIPT = fileURLToPath(new URL('./archive-draft.mjs', import.meta.url))
const ARCHIVE = 'blog-ops/drafts/_archive/s'

function sh(cwd, args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' })
}
function put(root, files) {
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true })
    writeFileSync(join(root, f), text)
  }
}
function read(root, f) {
  return readFileSync(join(root, f), 'utf8')
}
function cli(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}

let root
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ad-')) })
afterEach(() => rmSync(root, { recursive: true, force: true }))

// retire

test('retire moves the folder when the archive is absent', () => {
  const src = join(root, 'drafts/s')
  const dest = join(root, 'drafts/_archive/s')
  put(src, { 'checklist.md': 'final', 'research/_raw/serp.json': '{}' })
  assert.deepEqual(retire(src, dest), { action: 'moved' })
  assert.equal(existsSync(src), false)
  assert.equal(read(dest, 'checklist.md'), 'final')
  assert.equal(read(dest, 'research/_raw/serp.json'), '{}')
})

test('retire merges into an existing archive without nesting', () => {
  const src = join(root, 'drafts/s')
  const dest = join(root, 'drafts/_archive/s')
  put(dest, { 'checklist.md': 'early', 'README.md': 'merged only' })
  put(src, { 'checklist.md': 'final', 'research/_raw/serp.json': '{}', '_backup/post.md': 'owner' })
  assert.deepEqual(retire(src, dest), { action: 'merged' })
  assert.equal(existsSync(src), false)
  assert.equal(read(dest, 'checklist.md'), 'final')
  assert.equal(read(dest, 'README.md'), 'merged only')
  assert.equal(read(dest, 'research/_raw/serp.json'), '{}')
  assert.equal(read(dest, '_backup/post.md'), 'owner')
  assert.equal(existsSync(join(dest, 's')), false)
  assert.deepEqual(readdirSync(join(root, 'drafts/_archive')), ['s'])
})

test('retire twice finishes the job after a crash mid-copy', () => {
  const src = join(root, 'drafts/s')
  const dest = join(root, 'drafts/_archive/s')
  put(src, { 'checklist.md': 'final', 'plan.md': 'plan' })
  put(dest, { 'checklist.md': 'final' })
  assert.deepEqual(retire(src, dest), { action: 'merged' })
  assert.equal(read(dest, 'plan.md'), 'plan')
  assert.deepEqual(retire(src, dest), { action: 'already-retired' })
  assert.deepEqual(readdirSync(join(root, 'drafts/_archive')), ['s'])
})

test('retire with neither folder exits 2', () => {
  const r = cli(['retire', '--src', join(root, 'drafts/s'), '--dest', join(root, 'drafts/_archive/s')])
  assert.equal(r.status, 2)
  assert.match(r.err, /neither/)
})

// pull

let origin, seed, work
function gitSetup() {
  origin = join(root, 'origin.git')
  seed = join(root, 'seed')
  work = join(root, 'work')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  execFileSync('git', ['clone', '-q', origin, seed])
  put(seed, { 'README.md': 'blog\n' })
  sh(seed, ['add', '-A'])
  sh(seed, ['commit', '-qm', 'init'])
  sh(seed, ['push', '-q', 'origin', 'HEAD:main'])
  execFileSync('git', ['clone', '-q', origin, work])
}
function mergeUpstream(files) {
  put(seed, files)
  sh(seed, ['add', '-A'])
  sh(seed, ['commit', '-qm', 'merged post'])
  sh(seed, ['push', '-q', 'origin', 'HEAD:main'])
}

test('pull restores a local archive the merge also carries', () => {
  gitSetup()
  mergeUpstream({ [`${ARCHIVE}/checklist.md`]: 'early', [`${ARCHIVE}/README.md`]: 'merged only' })
  put(work, { [`${ARCHIVE}/checklist.md`]: 'final', [`${ARCHIVE}/research/_raw/a.json`]: '{}' })
  const r = pullWithArchive({ repo: work, archive: ARCHIVE, base: 'main' })
  assert.deepEqual(r, { pulled: true, archiveRestored: true, changed: [`${ARCHIVE}/checklist.md`] })
  assert.equal(sh(work, ['rev-parse', 'HEAD']), sh(seed, ['rev-parse', 'HEAD']))
  assert.equal(read(work, `${ARCHIVE}/checklist.md`), 'final')
  assert.equal(read(work, `${ARCHIVE}/README.md`), 'merged only')
  assert.equal(read(work, `${ARCHIVE}/research/_raw/a.json`), '{}')
  assert.deepEqual(readdirSync(join(work, 'blog-ops/drafts/_archive')), ['s'])
})

test('pull with nothing in the way pulls and restores nothing', () => {
  gitSetup()
  mergeUpstream({ 'src/content/blog/s.md': 'post' })
  const r = pullWithArchive({ repo: work, archive: ARCHIVE, base: 'main' })
  assert.deepEqual(r, { pulled: true, archiveRestored: false, changed: [] })
  assert.equal(read(work, 'src/content/blog/s.md'), 'post')
})

test('pull off the base branch exits 3 and changes nothing', () => {
  gitSetup()
  mergeUpstream({ [`${ARCHIVE}/checklist.md`]: 'early' })
  sh(work, ['checkout', '-qb', 'blog/s'])
  const before = sh(work, ['rev-parse', 'HEAD'])
  const r = cli(['pull', '--repo', work, '--archive', ARCHIVE, '--base', 'main'])
  assert.equal(r.status, 3)
  assert.equal(sh(work, ['rev-parse', 'HEAD']), before)
})

test('pull blocked by another file exits 4 and lists it', () => {
  gitSetup()
  mergeUpstream({ 'src/content/blog/s.md': 'merged', [`${ARCHIVE}/checklist.md`]: 'early' })
  put(work, { 'src/content/blog/s.md': 'local', [`${ARCHIVE}/checklist.md`]: 'final' })
  const before = sh(work, ['rev-parse', 'HEAD'])
  const r = cli(['pull', '--repo', work, '--archive', ARCHIVE, '--base', 'main'])
  assert.equal(r.status, 4)
  assert.deepEqual(JSON.parse(r.out), { blocked: ['src/content/blog/s.md'] })
  assert.equal(sh(work, ['rev-parse', 'HEAD']), before)
  assert.equal(read(work, `${ARCHIVE}/checklist.md`), 'final')
})

test('pull restores an archive left aside by an interrupted earlier run', () => {
  gitSetup()
  mergeUpstream({ [`${ARCHIVE}/checklist.md`]: 'early' })
  put(work, { [`${ARCHIVE}.aside-2026-10-23T00-00-00-000Z/checklist.md`]: 'final', [`${ARCHIVE}.aside-2026-10-23T00-00-00-000Z/_backup/post.md`]: 'owner' })
  sh(work, ['pull', '-q', '--ff-only', 'origin', 'main'])
  const r = pullWithArchive({ repo: work, archive: ARCHIVE, base: 'main' })
  assert.deepEqual(r, { pulled: true, archiveRestored: true, changed: [`${ARCHIVE}/checklist.md`] })
  assert.equal(read(work, `${ARCHIVE}/checklist.md`), 'final')
  assert.equal(read(work, `${ARCHIVE}/_backup/post.md`), 'owner')
  assert.deepEqual(readdirSync(join(work, 'blog-ops/drafts/_archive')), ['s'])
})

test('ExitError carries its exit code', () => {
  assert.equal(new ExitError(3, 'x').code, 3)
})
