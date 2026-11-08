import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildSearchUrl, newToken, serpSearchTool } from '../src/serp.mjs'

const ctxFor = (root) => ({ roots: [root], profile: '/nope' })
const fakeBridge = (outcome) => { const calls = []; return { calls, search: async (args) => { calls.push(args); if (outcome instanceof Error) throw outcome; return outcome } } }

test('buildSearchUrl encodes the query and places the marker in the query string', () => {
  const u = new URL(buildSearchUrl('a & b #c "d" é', { hl: 'en', gl: 'us' }, 'tok'))
  assert.equal(u.origin + u.pathname, 'https://www.google.com/search')
  assert.equal(u.searchParams.get('q'), 'a & b #c "d" é')
  assert.equal(u.searchParams.get('hl'), 'en')
  assert.equal(u.searchParams.get('gl'), 'us')
  assert.equal(u.searchParams.get('pilcrino'), 'tok')
  assert.equal(u.hash, '')
  const plain = new URL(buildSearchUrl('x', {}, 't'))
  assert.equal(plain.searchParams.has('hl'), false)
})

test('newToken is 128 bits of base64url and unique', () => {
  const seen = new Set()
  for (let i = 0; i < 100; i++) { const t = newToken(); assert.equal(t.length, 22); assert.match(t, /^[A-Za-z0-9_-]+$/); seen.add(t) }
  assert.equal(seen.size, 100)
})

test('serp_search writes the capture with engine google and returns counts only', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-serp-')))
  const bridge = fakeBridge({ value: { query: 'q', topResults: [{ rank: 1, url: 'https://e.com', title: 'T' }], text: 'secret page text' } })
  const r = await serpSearchTool(bridge, { query: 'q', outFile: join(root, 'out', 's.json'), locale: { hl: 'en' } }, ctxFor(root))
  assert.deepEqual(Object.keys(r).sort(), ['bytes', 'engine', 'items', 'path'])
  assert.equal(r.items, 1); assert.equal(r.engine, 'google')
  const file = JSON.parse(readFileSync(r.path, 'utf8'))
  assert.equal(file.engine, 'google'); assert.equal(file.text, 'secret page text')
  assert.equal(JSON.stringify(r).includes('secret'), false)
  const sent = new URL(bridge.calls[0].url)
  assert.equal(sent.searchParams.get('q'), 'q'); assert.equal(sent.searchParams.get('hl'), 'en'); assert.equal(sent.searchParams.get('pilcrino'), bridge.calls[0].token)
  rmSync(root, { recursive: true, force: true })
})

test('blocked value sets blocked: true on the result and in the file', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-serp-')))
  const r = await serpSearchTool(fakeBridge({ value: { blocked: 'consent' } }), { query: 'q', outFile: join(root, 's.json') }, ctxFor(root))
  assert.equal(r.blocked, true)
  assert.equal(JSON.parse(readFileSync(r.path, 'utf8')).blocked, 'consent')
  rmSync(root, { recursive: true, force: true })
})

test('bad outFile fails bad_path before the bridge is asked', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-serp-')))
  const bridge = fakeBridge({ value: {} })
  await assert.rejects(serpSearchTool(bridge, { query: 'q', outFile: '/etc/x.json' }, ctxFor(root)), (e) => e.code === 'bad_path')
  await assert.rejects(serpSearchTool(bridge, { query: 'q', outFile: 'relative.json' }, ctxFor(root)), (e) => e.code === 'bad_path')
  assert.equal(bridge.calls.length, 0)
  rmSync(root, { recursive: true, force: true })
})

test('bridge errors pass through with their code', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-serp-')))
  const err = Object.assign(new Error('nobody home'), { code: 'extension_not_connected' })
  await assert.rejects(serpSearchTool(fakeBridge(err), { query: 'q', outFile: join(root, 's.json') }, ctxFor(root)), (e) => e.code === 'extension_not_connected')
  rmSync(root, { recursive: true, force: true })
})
