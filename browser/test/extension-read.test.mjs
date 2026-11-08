import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import { parseHTML } from 'linkedom'

const here = dirname(fileURLToPath(import.meta.url))
vm.runInThisContext(readFileSync(join(here, '..', '..', 'extension', 'lib', 'read-serp.js'), 'utf8'))
const load = (name, search = '?q=kanban+board&pilcrino=abc', pathname = '/search') => {
  const { document } = parseHTML(readFileSync(join(here, 'fixtures', 'serp', name), 'utf8'))
  return globalThis.pilcrinoReadSerp(document, { pathname, search, href: `https://www.google.com${pathname}${search}` })
}

test('results page: ten or fewer organic results, features, text and links', () => {
  const v = load('results.html')
  assert.equal(v.blocked, undefined)
  assert.equal(v.query, 'kanban board')
  assert.equal(v.topResults.length, 8)
  assert.deepEqual(v.topResults[0], { rank: 1, url: 'https://example.com/1', title: 'Title 1' })
  assert.ok(v.topResults.every((r) => !r.url.includes('google.com') && !r.url.includes('youtube.com/watch')))
  assert.deepEqual(v.serpFeatures, ['people_also_ask', 'shopping'])
  assert.ok(v.text.length > 0 && v.text.length <= 20000)
  assert.ok(v.links.length <= 200 && v.links.every((l) => typeof l.href === 'string'))
  assert.equal(v.title, 'kanban board - Google Search')
  assert.equal(v.url, 'https://www.google.com/search?q=kanban+board&pilcrino=abc')
  assert.match(v.searchedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('sorry page is blocked', () => {
  const v = load('sorry.html', '?continue=x', '/sorry/index')
  assert.equal(v.blocked, 'unusual_traffic')
  assert.equal(v.topResults, undefined)
})

test('ai overview and featured snippet are features', () => {
  assert.deepEqual(load('ai-overview.html').serpFeatures, ['ai_overview', 'featured_snippet'])
})

test('poll decision: blocked, five results, or 40 tries', () => {
  const d = globalThis.pilcrinoPollDecision
  assert.equal(d({ blocked: 'unusual_traffic' }, 0), true)
  assert.equal(d({ topResults: new Array(5) }, 0), true)
  assert.equal(d({ topResults: new Array(3) }, 39), false)
  assert.equal(d({ topResults: new Array(3) }, 40), true)
})

test('thin page returns its three results, not blocked', () => {
  const v = load('thin.html')
  assert.equal(v.topResults.length, 3)
  assert.equal(v.blocked, undefined)
})
