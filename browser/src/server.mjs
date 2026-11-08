import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createSession } from './session.mjs'
import { captureTool, runTool, screenshotTool } from './pagetools.mjs'
import { resolveOutFile } from './paths.mjs'
import { checkTabUrl, clickTool, isBingUrl, isGoogleUrl, navigateTool, typeTool, waitTool } from './tabs.mjs'
import { loginStatus, validSites, SITES } from './login.mjs'
import { codedError } from './chrome.mjs'
import { serpSearchTool } from './serp.mjs'
import { createBridge, extensionOrigin, PROTOCOL_VERSION } from './bridge.mjs'
import { refreshExtensionCopy } from './extension-copy.mjs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EXTENSION_SRC = join(PLUGIN_ROOT, 'extension')

/** The plugin version from .claude-plugin/plugin.json, or the browser package's own when that file is absent (tests). */
export function pluginVersion(root = PLUGIN_ROOT, fs = { readFileSync }) {
  for (const f of [join(root, '.claude-plugin', 'plugin.json'), join(root, 'browser', 'package.json')]) {
    try { return JSON.parse(fs.readFileSync(f, 'utf8')).version } catch {}
  }
  return '0'
}

const text = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] })
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ code: err.code ?? 'error', message: String(err.message ?? err).slice(0, 500) }) }] })

export function buildServer(session, { bridge } = {}) {
  const server = new McpServer({ name: 'pilcrino-browser', version: '0.41.0' })
  const guard = (fn) => async (args) => {
    try {
      return text(await fn(args))
    } catch (err) {
      if (/Target closed|Session closed|Connection closed/.test(err?.message ?? '')) err.code = 'browser_unavailable'
      return fail(err)
    }
  }
  const page = async (tabId) => (await session.getRegistry()).page(tabId)
  // outFile is checked before the tab lookup, so a bad path never launches Chrome.
  const checkOut = (outFile) => resolveOutFile(outFile, session.roots, { profile: session.profile })
  const tool = (name, description, inputSchema, fn) => server.registerTool(name, { description, inputSchema }, guard(fn))

  tool('tabs', 'List, open or close tabs owned by this session. Returns ids, urls and titles only.', { action: z.enum(['list', 'open', 'close']), url: z.string().optional(), tabId: z.string().optional() }, async ({ action, url, tabId }) => {
    // The url is checked before the registry, so a refused scheme never launches Chrome.
    if (action === 'open') checkTabUrl(url ?? 'about:blank')
    const reg = await session.getRegistry()
    if (action === 'list') return reg.listWithTitles()
    if (action === 'open') return [await reg.open(url ?? 'about:blank')]
    return reg.close(tabId)
  })
  tool('navigate', 'Navigate an owned tab. Returns final url, title and HTTP status.', { tabId: z.string(), url: z.string(), waitUntil: z.enum(['domcontentloaded', 'load', 'networkidle0', 'networkidle2']).optional(), timeoutMs: z.number().optional() }, async ({ tabId, url, waitUntil, timeoutMs }) => {
    checkTabUrl(url)
    return navigateTool(await page(tabId), url, { waitUntil, timeoutMs })
  })
  tool('capture', 'Run a script (async function body that returns a JSON value) in an owned tab and write the result to outFile. Returns {path, bytes, items}. The value never enters this result. Only in a Google tab: when the value is an object with a `blocked` field (Google\'s unusual-traffic check) or an empty `topResults` array, the result adds `blocked: true` or `noResults: true`, plus `leftOpen: true`: earlier tabs left on Google\'s check page are closed, this tab is left open for the owner, its window comes to the front, and it is no longer owned by this session (later calls on that tabId fail with not_owned; open a new tab to retry). On a Bing tab only a `blocked` value does this; an empty `topResults` on Bing is a query with no results and adds nothing.', { tabId: z.string(), script: z.string(), outFile: z.string() }, async ({ tabId, script, outFile }) => {
    checkOut(outFile)
    const reg = await session.getRegistry()
    const p = reg.page(tabId)
    const url = p.url()
    const res = await captureTool(p, script, outFile, session, { googleCheck: isGoogleUrl(url), bingCheck: isBingUrl(url) })
    const capturedHref = p.url()
    if (res.blocked || res.noResults) Object.assign(res, await reg.leaveOpen(tabId, capturedHref))
    return res
  })
  tool('serp_search', 'Search Google through the Pilcrino extension in the owner\'s own browser and write the results to outFile as one JSON object (engine, query, url, serpFeatures, topResults, title, text, links). Returns {path, bytes, items, engine} and blocked: true when Google showed a check in the owner\'s browser (the tab is left open there; the file says unusual_traffic or consent). Fails with extension_not_connected when no extension answered within 30 s, extension_timeout when one was connected but did not reply, extension_outdated when the loaded extension has another protocol version; each carries a one-line hint for the owner.', { query: z.string(), outFile: z.string(), locale: z.object({ hl: z.string().optional(), gl: z.string().optional() }).optional() }, async (args) => {
    if (!bridge) throw codedError('extension_not_connected', 'The Pilcrino extension bridge is not running in this server.')
    return serpSearchTool(bridge, args, session)
  })
  tool('run', 'Run a script in an owned tab for its side effects. The value is discarded.', { tabId: z.string(), script: z.string() }, async ({ tabId, script }) => runTool(await page(tabId), script))
  tool('screenshot', 'Write PNG screenshots of an owned tab under outFile. mode: viewport (default), full, scroll.', { tabId: z.string(), outFile: z.string(), mode: z.enum(['viewport', 'full', 'scroll']).optional() }, async ({ tabId, outFile, mode }) => {
    checkOut(outFile)
    return screenshotTool(await page(tabId), outFile, mode ?? 'viewport', session)
  })
  tool('click', 'Click a selector or a point in an owned tab.', { tabId: z.string(), selector: z.string().optional(), x: z.number().optional(), y: z.number().optional() }, async ({ tabId, ...rest }) => clickTool(await page(tabId), rest))
  tool('type', 'Type text into a selector in an owned tab.', { tabId: z.string(), selector: z.string(), text: z.string(), clear: z.boolean().optional() }, async ({ tabId, selector, text: t, clear }) => typeTool(await page(tabId), selector, t, clear))
  tool('wait', 'Wait for milliseconds or for a selector in an owned tab. ms is capped at 30000; for a longer delay, call wait again.', { tabId: z.string(), ms: z.number().optional(), selector: z.string().optional(), timeoutMs: z.number().optional() }, async ({ tabId, ...rest }) => waitTool(await page(tabId), rest))
  tool('login_status', 'Per site: signed_in, signed_out, blocked or error. Sites: google, reddit, x, linkedin.', { sites: z.array(z.enum(SITES)) }, async ({ sites }) => loginStatus(await session.getBrowser(), validSites(sites)))
  tool('open_login', 'Quit the Pilcrino browser and open the sign-in pages in a Chrome window on its profile without remote control (Google refuses sign-in under remote control). Returns {opened, mode, next}: tell the owner `next`, to sign in and say when they are done, then call close_login. Until that window is closed, every other tool fails with signin_window_open.', { sites: z.array(z.enum(SITES)) }, async ({ sites }) => session.openSignIn(validSites(sites)))
  tool('close_login', 'Quit the sign-in window that open_login opened, gracefully, so the Google, Reddit and X sign-ins are kept. Works while other tools fail with signin_window_open. Returns {closed, detail}: closed false with a detail when no sign-in window is open (not an error) or when it did not quit within 10 seconds (then relay the detail: the owner quits it with Cmd+Q on a Mac, Alt+F4 on Windows, Ctrl+Shift+W on Linux).', {}, async () => session.closeSignIn())
  return server
}

