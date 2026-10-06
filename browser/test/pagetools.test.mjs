import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, realpathSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { captureTool, runTool, screenshotTool } from '../src/pagetools.mjs'

const ctxFor = (root) => ({ roots: [root], profile: '/nope' })

test('capture writes JSON, returns counts and no content', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  const page = { evaluate: async () => [{ a: 1 }, { a: 2 }] }
  const r = await captureTool(page, 'return [1,2]', join(root, 'out', 'x.json'), ctxFor(root))
  assert.deepEqual(Object.keys(r).sort(), ['bytes', 'items', 'path'])
  assert.equal(r.items, 2)
  assert.equal(JSON.parse(readFileSync(r.path, 'utf8')).length, 2)
  rmSync(root, { recursive: true, force: true })
})

test('capture: a thrown script is script_error and writes nothing', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  const page = { evaluate: async () => { throw new Error('boom '.repeat(200)) } }
  await assert.rejects(captureTool(page, 'throw 1', join(root, 'x.json'), ctxFor(root)), (e) => e.code === 'script_error' && e.message.length <= 600)
  assert.equal(existsSync(join(root, 'x.json')), false)
  rmSync(root, { recursive: true, force: true })
})

test('capture: bad path is refused before evaluating', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  let evaluated = false
  const page = { evaluate: async () => { evaluated = true; return 1 } }
  await assert.rejects(captureTool(page, 'return 1', '/etc/x.json', ctxFor(root)), (e) => e.code === 'bad_path')
  assert.equal(evaluated, false)
  rmSync(root, { recursive: true, force: true })
})

test('run discards the value', async () => {
  const page = { evaluate: async () => ({ secret: 'page text' }) }
  assert.deepEqual(await runTool(page, 'return document.body.innerText'), { ok: true })
})

test('screenshot: viewport, full and scroll modes write PNGs under the root', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  let height = 2500, y = 0
  const page = {
    screenshot: async ({ path }) => { writeFileSync(path, 'png') },
    evaluate: async (fn, ...args) => {
      const src = String(fn)
      if (src.includes('scrollHeight')) return height
      if (src.includes('innerHeight')) return 1000
      if (src.includes('scrollTo')) { y = args[0]; return undefined }
      return undefined
    },
    waitForNetworkIdle: async () => {},
  }
  const v = await screenshotTool(page, join(root, 'v.png'), 'viewport', ctxFor(root))
  assert.deepEqual(v.paths, [join(root, 'v.png')])
  const s = await screenshotTool(page, join(root, 's.png'), 'scroll', ctxFor(root))
  assert.deepEqual(s.paths, [join(root, 's-01.png'), join(root, 's-02.png'), join(root, 's-03.png')])
  rmSync(root, { recursive: true, force: true })
})

test('screenshot: a numbered symlink leaving the root is refused and its target untouched', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  const root = join(base, 'root'); mkdirSync(root)
  const outside = join(base, 'outside'); mkdirSync(outside)
  writeFileSync(join(outside, 'victim.png'), 'original')
  symlinkSync(join(outside, 'victim.png'), join(root, 'page-01.png'))
  const page = { screenshot: async ({ path }) => writeFileSync(path, 'png'), evaluate: async (fn) => (String(fn).includes('scrollHeight') ? 2500 : String(fn).includes('innerHeight') ? 1000 : undefined), waitForNetworkIdle: async () => {} }
  for (const mode of ['scroll', 'full']) {
    if (mode === 'full') page.evaluate = async (fn) => (String(fn).includes('scrollHeight') ? 40000 : String(fn).includes('clientWidth') ? 1200 : undefined)
    await assert.rejects(screenshotTool(page, join(root, 'page.png'), mode, ctxFor(root)), (e) => e.code === 'bad_path')
    assert.equal(readFileSync(join(outside, 'victim.png'), 'utf8'), 'original')
  }
  rmSync(base, { recursive: true, force: true })
})

test('screenshot: a dangling numbered symlink leaving the root is refused, nothing created outside', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  const root = join(base, 'root'); mkdirSync(root)
  const outside = join(base, 'outside'); mkdirSync(outside)
  symlinkSync(join(outside, 'new.png'), join(root, 'page-01.png'))
  const page = { screenshot: async ({ path }) => writeFileSync(path, 'png'), evaluate: async (fn) => (String(fn).includes('scrollHeight') ? 2500 : String(fn).includes('innerHeight') ? 1000 : undefined), waitForNetworkIdle: async () => {} }
  await assert.rejects(screenshotTool(page, join(root, 'page.png'), 'scroll', ctxFor(root)), (e) => e.code === 'bad_path')
  assert.equal(existsSync(join(outside, 'new.png')), false)
  rmSync(base, { recursive: true, force: true })
})

test('screenshot: bad mode is refused before any directory is created', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  await assert.rejects(screenshotTool({}, join(root, 'sub', 'x.png'), 'nope', ctxFor(root)), (e) => e.code === 'bad_argument')
  assert.equal(existsSync(join(root, 'sub')), false)
  rmSync(root, { recursive: true, force: true })
})

test('screenshot: scroll with innerHeight 0 takes one shot, and scrolls back to top on error', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pb-pt-')))
  const scrolls = []
  const mk = (failShot) => ({
    screenshot: async ({ path }) => { if (failShot) throw new Error('shot failed'); writeFileSync(path, 'png') },
    evaluate: async (fn, ...args) => {
      const src = String(fn)
      if (src.includes('scrollHeight')) return 2500
      if (src.includes('innerHeight')) return 0
      if (src.includes('scrollTo')) { scrolls.push(args.length ? args[0] : 0); return undefined }
      return undefined
    },
    waitForNetworkIdle: async () => {},
  })
  const r = await screenshotTool(mk(false), join(root, 'z.png'), 'scroll', ctxFor(root))
  assert.deepEqual(r.paths, [join(root, 'z-01.png')])
  scrolls.length = 0
  await assert.rejects(screenshotTool(mk(true), join(root, 'e.png'), 'scroll', ctxFor(root)), /shot failed/)
  assert.equal(scrolls.at(-1), 0)
  rmSync(root, { recursive: true, force: true })
})
