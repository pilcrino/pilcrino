import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bannerFields, bareFilename, containsLine, parseArgs, splitFrontmatter } from './post-to-clipboard.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'post-to-clipboard.mjs')
const dir = mkdtempSync(join(tmpdir(), 'pilcrino-p2c-test-'))
test.after(() => rmSync(dir, { recursive: true, force: true }))

let n = 0
function post(text) {
  const file = join(dir, `post-${++n}.md`)
  writeFileSync(file, text)
  return file
}

// The first run may install browser/node_modules (npm), hence the long timeout.
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 300000, env: { ...process.env, ...env } })
  return { code: r.status, stdout: r.stdout, stderr: r.stderr }
}

/** --no-clipboard output: field lines, one empty line, then the HTML. */
function split(stdout) {
  const i = stdout.indexOf('\n\n')
  if (stdout.startsWith('\n')) return { fields: '', html: stdout.slice(1) }
  return { fields: stdout.slice(0, i), html: stdout.slice(i + 2) }
}

const FULL = `---
title: "Billing by the hour: a field guide"
description: 'Track time, bill it, get paid. It''s simple.'
date: 2026-10-12
tags:
  - invoicing
  # 2-4 tags total
  - "time tracking"
author: "Dana Reyes"
image: "images/billing-by-the-hour/featured.png"
---
# Body heading
`

test('parseArgs: file required, flags parsed, unknown flag refused', () => {
  assert.throws(() => parseArgs([]), /usage/)
  assert.deepEqual(parseArgs(['p.md']), { file: 'p.md', coverKey: null, clipboard: true })
  assert.deepEqual(parseArgs(['p.md', '--no-clipboard', '--cover-key', 'thumb']), { file: 'p.md', coverKey: 'thumb', clipboard: false })
  assert.throws(() => parseArgs(['p.md', '--cover-key']), /needs a key/)
  assert.throws(() => parseArgs(['p.md', '--bogus']), /unknown argument/)
})

test('splitFrontmatter: scalars, quotes, block list with a comment, body kept', () => {
  const { data, body } = splitFrontmatter(FULL)
  assert.equal(data.title, 'Billing by the hour: a field guide')
  assert.equal(data.description, "Track time, bill it, get paid. It's simple.")
  assert.equal(data.date, '2026-10-12')
  assert.deepEqual(data.tags, ['invoicing', 'time tracking'])
  assert.equal(body, '# Body heading\n')
})

test('splitFrontmatter: inline list, CRLF, nested map skipped, no frontmatter', () => {
  const { data } = splitFrontmatter('---\r\ntags: [a, "b c"]\r\ncover:\r\n  image: x.png\r\nauthors:\r\n  - A\r\n  - B\r\n---\r\nhi\r\n')
  assert.deepEqual(data.tags, ['a', 'b c'])
  assert.equal(data.cover, undefined)
  assert.deepEqual(data.authors, ['A', 'B'])
  assert.deepEqual(splitFrontmatter('# Just a post\n'), { data: {}, body: '# Just a post\n' })
  assert.deepEqual(splitFrontmatter('---\ntitle: never closed\n').data, {})
})

test('bannerFields: every cover key the markdown docs use, as a bare filename', () => {
  for (const key of ['heroImage', 'cover', 'image', 'feature_image', 'featured_image']) {
    const fields = bannerFields({ title: 'T', [key]: `../../assets/blog/slug/hero-${key}.png` })
    assert.deepEqual(fields, [['title', 'T'], ['cover', `hero-${key}.png`]], key)
  }
})

test('bannerFields: --cover-key wins over the default keys; remote cover kept whole', () => {
  assert.deepEqual(bannerFields({ image: 'a/default.png', thumb: 'b/custom.png' }, 'thumb'), [['cover', 'custom.png']])
  assert.deepEqual(bannerFields({ image: 'a/default.png' }, 'thumb'), [['cover', 'default.png']])
  assert.deepEqual(bannerFields({ cover: 'https://cdn.example/x.png' }), [['cover', 'https://cdn.example/x.png']])
})

test('bannerFields: alternative keys, list joins, absent fields omitted', () => {
  const fields = bannerFields({ excerpt: 'E', pubDate: '2026-01-02', tags: ['a', 'b'], authors: ['X', 'Y'] })
  assert.deepEqual(fields, [['description', 'E'], ['date', '2026-01-02'], ['tags', 'a, b'], ['author', 'X, Y']])
  assert.deepEqual(bannerFields({ published_at: '2026-03-04' }), [['date', '2026-03-04']])
  assert.deepEqual(bannerFields({}), [])
})

test('bareFilename: query, fragment and escapes', () => {
  assert.equal(bareFilename('./images/slug/my%20chart.png?v=2#x'), 'my chart.png')
  assert.equal(bareFilename('featured.png'), 'featured.png')
})

