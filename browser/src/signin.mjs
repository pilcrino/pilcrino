import * as nodeFs from 'node:fs'
import { spawn as nodeSpawn } from 'node:child_process'
import { codedError, isProfileRunning, probeIdentity, sleepMs } from './chrome.mjs'
import { SIGN_IN_URLS } from './login.mjs'

export const SIGNIN_NEXT = 'Sign in, then quit that Chrome window with Cmd+Q. Pilcrino restarts the browser on its next call.'

/**
 * Sends CDP `Browser.close` to the browser endpoint and resolves once Chrome
 * answers, drops the socket, or the timeout passes. It never rejects: whether
 * Chrome really quit is what the caller's wait decides.
 */
export function closeOverCdp(wsUrl, { WebSocketImpl = globalThis.WebSocket, timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    let ws = null
    let timer = null
    const done = () => {
      clearTimeout(timer)
      try { ws?.close() } catch {}
      resolve()
    }
    timer = setTimeout(done, timeoutMs)
    try {
      ws = new WebSocketImpl(wsUrl)
    } catch {
      done()
      return
    }
    ws.onopen = () => {
      try { ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })) } catch { done() }
    }
    ws.onmessage = done
    ws.onclose = done
    ws.onerror = done
  })
}

/** Google first (the other sites' Google sign-in buttons need it), then the rest in the order asked. */
export function signInOrder(sites) {
  const unique = [...new Set(sites)]
  return [...unique.filter((s) => s === 'google'), ...unique.filter((s) => s !== 'google')]
}

/**
 * Opens the sign-in pages in a Chrome on the Pilcrino profile WITHOUT the
 * remote debugging port: Google refuses to sign in a browser under remote
 * control. The Pilcrino Chrome, when it runs with the port, is closed first
 * (CDP Browser.close) and waited for until no Chrome runs on the profile (the
 * process list decides, not DevToolsActivePort), so the plain launch owns the profile
 * rather than handing its pages to the controlled instance. A plain window
 * already open on the profile simply receives the new pages. The owner signs
 * in and quits that Chrome; the next tool call relaunches the profile with the
 * port, and `connectChrome` refuses to launch while the plain one still runs.
 */
export async function openSignIn(sites, {
  profile,
  exe,
  fs = nodeFs,
  fetch = globalThis.fetch,
  spawn = nodeSpawn,
  sleep = sleepMs,
  now = Date.now,
  closeBrowser = closeOverCdp,
  isProfileRunning: running = isProfileRunning,
  quitTimeoutMs = 10000,
  spawnTimeoutMs = 5000,
} = {}) {
  const ordered = signInOrder(sites)
  const wsUrl = await probeIdentity(profile, { fs, fetch })
  if (wsUrl) {
    await closeBrowser(wsUrl)
    const start = now()
    // Only the process list decides: Chrome leaves DevToolsActivePort behind
    // on Browser.close (seen live 2026-10-05), and a stale file is harmless
    // because the identity check refuses it.
    while (running(profile)) {
      if (now() - start >= quitTimeoutMs) {
        throw codedError('browser_unavailable', `The Pilcrino browser did not quit within ${quitTimeoutMs / 1000}s, so the sign-in window could not open. Quit it with Cmd+Q, then try again.`)
      }
      await sleep(250)
    }
  }
  fs.mkdirSync?.(profile, { recursive: true })
  const urls = ordered.map((site) => SIGN_IN_URLS[site])
  const child = spawn(exe, [`--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...urls], { detached: true, stdio: 'ignore' })
  // A bad executable fails asynchronously (ENOENT, EACCES): wait for the
  // child's spawn or error before reporting the pages as opened. Bounded, so
  // a child that reports neither cannot hang the call.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, spawnTimeoutMs)
    child.once?.('spawn', () => { clearTimeout(timer); resolve() })
    child.once?.('error', (err) => {
      clearTimeout(timer)
      reject(codedError('chrome_not_found', `Google Chrome could not start from ${exe} (${err?.code ?? err?.message ?? err}). Set browser.executable in blog-ops/config.yaml to the Chrome binary.`, { executable: exe }))
    })
  })
  child.on?.('error', () => {})
  child.unref?.()
  return { opened: ordered.map((site) => ({ site, url: SIGN_IN_URLS[site] })), mode: 'plain', next: SIGNIN_NEXT }
}
