import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createSession } from './session.mjs'
import { captureTool, runTool, screenshotTool } from './pagetools.mjs'
import { resolveOutFile } from './paths.mjs'
import { checkTabUrl, clickTool, navigateTool, typeTool, waitTool } from './tabs.mjs'
import { loginStatus, validSites, SITES } from './login.mjs'

const text = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] })
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ code: err.code ?? 'error', message: String(err.message ?? err).slice(0, 500) }) }] })

export function buildServer(session) {
  const server = new McpServer({ name: 'pilcrino-browser', version: '0.40.0' })
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
  tool('capture', 'Run a script (async function body that returns a JSON value) in an owned tab and write the result to outFile. Returns {path, bytes, items}. The value never enters this result. When the value is an object with a `blocked` field (a site check such as Google\'s unusual-traffic page), the result adds `blocked: true, leftOpen: true`: the tab is left open for the owner to pass the check, its window comes to the front, and it is no longer owned by this session (later calls on that tabId fail with not_owned; open a new tab to retry). Only one such tab is kept: an earlier one left this way is closed.', { tabId: z.string(), script: z.string(), outFile: z.string() }, async ({ tabId, script, outFile }) => {
    checkOut(outFile)
    const reg = await session.getRegistry()
    const res = await captureTool(reg.page(tabId), script, outFile, session)
    if (res.blocked) Object.assign(res, await reg.leaveOpen(tabId, session.leftTabs))
    return res
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
  tool('open_login', 'Quit the Pilcrino browser and open the sign-in pages in a Chrome window on its profile without remote control (Google refuses sign-in under remote control). Returns {opened, mode, next}: tell the owner `next`, to sign in and quit that window with Cmd+Q. Until they quit it, every other tool fails with signin_window_open.', { sites: z.array(z.enum(SITES)) }, async ({ sites }) => session.openSignIn(validSites(sites)))
  return server
}

export async function startServer() {
  const session = createSession()
  const server = buildServer(session)
  const transport = new StdioServerTransport()
  const bye = async () => { await session.closeOwned(); process.exit(0) }
  process.stdin.on('close', bye)
  process.on('SIGTERM', bye)
  process.on('SIGINT', bye)
  await server.connect(transport)
}
