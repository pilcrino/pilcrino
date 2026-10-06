import { createSession } from './session.mjs'
import { loginStatus, validSites } from './login.mjs'

/**
 * status <sites...> prints {site: state}; open-login <sites...> prints
 * {opened, mode, next} and never connects (it quits the Pilcrino Chrome and
 * opens a plain one, see signin.mjs). Exit 1 on any failure, with
 * {error, message} on stdout.
 */
export async function runCli(cmd, sites) {
  // PILCRINO_CHROME in the environment names Chrome when the console runs this
  // from its own package directory (see chrome.mjs findChrome).
  const session = createSession()
  try {
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