test('cli --no-clipboard: field lines, then the rendered body without frontmatter', () => {
  const body = `
## Why hourly

- one
- two

1. first
2. second

| Rate | Hours |
| --- | --- |
| 90 | 12 |

See [Clockfold](https://clockfold.example/notes).

![Chart of hours](../images/billing-by-the-hour/hours-chart.png "Hours")
![Remote](https://cdn.example/r.png)
`
  const r = run([post(FULL + body), '--no-clipboard'])
  assert.equal(r.code, 0, r.stderr)
  const { fields, html } = split(r.stdout)
  assert.equal(fields, [
    'title: Billing by the hour: a field guide',
    "description: Track time, bill it, get paid. It's simple.",
    'date: 2026-10-12',
    'tags: invoicing, time tracking',
    'author: Dana Reyes',
    'cover: featured.png',
    'contains: 1 table',
  ].join('\n'))
  assert.match(html, /<h1>Body heading<\/h1>/)
  assert.match(html, /<h2>Why hourly<\/h2>/)
  assert.match(html, /<ul>\s*<li>one<\/li>/)
  assert.match(html, /<ol>\s*<li>first<\/li>/)
  assert.match(html, /<table>[\s\S]*<th>Rate<\/th>[\s\S]*<td>90<\/td>/)
  assert.match(html, /<a href="https:\/\/clockfold\.example\/notes">Clockfold<\/a>/)
  assert.match(html, /<img src="hours-chart\.png" alt="Chart of hours" title="Hours">/)
  assert.match(html, /<img src="https:\/\/cdn\.example\/r\.png"/)
  assert.doesNotMatch(html, /title:|description:|---/)
})

test('cli --no-clipboard: --cover-key picks the configured key', () => {
  const r = run([post('---\ntitle: T\nimage: a/default.png\nthumb: "b/custom.png"\n---\nx\n'), '--no-clipboard', '--cover-key', 'thumb'])
  assert.equal(r.code, 0, r.stderr)
  assert.equal(split(r.stdout).fields, 'title: T\ncover: custom.png')
})

test('cli --no-clipboard: a post without frontmatter prints no fields', () => {
  const r = run([post('# Plain\n\nText.\n'), '--no-clipboard'])
  assert.equal(r.code, 0, r.stderr)
  const { fields, html } = split(r.stdout)
  assert.equal(fields, '')
  assert.match(html, /^<h1>Plain<\/h1>/)
})

test('containsLine: singular, plural, either part alone, nothing when neither', () => {
  assert.equal(containsLine({ tables: 1, codeBlocks: 2 }), 'contains: 1 table, 2 code blocks')
  assert.equal(containsLine({ tables: 3, codeBlocks: 1 }), 'contains: 3 tables, 1 code block')
  assert.equal(containsLine({ tables: 0, codeBlocks: 1 }), 'contains: 1 code block')
  assert.equal(containsLine({ tables: 2, codeBlocks: 0 }), 'contains: 2 tables')
  assert.equal(containsLine({ tables: 0, codeBlocks: 0 }), '')
})

test('cli --no-clipboard: tables and code blocks are counted after the fields, nested ones too', () => {
  const body = [
    '| Tool | Price |', '|---|---|', '| A | $5 |', '',
    '```bash', 'echo hi', '```', '',
    '- item', '', '      indented code in a list', '',
    '> | q | r |', '> |---|---|', '> | 1 | 2 |', '',
    'Inline `code` is not a block.', '',
  ].join('\n')
  const r = run([post(`---\ntitle: T\n---\n${body}`), '--no-clipboard'])
  assert.equal(r.code, 0, r.stderr)
  assert.equal(split(r.stdout).fields, 'title: T\ncontains: 2 tables, 2 code blocks')
})

test('cli --no-clipboard: a post with no tables or code blocks prints no contains line', () => {
  const r = run([post('---\ntitle: T\n---\nJust `inline` code and text.\n'), '--no-clipboard'])
  assert.equal(r.code, 0, r.stderr)
  assert.equal(split(r.stdout).fields, 'title: T')
})

test('cli: a missing file exits 1 with one line on stderr', () => {
  const r = run([join(dir, 'nope.md'), '--no-clipboard'])
  assert.equal(r.code, 1)
  assert.equal(r.stdout, '')
  assert.match(r.stderr, /no such file/)
})

test('cli: usage error exits 2', () => {
  assert.equal(run([]).code, 2)
})

const clipboardReason = process.platform !== 'darwin' ? 'needs macOS'
  : process.env.PILCRINO_CLIPBOARD_TESTS !== '1' ? 'set PILCRINO_CLIPBOARD_TESTS=1 to touch the real clipboard' : null
test('cli: real clipboard holds the HTML, stdout only the fields', clipboardReason ? { skip: clipboardReason } : {}, () => {
  const r = run([post(FULL + '\nPara with **bold**.\n')])
  assert.equal(r.code, 0, r.stderr)
  assert.equal(r.stdout.split('\n')[0], 'title: Billing by the hour: a field guide')
  assert.doesNotMatch(r.stdout, /</)
  const html = spawnSync('osascript', ['-e', 'the clipboard as «class HTML»'], { encoding: 'utf8' }).stdout
  // osascript prints raw data as «data HTML<hex>».
  const hex = /«data HTML([0-9A-F]+)»/i.exec(html)?.[1] ?? ''
  assert.match(Buffer.from(hex, 'hex').toString('utf8'), /<strong>bold<\/strong>/)
})
