export const SITES = ['google', 'reddit', 'x', 'linkedin']

export const PROBE_URLS = {
  google: 'https://accounts.google.com/',
  reddit: 'https://www.reddit.com/',
  x: 'https://x.com/home',
  linkedin: 'https://www.linkedin.com/feed/',
}

export const SIGN_IN_URLS = {
  google: 'https://accounts.google.com/',
  reddit: 'https://www.reddit.com/login/',
  x: 'https://x.com/i/flow/login',
  linkedin: 'https://www.linkedin.com/login',
}

const SIGNALS = {
  x: '[data-testid="SideNav_AccountSwitcher_Button"]',
  linkedin: '.global-nav__me, [data-control-name="nav.settings"]',
}

function pathOf(url) {
  try { return new URL(url) } catch { return null }
}

/** Pure decision over collected evidence. Only signed_in is a pass for the flows. */
export function decide(site, ev) {
  if (ev.navFailed) return 'error'
  const u = pathOf(ev.finalUrl)
  const path = u?.pathname ?? ''
  const host = u?.hostname ?? ''
  switch (site) {
    case 'google':
      if (/unusual traffic/i.test(ev.bodyText) || path.startsWith('/sorry') || ev.recaptchaFrame) return 'blocked'
      if (host === 'myaccount.google.com') return 'signed_in'
      if (host === 'accounts.google.com' && (path.startsWith('/signin') || path.startsWith('/ServiceLogin') || path.startsWith('/v3/signin'))) return 'signed_out'
      return ev.timedOut || !u ? 'error' : 'blocked'
    case 'reddit': {
      if (/prove your humanity/i.test(ev.bodyText)) return 'blocked'
      const me = ev.redditMe
      if (!me) return 'error'
      if (me.status === 200 && me.json && me.json.data && typeof me.json.data.name === 'string') return 'signed_in'
      if (me.status === 401 || (me.status === 200 && me.json && !me.json.data?.name)) return 'signed_out'
      return 'blocked'
    }
    case 'x': {
      // Signed-out X lands on /login, /i/flow/login, or (2026-10) the
      // /i/jf/onboarding flow in login mode; all of them carry redirect_after_login.
      const q = u?.searchParams
      if (path === '/login' || path.startsWith('/i/flow/login') || q?.has('redirect_after_login') || (path.startsWith('/i/jf/onboarding') && q?.get('mode') === 'login')) return 'signed_out'
      if (ev.hasSelector.has(SIGNALS.x)) return 'signed_in'
      return u ? 'blocked' : 'error'
    }
    case 'linkedin':
      if (path.startsWith('/login') || path.startsWith('/authwall') || path.startsWith('/checkpoint')) return 'signed_out'
      if (ev.hasSelector.has('.global-nav__me') || ev.hasSelector.has('[data-control-name="nav.settings"]')) return 'signed_in'
      return u ? 'blocked' : 'error'
    default:
      throw new Error(`unknown site ${site}`)
  }
}

/**
 * Races a promise against a timeout that resolves `fallback`. The race is what
 * the caller awaits, so a rejection surfaces there and nowhere else; the timer
 * is cleared either way.
 */
