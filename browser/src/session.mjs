import * as nodeFs from 'node:fs'
import { join } from 'node:path'
import { connectChrome, findChrome, profileDir, readExecutableOverride } from './chrome.mjs'
import { outRoots } from './paths.mjs'
import { openSignIn } from './signin.mjs'
import { TabRegistry, leftTabStore } from './tabs.mjs'

/**
 * One Chrome connection per server process. The MCP SDK dispatches tool calls
 * concurrently, so the first calls share ONE connecting promise; a failed
 * attempt clears it so the next call retries. A disconnect clears only the
 * connection it belongs to. `deps.connect` is a test seam returning
 * `{ browser, registry }`.
 */
export function createSession({ cwd = process.cwd(), env = process.env } = {}, deps = {}) {
  const profile = profileDir()
  const roots = outRoots({ env, cwd })
  let current = null // { browser, registry }
  let connecting = null

  const exe = () => findChrome({ env, override: readExecutableOverride(cwd, nodeFs) })

  async function connect() {
    const puppeteer = (await import('puppeteer-core')).default
    const { browser } = await connectChrome({ dir: profile, exe: exe(), puppeteer })
    return { browser, registry: new TabRegistry(browser) }
  }

  async function ensure() {
    if (current && current.browser.connected) return current
    if (!connecting) {
      connecting = (deps.connect ?? connect)()
        .then((entry) => {
          entry.browser.on('disconnected', () => { if (current === entry) current = null })
          current = entry
          return entry
        })
        .finally(() => { connecting = null })
    }
    return connecting
  }

  return {
    profile,
    roots,
    async getBrowser() { return (await ensure()).browser },
    async getRegistry() { return (await ensure()).registry },
    /**
     * Sign-in is a profile-level operation, not a tab: it quits the Pilcrino
     * Chrome and opens a plain one (signin.mjs). The connection this session
     * held drops with that Chrome, and its disconnect clears it, so the next
     * call reconnects. `deps.openSignIn` is a test seam.
     */
    async openSignIn(sites) { return (deps.openSignIn ?? openSignIn)(sites, { profile, exe: exe() }) },
    /** The id of the one tab left open on a site's check (TabRegistry.leaveOpen); `deps.leftTabs` is a test seam. */
    leftTabs: deps.leftTabs ?? leftTabStore(join(profile, 'PilcrinoLeftTab')),
    async closeOwned() { if (current) await current.registry.closeAll().catch(() => {}) },
  }
}
