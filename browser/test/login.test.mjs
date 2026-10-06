import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, loginStatus, probeSite } from '../src/login.mjs'

const ev = (o) => ({ finalUrl: '', hasSelector: new Set(), bodyText: '', redditMe: null, timedOut: false, navFailed: false, recaptchaFrame: false, ...o })

test('navigation failure is error for every site', () => {
  for (const site of ['google', 'reddit', 'x', 'linkedin']) assert.equal(decide(site, ev({ navFailed: true, finalUrl: 'about:blank' })), 'error')
})

test('google', () => {
  assert.equal(decide('google', ev({ finalUrl: 'https://myaccount.google.com/' })), 'signed_in')
  assert.equal(decide('google', ev({ finalUrl: 'https://accounts.google.com/v3/signin/identifier?x' })), 'signed_out')
  assert.equal(decide('google', ev({ finalUrl: 'https://accounts.google.com/ServiceLogin' })), 'signed_out')
  assert.equal(decide('google', ev({ finalUrl: 'https://www.google.com/sorry/index', bodyText: 'Our systems have detected unusual traffic' })), 'blocked')
  assert.equal(decide('google', ev({ finalUrl: 'https://accounts.google.com/', recaptchaFrame: true })), 'blocked')
  assert.equal(decide('google', ev({ finalUrl: 'https://accounts.google.com/', timedOut: true })), 'error')
})

test('reddit', () => {
  assert.equal(decide('reddit', ev({ redditMe: { status: 200, json: { data: { name: 'u' } } } })), 'signed_in')
  assert.equal(decide('reddit', ev({ redditMe: { status: 200, json: {} } })), 'signed_out')
  assert.equal(decide('reddit', ev({ redditMe: { status: 401, json: null } })), 'signed_out')
  assert.equal(decide('reddit', ev({ redditMe: { status: 200, json: null }, bodyText: 'Prove your humanity' })), 'blocked')
  assert.equal(decide('reddit', ev({ redditMe: { status: 403, json: null } })), 'blocked')
  assert.equal(decide('reddit', ev({ redditMe: null, timedOut: true })), 'error')
})

test('x', () => {
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/home', hasSelector: new Set(['[data-testid="SideNav_AccountSwitcher_Button"]']) })), 'signed_in')
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/i/flow/login?redirect_after_login=%2Fhome' })), 'signed_out')
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/login' })), 'signed_out')
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/i/jf/onboarding/web?redirect_after_login=%2Fhome&mode=login' })), 'signed_out')
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/i/jf/onboarding/web?mode=login' })), 'signed_out')
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/somewhere?redirect_after_login=%2Fhome' })), 'signed_out')
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/i/jf/onboarding/web?mode=signup', timedOut: true })), 'blocked')
  assert.equal(decide('x', ev({ finalUrl: 'https://x.com/home', timedOut: true })), 'blocked')
  assert.equal(decide('x', ev({ finalUrl: '', timedOut: true })), 'error')
})

test('linkedin', () => {
  assert.equal(decide('linkedin', ev({ finalUrl: 'https://www.linkedin.com/feed/', hasSelector: new Set(['.global-nav__me']) })), 'signed_in')
  assert.equal(decide('linkedin', ev({ finalUrl: 'https://www.linkedin.com/authwall?x' })), 'signed_out')
  assert.equal(decide('linkedin', ev({ finalUrl: 'https://www.linkedin.com/checkpoint/lg/login' })), 'signed_out')
  assert.equal(decide('linkedin', ev({ finalUrl: 'https://www.linkedin.com/feed/', timedOut: true })), 'blocked')
})

// Fake page: `script` maps a poll count to what the page reports.
function fakePage({ goto, urls, has = () => false, evaluate, frames = () => [] }) {
  let polls = 0
  const page = {
    closed: false,
    goto: goto ?? (async () => {}),
    url: () => urls(polls++),
    $: async (sel) => (has(sel, polls) ? {} : null),
    evaluate: evaluate ?? (async () => ''),
    frames: () => frames(polls).map((u) => ({ url: () => u })),
    close: async () => { page.closed = true },
  }
  return page
}
const browserOf = (page, calls = []) => ({ newPage: async (opts) => { calls.push(opts); return page } })