const withDeadline = (promise, ms, fallback) => {
  let timer
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Google stops polling only on a real signal: the account host, a sign-in path, or an actual challenge. A plain accounts.google.com landing is still undecided. */
function googleDecided(ev) {
  const d = decide('google', ev)
  if (d === 'signed_in' || d === 'signed_out') return true
  const path = (() => { try { return new URL(ev.finalUrl).pathname } catch { return '' } })()
  return d === 'blocked' && (/unusual traffic/i.test(ev.bodyText) || path.startsWith('/sorry') || ev.recaptchaFrame)
}

/**
 * Collects evidence for one site inside one deadline. Navigation failure is
 * recorded, not guessed from the URL. Undecided pages keep polling until the
 * deadline so a late client-side redirect (X, LinkedIn) or a late account
 * landing (Google) is seen; a page still undecided at the deadline is blocked
 * for X and LinkedIn and error for Google, which is what the decide table says.
 */
async function collect(page, site, timeoutMs) {
  const ev = { finalUrl: '', hasSelector: new Set(), bodyText: '', redditMe: null, timedOut: false, navFailed: false, recaptchaFrame: false }
  const deadline = Date.now() + timeoutMs
  try {
    await page.goto(PROBE_URLS[site], { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  } catch {
    ev.navFailed = true
    ev.finalUrl = page.url()
    return ev
  }
  if (site === 'reddit') {
    ev.redditMe = await withDeadline(
      page.evaluate(async () => {
        const r = await fetch('/api/me.json', { headers: { Accept: 'application/json' } })
        let json = null
        try { json = await r.json() } catch {}
        return { status: r.status, json }
      }).catch(() => null),
      Math.max(deadline - Date.now(), 1000),
      null,
    )
    ev.bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? '').catch(() => '')
    ev.finalUrl = page.url()
    if (!ev.redditMe && !/prove your humanity/i.test(ev.bodyText)) ev.timedOut = true
    return ev
  }
  const selectors = site === 'x' ? [SIGNALS.x] : site === 'linkedin' ? ['.global-nav__me', '[data-control-name="nav.settings"]'] : []
  while (Date.now() < deadline) {
    ev.finalUrl = page.url()
    for (const sel of selectors) if (await page.$(sel).catch(() => null)) ev.hasSelector.add(sel)
    if (site === 'google') {
      ev.bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? '').catch(() => '')
      ev.recaptchaFrame = page.frames().some((f) => /recaptcha/i.test(f.url()))
      if (googleDecided(ev)) return ev
    } else if (ev.hasSelector.size || decide(site, ev) === 'signed_out') {
      return ev
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  ev.timedOut = true
  ev.finalUrl = page.url()
  return ev
}

/**
 * A probe tab opens in the background so a status check never pulls the
 * owner's focus. Puppeteer's newPage({ background: true }) sends
 * Target.createTarget with background: true and resolves the page by the new
 * target's id.
 */
export function newBackgroundPage(browser) {
  return browser.newPage({ background: true })
}

const ERROR_EV = { navFailed: true, finalUrl: '', hasSelector: new Set(), bodyText: '', redditMe: null, timedOut: true, recaptchaFrame: false }

/** One probe, one deadline covering tab creation, navigation, polling and the page close. */
export async function probeSite(browser, site, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs + 3000
  const left = () => Math.max(deadline - Date.now(), 250)
  let page = null
  let created
  try {
    created = Promise.resolve().then(() => newBackgroundPage(browser))
    page = await withDeadline(created, left(), null)
  } catch {
    return 'error'
  } finally {
    // A page that lands after the creation deadline is closed when it lands.
    created?.then((p) => { if (p !== page) p?.close().catch(() => {}) }).catch(() => {})
  }
  if (!page) return 'error'
  try {
    const ev = await withDeadline(collect(page, site, timeoutMs), left(), ERROR_EV)
    return decide(site, ev)
  } catch {
    return 'error'
  } finally {
    // A page whose close stalls is left to Chrome; the probe still returns within its budget.
    await withDeadline(page.close().catch(() => {}), left(), undefined)
  }
}

/** Sites are probed in parallel, so four sites fit one probe's budget (about 18 s), not four. */
export async function loginStatus(browser, sites, opts = {}) {
  const results = await Promise.all(sites.map((site) => probeSite(browser, site, opts)))
  return Object.fromEntries(sites.map((site, i) => [site, results[i]]))
}

export function validSites(input) {
  const list = Array.isArray(input) ? input : []
  const bad = list.filter((s) => !SITES.includes(s))
  if (bad.length) throw Object.assign(new Error(`unknown sites: ${bad.join(', ')}. Valid: ${SITES.join(', ')}`), { code: 'bad_argument' })
  return list
}
