import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { stemOf, idFor, identifierFor, allocateIds } from './composition-id.mjs'

const SLUG = 'does-ai-save-time-writing-blog-posts'
const script = fileURLToPath(new URL('./composition-id.mjs', import.meta.url))

test('derives the PR #64 id', () => {
  assert.deepEqual(allocateIds(SLUG, ['cost-per-post-comparison.png']), [{
    filename: 'cost-per-post-comparison.png',
    id: 'does-ai-save-time-writing-blog-posts--cost-per-post-comparison',
    file: 'does-ai-save-time-writing-blog-posts--cost-per-post-comparison.tsx',
    identifier: 'C_does_ai_save_time_writing_blog_posts__cost_per_post_comparison',
  }])
})
test('never lets two (slug, stem) pairs meet', () => { assert.notEqual(idFor('a-b', 'c'), idFor('a', 'b-c')) })
test('normalises stems', () => {
  assert.equal(stemOf('Cost Chart.PNG'), 'cost-chart')
  assert.equal(stemOf('featured.png'), 'featured')
  assert.equal(stemOf('--A__b  c--.webp'), 'a-b-c')
})
test('identifier is one to one with the id', () => {
  assert.equal(identifierFor('a-b--c'), 'C_a_b__c')
  const ids = ['a--b-c', 'a-b--c', 'a--b--c', 'a--bc']
  assert.equal(new Set(ids.map(identifierFor)).size, ids.length)
})
for (const [files, stems] of [
  [['Cost Chart.png', 'cost-chart.png', 'cost-chart-2.png'], ['cost-chart', 'cost-chart-2', 'cost-chart-2-2']],
  [['a.png', 'a.png', 'a-2.png'], ['a', 'a-2', 'a-2-2']],
  [['a-2.png', 'a.png', 'a.png'], ['a-2', 'a', 'a-3']],
]) {
  test(`allocates unused ids in manifest order: ${JSON.stringify(files)}`, () => {
    const out = allocateIds('s', files)
    assert.deepEqual(out.map((o) => o.id), stems.map((st) => `s--${st}`))
    assert.equal(new Set(out.map((o) => o.file)).size, files.length)
    assert.equal(new Set(out.map((o) => o.identifier)).size, files.length)
  })
}
test('is stable', () => { const f = ['x.png', 'X.png', 'x-2.png']; assert.deepEqual(allocateIds('s', f), allocateIds('s', f)) })
test('CLI prints JSON and rejects a bad slug', () => {
  const out = JSON.parse(execFileSync('node', [script, 's', 'a.png'], { encoding: 'utf8' }))
  assert.equal(out[0].id, 's--a')
  assert.throws(() => execFileSync('node', [script, 'Bad--Slug', 'a.png'], { stdio: 'pipe' }))
  assert.throws(() => execFileSync('node', [script, 's'], { stdio: 'pipe' }))
})
