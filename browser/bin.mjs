#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { ensureInstalled } from './src/deps.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const [cmd, ...rest] = process.argv.slice(2)

try {
  ensureInstalled(root)
} catch (err) {
  process.stderr.write(`${err.message}\n`)
  process.exit(1)
}

if (cmd === 'install') {
  process.exit(0)
}

// Dynamic imports: the packages exist only after ensureInstalled.
if (cmd === undefined) {
  const { startServer } = await import('./src/server.mjs')
  await startServer()
} else if (cmd === 'status' || cmd === 'open-login') {
  const { runCli } = await import('./src/cli.mjs')
  process.exit(await runCli(cmd, rest))
} else {
  process.stderr.write(`usage: node bin.mjs [status <sites...> | open-login <sites...> | install]\n`)
  process.exit(2)
}
