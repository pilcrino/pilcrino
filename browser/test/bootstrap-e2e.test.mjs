import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const browser = join(dirname(fileURLToPath(import.meta.url)), '..')
const realModules = join(browser, 'node_modules')
const skip = existsSync(join(realModules, '@modelcontextprotocol', 'sdk'))
  ? false
  : 'browser/node_modules is missing: run npm install in browser/ to run this test'

test('first start without node_modules answers initialize at once and hands over to the real server after the install', { skip, timeout: 30_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-boot-'))
  const root = join(dir, 'browser')
  mkdirSync(root)
  for (const f of ['bin.mjs', 'package.json', 'package-lock.json']) cpSync(join(browser, f), join(root, f))
  cpSync(join(browser, 'src'), join(root, 'src'), { recursive: true })
  // A fake npm (PILCRINO_NPM_CLI, run under this node on every platform): slow,
  // then links the real packages in one by one, so the stamp the installer
  // writes lands in the temp folder and not in the real node_modules.
  const fakeNpm = join(dir, 'fake-npm-cli.js')
  writeFileSync(fakeNpm, `const fs = require('node:fs'); const path = require('node:path')
setTimeout(() => {
  fs.mkdirSync('node_modules', { recursive: true })
  for (const e of fs.readdirSync(${JSON.stringify(realModules)})) fs.symlinkSync(path.join(${JSON.stringify(realModules)}, e), path.join('node_modules', e), 'junction')
}, 1500)
`)

  const t0 = Date.now()
  const child = spawn(process.execPath, [join(root, 'bin.mjs')], {
    cwd: root,
    env: { ...process.env, PILCRINO_NPM_CLI: fakeNpm },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (c) => { stderr += c })
  const messages = []
  const waiters = []
  let out = ''
  child.stdout.on('data', (c) => {
    out += c
    let nl
    while ((nl = out.indexOf('\n')) !== -1) {
      const line = out.slice(0, nl)
      out = out.slice(nl + 1)
      messages.push({ at: Date.now() - t0, msg: JSON.parse(line) }) // every stdout line must be JSON
      for (const w of waiters.splice(0)) w()
    }
  })
  const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`)
  const waitFor = async (pred) => {
    for (;;) {
      const hit = messages.find((m) => pred(m.msg))
      if (hit) return hit
      await new Promise((r) => waiters.push(r))
    }
  }

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } } })
    const init = await waitFor((m) => m.id === 1)
    assert.ok(init.at < 5000, `initialize answered after ${init.at} ms`)
    assert.equal(init.msg.result.protocolVersion, '2025-06-18')
    assert.equal(init.msg.result.serverInfo.name, 'pilcrino-browser')
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const early = await waitFor((m) => m.id === 2)
    assert.deepEqual(early.msg.result.tools.map((t) => t.name), ['install_status'])
    send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'install_status', arguments: {} } })
    const status = await waitFor((m) => m.id === 5)
    assert.match(status.msg.result.content[0].text, /is installing its packages after a plugin update \(\d+ s so far\)/)

    const changed = await waitFor((m) => m.method === 'notifications/tools/list_changed')
    assert.ok(changed.at >= 1500, `list_changed came before the install finished (${changed.at} ms)`)
    assert.ok(early.at < changed.at)

    send({ jsonrpc: '2.0', id: 3, method: 'tools/list' })
    const late = await waitFor((m) => m.id === 3)
    const names = late.msg.result.tools.map((t) => t.name)
    assert.ok(names.includes('login_status'), names.join(','))
    assert.equal(names.length, 11)

    // The real server also runs tools without having seen initialize itself.
    // outFile is validated before any tab lookup, so no Chrome is launched.
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'capture', arguments: { tabId: 't1', script: 'return 1', outFile: 'relative.json' } } })
    const call = await waitFor((m) => m.id === 4)
    assert.equal(call.msg.result.isError, true)
    assert.equal(JSON.parse(call.msg.result.content[0].text).code, 'bad_path')

    assert.equal(readFileSync(join(root, 'node_modules', '.pilcrino-installed'), 'utf8'), JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version)
    assert.equal(existsSync(join(root, '.install.lock')), false)
  } catch (err) {
    err.message += `\nserver stderr:\n${stderr}`
    throw err
  } finally {
    const exited = new Promise((r) => child.once('exit', r))
    child.stdin.end()
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))])
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
})
