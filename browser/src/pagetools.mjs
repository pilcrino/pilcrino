import * as nodeFs from 'node:fs'
import { codedError } from './chrome.mjs'
import { resolveOutFile } from './paths.mjs'
import { isBlockedValue } from './tabs.mjs'

// `script` is the body of an async function and must `return` its value.
const wrap = (script) => `(async () => { ${script}\n })()`

async function evaluate(page, script) {
  try {
    return await page.evaluate(wrap(script))
  } catch (err) {
    const msg = String(err?.message ?? err).slice(0, 500)
    throw codedError('script_error', `The page script threw: ${msg}`)
  }
}

/** Runs the script in the page and writes its JSON result to outFile. The value never leaves this function. */
export async function captureTool(page, script, outFile, ctx) {
  const path = resolveOutFile(outFile, ctx.roots, { profile: ctx.profile, fs: ctx.fs })
  const value = await evaluate(page, script)
  const text = JSON.stringify(value ?? null, null, 2)
  ;(ctx.fs ?? nodeFs).writeFileSync(path, text)
  const res = { path, bytes: Buffer.byteLength(text), items: Array.isArray(value) ? value.length : 1 }
  // Only the flag leaves this function, never the value.
  if (isBlockedValue(value)) res.blocked = true
  return res
}

export async function runTool(page, script) {
  await evaluate(page, script)
  return { ok: true }
}

const MAX_FULL_PX = 16384

export async function screenshotTool(page, outFile, mode = 'viewport', ctx) {
  if (!['viewport', 'full', 'scroll'].includes(mode)) {
    throw codedError('bad_argument', `mode must be viewport, full or scroll, got ${JSON.stringify(mode)}`)
  }
  const path = resolveOutFile(outFile, ctx.roots, { profile: ctx.profile, fs: ctx.fs })
  if (mode === 'viewport') {
    await page.screenshot({ path })
    return { paths: [path] }
  }
  // Derived names go through the same guard as the requested one: a symlink
  // planted at page-01.png must not lead a write outside the roots.
  const numbered = (i) => resolveOutFile(outFile.replace(/\.png$/i, '') + `-${String(i).padStart(2, '0')}.png`, ctx.roots, { profile: ctx.profile, fs: ctx.fs })
  if (mode === 'full') {
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    if (height <= MAX_FULL_PX) {
      await page.screenshot({ path, fullPage: true })
      return { paths: [path] }
    }
    const paths = []
    for (let i = 0, y = 0; y < height; i++, y += MAX_FULL_PX) {
      const p = numbered(i + 1)
      await page.screenshot({ path: p, clip: { x: 0, y, width: await page.evaluate(() => document.documentElement.clientWidth), height: Math.min(MAX_FULL_PX, height - y) } })
      paths.push(p)
    }
    return { paths }
  }
  // mode === 'scroll'
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const inner = await page.evaluate(() => window.innerHeight)
  const step = inner > 0 ? inner : Math.max(height, 1)
  const paths = []
  try {
    for (let i = 0, y = 0; y < height || i === 0; i++, y += step) {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      let timer
      const cap = new Promise((r) => { timer = setTimeout(r, 2000) })
      await Promise.race([page.waitForNetworkIdle({ idleTime: 300, timeout: 2000 }).catch(() => {}), cap])
      clearTimeout(timer)
      const p = numbered(i + 1)
      await page.screenshot({ path: p })
      paths.push(p)
    }
  } finally {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
  }
  return { paths }
}
