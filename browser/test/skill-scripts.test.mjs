// The capture scripts the two research skills carry, run on saved Bing pages:
// the branches that read `resultCount` and `blocked` depend on exactly this
// behaviour, so the scripts are pinned here rather than trusted.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseHTML } from 'linkedom'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const fixture = (name) => readFileSync(join(here, 'fixtures', 'serp', name), 'utf8')

/** The fenced script whose first line is the given marker comment, de-indented. */
function scriptFrom(skillPath, marker) {
  const text = readFileSync(join(root, skillPath), 'utf8')
  const at = text.indexOf(marker)
  assert.ok(at > 0, `${marker} not found in ${skillPath}`)
  const rest = text.slice(at)
  const body = rest.slice(0, rest.indexOf('\n```'))
  return body.split('\n').map((l) => l.replace(/^ {4}/, '')).join('\n')
}

function run(script, html, href) {
  const { document } = parseHTML(html)
  const u = new URL(href)
  const location = { href, hostname: u.hostname, pathname: u.pathname, search: u.search }
  return new Function('document', 'location', script)(document, location)
}

const BING_URL = 'https://www.bing.com/search?q=kanban+board'
const SCRIPTS = [
  ['blog-post-workflow', scriptFrom('skills/blog-post-workflow/SKILL.md', '// pilcrino-bing-serp-script')],
  ['plan-content', scriptFrom('skills/plan-content/SKILL.md', '// pilcrino-plan-content-capture-script')],
]

for (const [name, script] of SCRIPTS) {
  test(`${name}: a Bing results page gives engine bing and resultCount 8`, () => {
    const v = run(script, fixture('bing-results.html'), BING_URL)
    assert.equal(v.engine, 'bing')
    assert.equal(v.resultCount, 8)
    assert.equal(v.blocked, undefined)
  })
  test(`${name}: a long zero-result Bing page gives resultCount 0 and no blocked`, () => {
    const html = fixture('bing-empty.html')
    assert.ok(html.length > 3000)
    const v = run(script, html, 'https://www.bing.com/search?q=zxqv+rare+query')
    assert.equal(v.resultCount, 0)
    assert.equal(v.blocked, undefined)
  })
  test(`${name}: a Bing check page gives blocked bing_check`, () => {
    const v = run(script, fixture('bing-check.html'), BING_URL)
    assert.equal(v.blocked, 'bing_check')
    assert.equal(v.engine, 'bing')
  })
}

test('blog-post-workflow: ranked topResults and no features on Bing', () => {
  const v = run(SCRIPTS[0][1], fixture('bing-results.html'), BING_URL)
  assert.equal(v.topResults.length, 8)
  assert.deepEqual(v.topResults[0], { rank: 1, url: 'https://example.com/b1', title: 'Bing Title 1' })
  assert.deepEqual(v.topResults.map((r) => r.rank), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(v.serpFeatures, [])
  assert.equal(v.query, 'kanban board')
})

test('plan-content: keeps its own shape (url, title, text, links) and has no topResults', () => {
  const v = run(SCRIPTS[1][1], fixture('bing-results.html'), BING_URL)
  assert.equal(v.url, BING_URL)
  assert.equal(v.title, 'kanban board - Search')
  assert.ok(v.text.length > 0)
  assert.ok(Array.isArray(v.links) && v.links.length > 0)
  assert.equal(v.topResults, undefined)
})

test('plan-content: a Google check page is still blocked unusual_traffic', () => {
  const v = run(SCRIPTS[1][1], readFileSync(join(here, 'fixtures', 'serp', 'sorry.html'), 'utf8'), 'https://www.google.com/sorry/index?continue=x')
  assert.equal(v.blocked, 'unusual_traffic')
})
