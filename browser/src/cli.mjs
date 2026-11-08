import { createSession } from './session.mjs'
import { loginStatus, validSites } from './login.mjs'

/**
 * status <sites...> prints {site: state}; open-login <sites...> prints
 * {opened, mode, next} and never connects (it quits the Pilcrino Chrome and
 * opens a plain one, see signin.mjs); close-login prints {closed, detail} and
 * never connects either (it quits that plain window); quit prints
 * {quit, detail} after quitting the Pilcrino Chrome so its profile can be
 * removed (the README's Uninstall section); refresh-extension prints
 * {action, stamp, path} after refreshing ~/.pilcrino/extension. Exit 1 on any failure,
 * with {error, message} on stdout.
 */
export async function runCli(cmd, sites) {
  // PILCRINO_CHROME in the environment names Chrome when the console runs this
  // from its own package directory (see chrome.mjs findChrome).
  const session = createSession()
  try {
    if (cmd === 'refresh-extension') {
      // Copies the plugin's extension/ to ~/.pilcrino/extension when that copy is older (extension-copy.mjs). Needs no Chrome.
      const { refreshExtensionCopy } = await import('./extension-copy.mjs')
      const { PROTOCOL_VERSION } = await import('./bridge.mjs')
      const { pluginVersion } = await import('./server.mjs')
      const { fileURLToPath } = await import('node:url')
      const { dirname, join } = await import('node:path')
      const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'extension')
      const r = await refreshExtensionCopy({ src, protocol: PROTOCOL_VERSION, pluginVersion: pluginVersion() })
      const { defaultExtensionDir } = await import('./extension-copy.mjs')
      process.stdout.write(JSON.stringify({ ...r, path: defaultExtensionDir() }) + '\n')
      return 0
    }
    if (cmd === 'close-login') {
      process.stdout.write(JSON.stringify(await session.closeSignIn()) + '\n')
      return 0
    }
    if (cmd === 'quit') {
      process.stdout.write(JSON.stringify(await session.quitBrowser()) + '\n')
      return 0
    }
    const list = validSites(sites) // before connecting: a typo never launches Chrome
    if (cmd === 'open-login') {
      process.stdout.write(JSON.stringify(await session.openSignIn(list)) + '\n')
      return 0
    }
    const browser = await session.getBrowser()
    const out = await loginStatus(browser, list)
    process.stdout.write(JSON.stringify(out) + '\n')
    browser.disconnect()
    return 0
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.code ?? 'error', message: String(err.message ?? err) }) + '\n')
    return 1
  }
}
