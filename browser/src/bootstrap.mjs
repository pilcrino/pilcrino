// A dependency-free stand-in for the MCP server while its packages install.
//
// Claude Code kills an MCP server whose `initialize` gets no answer within 30
// seconds, and after a plugin update the first start has to run `npm install`
// before the SDK exists. This shim speaks the same newline-delimited JSON-RPC
// 2.0 as the SDK's StdioServerTransport, answers the handshake at once, says
// "installing" to tool calls, and hands stdin and stdout to the real server
// when the install is done. A failed install is retried until it succeeds.
// Meanwhile the shim lists one tool, install_status, so Claude has something
// visible to call that says what is happening. Only whole JSON lines go to
// stdout; diagnostics go to stderr.

const INSTALLING = 'pilcrino-browser is installing its packages after a plugin update; try again in a minute'
const RETRY_MS = 60_000

const STATUS_TOOL = {
  name: 'install_status',
  description: 'Reports the Pilcrino browser package install that runs after a plugin update: how long it has been running, or why it failed and when it retries. The browser tools replace this one when the install is done.',
  inputSchema: { type: 'object', properties: {} },
}

/**
 * opts:
 *   stdin, stdout, stderr  streams (process.stdin and friends in production)
 *   version                serverInfo.version for the initialize answer
 *   install()              async; resolves with whatever handover needs, rejects with the reason
 *   handover({ leftover, result })  async; starts the real server on the same stdio. stdin is
 *                          paused and any partial line has been unshifted back onto it.
 *   onEnd()                called when stdin ends while the shim still owns it
 *   retryMs                delay before a failed install is tried again (60 s)
 *   sleep(ms), now()       injectable for tests
 * Returns { done }: a promise that settles after the handover. A failed install
 * does not settle it: the failure is recorded, the shim keeps answering with it,
 * and install() runs again after retryMs, until it succeeds.
 */
export function runBootstrap({
  stdin, stdout, stderr, version, install, handover, onEnd = () => {},
  retryMs = RETRY_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = Date.now,
}) {
  let buf = Buffer.alloc(0)
  let failure = null // set while a retry is pending
  let retryAt = 0
  let attemptStart = now()
  let lastFailure = null

  const send = (msg) => { stdout.write(`${JSON.stringify(msg)}\n`) }
  const result = (id, value) => send({ jsonrpc: '2.0', id, result: value })
  const status = () => (failure ? `pilcrino-browser could not install its packages: ${failure}` : INSTALLING)
  const installStatus = () => {
    if (failure) {
      const wait = Math.max(0, Math.ceil((retryAt - now()) / 1000))
      return `pilcrino-browser could not install its packages: ${failure}; retrying in ${wait} s`
    }
    const elapsed = Math.max(0, Math.round((now() - attemptStart) / 1000))
    const previous = lastFailure ? ` The previous attempt failed: ${lastFailure}` : ''
    return `pilcrino-browser is installing its packages after a plugin update (${elapsed} s so far). The browser tools appear when it is done.${previous}`
  }

  function handle(msg) {
    if (msg === null || typeof msg !== 'object' || typeof msg.method !== 'string') return // responses and junk
    const isRequest = msg.id !== undefined && msg.id !== null
    if (!isRequest) return // notifications/initialized and every other notification
    switch (msg.method) {
      case 'initialize':
        return result(msg.id, {
          protocolVersion: msg.params?.protocolVersion,
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'pilcrino-browser', version },
        })
      case 'ping':
        return result(msg.id, {})
      case 'tools/list':
        return result(msg.id, { tools: [STATUS_TOOL] })
      case 'tools/call':
        if (msg.params?.name === STATUS_TOOL.name) return result(msg.id, { content: [{ type: 'text', text: installStatus() }] })
        return result(msg.id, { content: [{ type: 'text', text: status() }], isError: true })
      default:
        return send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } })
    }
  }

  const onData = (chunk) => {
    buf = Buffer.concat([buf, typeof chunk === 'string' ? Buffer.from(chunk) : chunk])
    for (;;) {
      const nl = buf.indexOf(0x0a)
      if (nl === -1) break
      const line = buf.subarray(0, nl).toString('utf8').replace(/\r$/, '')
      buf = buf.subarray(nl + 1)
      if (line.trim() === '') continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        stderr.write(`pilcrino-browser: ignored a line that is not JSON\n`)
        continue
      }
      handle(msg)
    }
  }
  const onStreamEnd = () => onEnd()

  stdin.on('data', onData)
  stdin.on('end', onStreamEnd)

  const done = (async () => {
    let installed
    for (;;) {
      attemptStart = now()
      try {
        installed = await install()
        break
      } catch (err) {
        failure = err?.message ?? String(err)
        lastFailure = failure
        retryAt = now() + retryMs
        stderr.write(`pilcrino-browser: ${status()}; retrying in ${Math.round(retryMs / 1000)} s\n`)
      }
      await sleep(retryMs)
      failure = null
    }
    // Stop reading without losing bytes: pause first so no further 'data' fires,
    // then put back any partial line for the real transport to read.
    stdin.pause()
    stdin.off('data', onData)
    stdin.off('end', onStreamEnd)
    const leftover = buf
    buf = Buffer.alloc(0)
    if (leftover.length > 0) stdin.unshift(leftover)
    send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
    await handover({ leftover, result: installed })
    return { ok: true }
  })()

  return { done }
}
