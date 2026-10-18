import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// The fixtures' .out, .err and .code files were captured from the Python
// converter this script replaced (18 Oct 2026); stdout and the exit code must
// match byte for byte, stderr by its message.
const here = dirname(fileURLToPath(import.meta.url))
const fx = join(here, 'fixtures', 'gutenberg')
const script = join(here, 'md-to-gutenberg.mjs')
const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: here, encoding: 'utf8' })
const expect = (name) => ({ out: readFileSync(join(fx, `${name}.out`), 'utf8'), err: readFileSync(join(fx, `${name}.err`), 'utf8'), code: Number(readFileSync(join(fx, `${name}.code`), 'utf8')) })

const cases = {
  post: ['fixtures/gutenberg/post.md'],
  nofm: ['fixtures/gutenberg/nofm.md'],
  'extra-ok': ['fixtures/gutenberg/post.md', '--extra-blocks', 'fixtures/gutenberg/extra-ok.json'],
  'extra-inline': ['fixtures/gutenberg/post.md', '--extra-blocks', '[{"position":"top","markup":"<!-- wp:i -->I<!-- /wp:i -->"}]'],
  'extra-missing': ['fixtures/gutenberg/post.md', '--extra-blocks', '/tmp/does-not-exist-toc.json'],
  'extra-bad': ['fixtures/gutenberg/post.md', '--extra-blocks', 'fixtures/gutenberg/extra-bad.json'],
  'extra-notlist': ['fixtures/gutenberg/post.md', '--extra-blocks', 'fixtures/gutenberg/extra-notlist.json'],
}

for (const [name, args] of Object.entries(cases)) {
  test(`parity with the Python converter: ${name}`, () => {
    const r = run(...args)
    const want = expect(name)
    assert.equal(r.status, want.code, r.stderr)
    assert.equal(r.stdout, want.out)
    // Every warning or error line the Python wrote has a counterpart with the same opening words.
    for (const line of want.err.split('\n').filter(Boolean)) {
      const head = line.split(/[:(]/)[0].slice(0, 40)
      assert.ok(r.stderr.includes(head), `stderr lacks a line starting "${head}":\n${r.stderr}`)
    }
  })
}

test('usage: no input exits 2, a missing input file exits 1', () => {
  assert.equal(run().status, 2)
  const r = run('fixtures/gutenberg/nope.md')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /no such file/)
})

test('--extra-blocks=<value> form is accepted', () => {
  const r = run('fixtures/gutenberg/post.md', '--extra-blocks=[{"position":"top","markup":"<!-- wp:i -->I<!-- /wp:i -->"}]')
  assert.equal(r.status, 0)
  assert.equal(r.stdout, expect('extra-inline').out)
})
