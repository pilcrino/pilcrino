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
  constructor(browser, { log = stderrLog } = {}) {
    this.browser = browser
    this.owned = new Map()
    this.log = log
    registries.add(this)
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
   * Leaves the Google search tab open for the owner when its capture hit
   * Google's check or found no results: earlier retained tabs are closed first
   * (closeCheckLeftovers), then this tab gets the CHECK_TAB_TITLE title, stops
   * being owned (so closeAll at the end of the run never closes it and no later
   * call can drive it) and its window comes to the front. The title is the only
   * mark the cleanup trusts, and it is also what the owner sees on the tab. If
   * setting it fails, the failure is logged and that tab is simply never
   * cleaned up. Nothing is persisted and nothing is locked: two retaining
   * captures at the same time may each leave a tab, which is accepted. Never
   * throws on the cleanup; the capture result stands.
   */
  async leaveOpen(tabId) {
    const page = this.page(tabId)
    await this.closeCheckLeftovers()
    await markCheckTab(page).catch((err) => this.log(`could not title the check tab, it will not be cleaned up later: ${errText(err)}`))
    this.owned.delete(tabId)
    await page.bringToFront().catch((err) => this.log(`could not bring the check tab to the front: ${errText(err)}`))
    return { leftOpen: true }
  }

  /**
   * Closes every page target in this Chrome whose title is exactly
   * CHECK_TAB_TITLE and that no registry in this process owns on the same
   * browser. The URL does not matter. A concurrent run's tab (owned by another
   * server process, so invisible here) is never closed, because only a tab
   * already released by leaveOpen ever carries that title. A failed lookup
   * skips the cleanup; every failure is logged, none is thrown.
   */
  async closeCheckLeftovers() {
    let cdp = null
    try {
      const owned = new Set()
      for (const reg of registries) {
        if (reg.browser !== this.browser) continue
        for (const page of reg.owned.values()) owned.add(await targetIdOf(page))
      }
      cdp = await this.browser.target().createCDPSession()
      const { targetInfos } = await cdp.send('Target.getTargets')
      for (const t of targetInfos ?? []) {
        if (t.type !== 'page' || owned.has(t.targetId) || t.title !== CHECK_TAB_TITLE) continue
        try {
          await cdp.send('Target.closeTarget', { targetId: t.targetId })
        } catch (err) {
          this.log(`could not close an earlier check tab: ${errText(err)}`)
        }
      }
    } catch (err) {
      this.log(`skipped closing earlier check tabs: ${errText(err)}`)
    } finally {
      await cdp?.detach().catch(() => {})
    }
  }
}

/** The title a retained check tab carries: the owner reads it, and the cleanup closes only un-owned tabs with exactly this title. */
export const CHECK_TAB_TITLE = 'Pilcrino: pass the check'

async function markCheckTab(page) {
  const cdp = await page.createCDPSession()
  try {
    const res = await cdp.send('Runtime.evaluate', { expression: `document.title = ${JSON.stringify(CHECK_TAB_TITLE)}` })
    if (res?.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text ?? 'Runtime.evaluate threw')
  } finally {
    await cdp.detach().catch(() => {})
  }
}

/** Every registry built in this process, so the check-tab cleanup never closes a tab any of them owns. */
const registries = new Set()

const errText = (err) => String(err?.message ?? err).slice(0, 300)

/** Diagnostics go to stderr: stdout is the MCP channel. */
const stderrLog = (msg) => { process.stderr.write(`pilcrino-browser: ${msg}\n`) }

async function targetIdOf(page) {
  const cdp = await page.createCDPSession()
  try {
    const { targetInfo } = await cdp.send('Target.getTargetInfo')
    if (!targetInfo?.targetId) throw new Error('no target id')
    return targetInfo.targetId
  } finally {
    await cdp.detach().catch(() => {})
  }
}

const parseUrl = (url) => { try { return new URL(url) } catch { return null } }

/** A Google page on any google.<tld> host: the SERP capture's tab, the only one retained on a check. */
export function isGoogleUrl(url) {
  const u = parseUrl(url)
  return !!u && /^https?:$/.test(u.protocol) && /(^|\.)google\.[a-z.]+$/.test(u.hostname)
}

/**
 * Why a SERP capture value keeps its tab open: `blocked` for an object with a
 * non-empty `blocked` field (Google's check), `noResults` for an empty
 * `topResults` array, otherwise null.
 */
export function checkKind(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.blocked) return 'blocked'
  if (Array.isArray(value.topResults) && value.topResults.length === 0) return 'noResults'
  return null
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