test('probeSite: navigation throws is error, and the page is closed', async () => {
  const page = fakePage({ goto: async () => { throw new Error('net::ERR') }, urls: () => 'about:blank' })
  assert.equal(await probeSite(browserOf(page), 'x', { timeoutMs: 1500 }), 'error')
  assert.equal(page.closed, true)
})

test('probeSite: X account switcher appearing on the third poll is signed_in', async () => {
  const page = fakePage({ urls: () => 'https://x.com/home', has: (_sel, polls) => polls >= 3 })
  assert.equal(await probeSite(browserOf(page), 'x', { timeoutMs: 5000 }), 'signed_in')
})

test('probeSite: LinkedIn redirect to /authwall on the second poll is signed_out', async () => {
  const page = fakePage({ urls: (n) => (n >= 1 ? 'https://www.linkedin.com/authwall?trk=x' : 'https://www.linkedin.com/feed/') })
  assert.equal(await probeSite(browserOf(page), 'linkedin', { timeoutMs: 5000 }), 'signed_out')
})

test('probeSite: Google recaptcha frame is blocked', async () => {
  const page = fakePage({ urls: () => 'https://accounts.google.com/', frames: () => ['https://www.google.com/recaptcha/api2/anchor?k=1'] })
  assert.equal(await probeSite(browserOf(page), 'google', { timeoutMs: 5000 }), 'blocked')
})

test('probeSite: Google delayed redirect to myaccount is signed_in, not blocked', async () => {
  const page = fakePage({ urls: (n) => (n >= 2 ? 'https://myaccount.google.com/' : 'https://accounts.google.com/') })
  assert.equal(await probeSite(browserOf(page), 'google', { timeoutMs: 5000 }), 'signed_in')
})

test('probeSite: Reddit evaluate that never resolves is error within the deadline', async () => {
  const page = fakePage({ urls: () => 'https://www.reddit.com/', evaluate: () => new Promise(() => {}) })
  const t0 = Date.now()
  assert.equal(await probeSite(browserOf(page), 'reddit', { timeoutMs: 1500 }), 'error')
  assert.ok(Date.now() - t0 < 1500 + 3000 + 500)
})

test('probeSite: a rejecting newPage is error with no unhandled rejection', async () => {
  const browser = { newPage: () => Promise.reject(new Error('Target closed')) }
  assert.equal(await probeSite(browser, 'x', { timeoutMs: 1000 }), 'error')
})

test('probeSite: a page landing after the creation deadline is closed', async () => {
  const page = fakePage({ urls: () => 'https://x.com/home' })
  let resolvePage
  const browser = { newPage: () => new Promise((r) => { resolvePage = r }) }
  assert.equal(await probeSite(browser, 'x', { timeoutMs: 0 }), 'error')
  resolvePage(page)
  await new Promise((r) => setImmediate(r))
  assert.equal(page.closed, true)
})

test('probeSite: X onboarding login URL is signed_out at once, without the full hold', async () => {
  const page = fakePage({ urls: () => 'https://x.com/i/jf/onboarding/web?redirect_after_login=%2Fhome&mode=login' })
  const t0 = Date.now()
  assert.equal(await probeSite(browserOf(page), 'x', { timeoutMs: 15000 }), 'signed_out')
  assert.ok(Date.now() - t0 < 1000, `took ${Date.now() - t0} ms`)
})

test('probeSite: probe tabs are created in the background', async () => {
  const calls = []
  const page = fakePage({ urls: () => 'https://x.com/login' })
  await probeSite(browserOf(page, calls), 'x', { timeoutMs: 1000 })
  assert.deepEqual(calls, [{ background: true }])
})

test('loginStatus: sites are probed in parallel', async () => {
  const calls = []
  // Every page stays undecided, so each probe holds for its whole 1.5 s budget.
  const browser = { newPage: async (opts) => { calls.push(opts); return fakePage({ urls: () => 'https://x.com/home' }) } }
  const t0 = Date.now()
  const out = await loginStatus(browser, ['x', 'linkedin', 'google'], { timeoutMs: 1500 })
  const took = Date.now() - t0
  assert.equal(calls.length, 3)
  assert.ok(calls.every((c) => c?.background === true))
  assert.ok(took < 3000, `took ${took} ms; sequential would be at least 4500`)
  assert.deepEqual(out, { x: 'blocked', linkedin: 'blocked', google: 'error' })
})
