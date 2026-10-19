#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { ensureInstalled, installAsync, isInstalled, releaseLockIfMine } from './src/deps.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const [cmd, ...rest] = process.argv.slice(2)

if (cmd === undefined && !isInstalled(root)) {
  // First start after a plugin update: node_modules is missing or from another
  // version. Answer the MCP handshake from a dependency-free shim while npm runs,
  // or Claude Code kills the server after 30 seconds mid-install.
  const { runBootstrap } = await import('./src/bootstrap.mjs')
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  let child
  let childClosed = Promise.resolve()
  let quitting = false
  const quit = async () => {
    if (quitting) return
    quitting = true
    // npm may still be writing node_modules: the lock stays until it has exited,
    // or another installer could start on the same tree.
    if (child) {
      const c = child
      try { c.kill('SIGTERM') } catch {}
      let timer
      const closed = await Promise.race([
        childClosed.then(() => true),
        new Promise((r) => { timer = setTimeout(() => r(false), 10_000) }),
      ])
      clearTimeout(timer)
      if (!closed) {
        try { c.kill('SIGKILL') } catch {}
        await childClosed
      }
    }
    releaseLockIfMine(root)
    process.exit(0)
  }
  process.on('SIGTERM', quit)
  process.on('SIGINT', quit)
  const { done } = runBootstrap({
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    version,
    // The server module is imported here, before the shim lets go of stdin, so a
    // broken install leaves the shim answering with the reason and retrying.
    install: async () => {
      // Shutting down: no new npm run; the pending exit ends the process.
      if (quitting) return new Promise(() => {})
      try {
        await installAsync(root, {
          onSpawn: (c) => {
            child = c
            // 'close' is the end of npm; an 'error' without a pid is a spawn that never started.
            childClosed = new Promise((r) => {
              c.once('close', r)
              c.once('error', () => { if (c.pid === undefined) r() })
            })
          },
        })
      } finally {
        child = undefined
      }
      return import('./src/server.mjs')
    },
    // The SDK Server keeps no "initialized" gate: its tools/list and tools/call
    // handlers answer without having seen initialize (checked against
    // @modelcontextprotocol/sdk 1.32.1, server/index.js and shared/protocol.js).
    // What initialize would have stored is the client's capabilities, used only
    // for server-to-client requests (sampling, elicitation, roots), which this
    // server never makes. So no initialize is replayed: the real server simply
    // starts reading the same stdin, from the bytes the shim left unread.
    handover: async ({ result }) => {
      process.off('SIGTERM', quit)
      process.off('SIGINT', quit)
      await result.startServer()
      // The shim paused stdin; a new 'data' listener does not resume a paused stream.
      process.stdin.resume()
    },
    onEnd: quit,
  })
  done.catch((err) => {
    process.stderr.write(`pilcrino-browser: could not start the server: ${err?.message ?? err}\n`)
    process.exit(1)
  })
} else {
  try {
    ensureInstalled(root)
  } catch (err) {
    process.stderr.write(`${err.message}\n`)
    process.exit(1)
  }

  // Dynamic imports: the packages exist only after ensureInstalled.
  if (cmd === 'install') {
    process.exit(0)
  } else if (cmd === undefined) {
    const { startServer } = await import('./src/server.mjs')
    await startServer()
  } else if (cmd === 'status' || cmd === 'open-login' || cmd === 'close-login' || cmd === 'quit') {
    const { runCli } = await import('./src/cli.mjs')
    process.exit(await runCli(cmd, rest))
  } else {
    process.stderr.write(`usage: node bin.mjs [status <sites...> | open-login <sites...> | close-login | quit | install]\n`)
    process.exit(2)
  }
}