export async function startServer() {
  const session = createSession()
  const version = pluginVersion()
  const log = (msg) => process.stderr.write(`pilcrino-browser: ${msg}\n`)
  // The extension bridge listens from process start, so the extension has
  // connected long before the first search (its rescan is 5 s, or 30 s asleep).
  // Without the plugin's extension/ folder (a browser/ copied on its own) the
  // server runs without a bridge and serp_search says so.
  let bridge = null
  try {
    bridge = createBridge({ origin: extensionOrigin(join(EXTENSION_SRC, 'manifest.json')), pluginVersion: version })
    if ((await bridge.listen()) === null) log('no free bridge port, too many Pilcrino sessions')
    // ~/.pilcrino/extension follows the plugin's copy; the result is logged, never awaited by a tool call.
    refreshExtensionCopy({ src: EXTENSION_SRC, protocol: PROTOCOL_VERSION, pluginVersion: version })
      .then((r) => { if (r.action !== 'kept') log(`extension copy ${r.action} (${r.stamp?.plugin ?? '?'})`) })
      .catch((err) => log(`extension copy not refreshed: ${err?.message ?? err}`))
  } catch (err) {
    log(`extension bridge not started: ${err?.message ?? err}`)
    bridge = null
  }
  const server = buildServer(session, { bridge })
  const transport = new StdioServerTransport()
  const bye = async () => { if (bridge) await bridge.close().catch(() => {}); await session.closeOwned(); process.exit(0) }
  process.stdin.on('close', bye)
  process.on('SIGTERM', bye)
  process.on('SIGINT', bye)
  await server.connect(transport)
}
