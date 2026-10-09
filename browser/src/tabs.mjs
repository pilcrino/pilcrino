import * as nodeFs from 'node:fs'
import { codedError } from './chrome.mjs'

/**
 * Tabs this server process opened. Every other tab in the shared Chrome,
 * including other sessions' tabs and the owner's sign-in tabs, is invisible
 * here and never touched.
 */
let nextTabId = 0

/** Tabs may load only web pages and about:blank; file:, chrome:, javascript:, data: and the rest are refused. */
export function checkTabUrl(url) {
  if (url === 'about:blank') return url
  let u = null
  try { u = new URL(url) } catch { u = null }
  if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) {
    throw codedError('bad_argument', `url ${JSON.stringify(String(url).slice(0, 200))} refused: only http:, https: and about:blank are allowed`)
  }
  return url
}

export class TabRegistry {
  constructor(browser) {
    this.browser = browser
    this.owned = new Map()
  }

  async open(url = 'about:blank', { owned = true } = {}) {
    checkTabUrl(url)
    const page = await this.browser.newPage({ background: true })
    // Module-level counter: a registry rebuilt after a Chrome reconnect must
    // never hand out an id an earlier registry used in this process.
    const tabId = `t${++nextTabId}`
    // Owned before the first navigation, so closeAll on shutdown closes a tab
    // still loading instead of leaving it in the shared Chrome.
    if (owned) this.owned.set(tabId, page)
    if (url && url !== 'about:blank') {
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }) } catch {}
    }
    return { tabId, url: page.url(), title: await page.title().catch(() => '') }
  }

  list() {
    return [...this.owned.entries()].map(([tabId, page]) => ({ tabId, url: page.url(), title: '' }))
  }

  async listWithTitles() {
    return Promise.all([...this.owned.entries()].map(async ([tabId, page]) => ({ tabId, url: page.url(), title: await page.title().catch(() => '') })))
  }

  page(tabId) {
    const page = this.owned.get(tabId)
    if (!page) throw codedError('not_owned', `tab ${JSON.stringify(tabId)} is not owned by this session. Use tabs list, or tabs open.`)
    return page
  }

  async close(tabId) {
    const page = this.page(tabId)
    this.owned.delete(tabId)
    await page.close().catch(() => {})
    return { ok: true }
  }

  async closeAll() {
    for (const tabId of [...this.owned.keys()]) await this.close(tabId)
  }

  /**
   * Leaves a tab that hit a site's check (Google's unusual-traffic page) open
   * for the owner: it stops being owned, so closeAll at the end of the run
   * never closes it and no later call can drive it, and its window comes to
   * the front. `store` keeps the CDP target id of the one tab left this way
   * across server processes; an earlier leftover is closed first, so repeated
   * blocks leave exactly one such tab.
   */
  async leaveOpen(tabId, store) {
    const page = this.page(tabId)
    this.owned.delete(tabId)
    const targetId = await targetIdOf(page)
    const earlier = store.read()
    if (earlier && earlier !== targetId) await closeTarget(this.browser, earlier)
    if (targetId) store.write(targetId)
    await page.bringToFront().catch(() => {})
    return { leftOpen: true }
  }
}

async function targetIdOf(page) {
  let cdp = null
  try {
    cdp = await page.createCDPSession()
    const { targetInfo } = await cdp.send('Target.getTargetInfo')
    return targetInfo?.targetId ?? null
  } catch {
    return null
  } finally {
    await cdp?.detach().catch(() => {})
  }
}

/** Closes a tab by CDP target id; a tab the owner already closed is not an error. */
async function closeTarget(browser, targetId) {
  let cdp = null
  try {
    cdp = await browser.target().createCDPSession()
    await cdp.send('Target.closeTarget', { targetId })
  } catch {
    // already gone
  } finally {
    await cdp?.detach().catch(() => {})
  }
}

/** True for a capture value that reports a site's check: an object with a non-empty `blocked`. */
export function isBlockedValue(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !!value.blocked
}

/** File-backed store for the id of the one tab left open on a check, kept in the profile folder. */
export function leftTabStore(file, fs = nodeFs) {
  return {
    read() { try { return fs.readFileSync(file, 'utf8').trim() || null } catch { return null } },
    write(id) { try { fs.writeFileSync(file, id) } catch {} },
  }
}

export async function navigateTool(page, url, { waitUntil = 'domcontentloaded', timeoutMs = 30000 } = {}) {
  checkTabUrl(url)
  const res = await page.goto(url, { waitUntil, timeout: timeoutMs })
  return { url: page.url(), title: await page.title().catch(() => ''), status: res?.status?.() ?? null }
}

export async function clickTool(page, { selector, x, y }) {
  if (selector) await page.click(selector)
  else if (typeof x === 'number' && typeof y === 'number') await page.mouse.click(x, y)
  else throw codedError('bad_argument', 'click needs a selector or x and y')
  return { ok: true }
}

export async function typeTool(page, selector, text, clear = false) {
  await page.waitForSelector(selector, { timeout: 10000 })
  if (clear) await page.$eval(selector, (el) => { if ('value' in el) el.value = ''; else el.textContent = '' })
  await page.type(selector, text)
  return { ok: true }
}

/** A plain wait is capped at WAIT_MAX_MS; a longer delay is several calls. */
export const WAIT_MAX_MS = 30000

export async function waitTool(page, { ms, selector, timeoutMs = 15000 }) {
  if (selector) await page.waitForSelector(selector, { timeout: timeoutMs })
  else await new Promise((r) => setTimeout(r, Math.min(ms ?? 1000, WAIT_MAX_MS)))
  return { ok: true }
}
