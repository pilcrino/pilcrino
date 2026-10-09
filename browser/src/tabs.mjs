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
   * (closeCheckLeftovers), then this tab stops being owned (so closeAll at the
   * end of the run never closes it and no later call can drive it), its window
   * comes to the front, and only then does it get the CHECK_TAB_TITLE title.
   * The title is the last operation on the tab and nothing after it is needed,
   * because from that moment any run's cleanup may close it. The title is the
   * only mark the cleanup trusts, and it is also what the owner sees on the
   * tab. If setting it fails, the failure is logged and that tab is simply
   * never cleaned up. Nothing is persisted and nothing is locked: two retaining
   * captures at the same time may each leave a tab, which is accepted. Never
   * throws on the cleanup; the capture result stands.
   */
  async leaveOpen(tabId, capturedHref = this.page(tabId).url()) {
    const page = this.page(tabId)
    await this.closeCheckLeftovers()
    this.owned.delete(tabId)
    await page.bringToFront().catch((err) => this.log(`could not bring the check tab to the front: ${errText(err)}`))
    await markCheckTab(page, capturedHref).then((marked) => {
      if (!marked) this.log('left the tab untitled: the page changed after the capture, so it is the owner\'s now')
    }).catch((err) => this.log(`could not title the check tab, it will not be cleaned up later: ${errText(err)}`))
    return { leftOpen: true }
  }

  /**
   * Closes every page target in this Chrome whose title is exactly
   * CHECK_TAB_TITLE and that no registry in this process owns on the same
   * browser. The URL does not matter. A concurrent run's tab (owned by another
   * server process, so invisible here) is never closed, because a tab gets
   * that title only after leaveOpen released it. The target list only names
   * candidates: each one's title is read again right before it is closed, and
   * a candidate whose title changed (the owner passed the check or navigated)
   * or whose lookup fails is left alone. A failed ownership lookup skips the
   * cleanup; every failure is logged, none is thrown.
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
        let now = null
        try {
          now = (await cdp.send('Target.getTargetInfo', { targetId: t.targetId }))?.targetInfo
        } catch (err) {
          this.log(`left an earlier check tab open, its title could not be read again: ${errText(err)}`)
          continue
        }
        if (now?.type !== 'page' || now.title !== CHECK_TAB_TITLE) continue
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

/**
 * Sets the title, only if the page is still at capturedHref, through the page's own connection, so no CDP session has to
 * be detached afterwards: once the title is set the tab may be closed by any
 * run's cleanup, and this run needs nothing more from it.
 */
async function markCheckTab(page, capturedHref) {
  // One evaluate does the check and the write, so the title lands only on the document that was blocked.
  return page.evaluate((title, href) => {
    if (location.href !== href) return false
    document.title = title
    return true
  }, CHECK_TAB_TITLE, capturedHref)
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
