// A dependency-free stand-in for the MCP server while its packages install.
//
// Claude Code kills an MCP server whose `initialize` gets no answer within 30
// seconds, and after a plugin update the first start has to run `npm install`
// before the SDK exists. This shim speaks the same newline-delimited JSON-RPC
// 2.0 as the SDK's StdioServerTransport, answers the handshake at once, says
// "installing" to tool calls, and hands stdin and stdout to the real server
// when the install is done. Only whole JSON lines go to stdout; diagnostics go
// to stderr.

const INSTALLING = 'pilcrino-browser is installing its packages after a plugin update; try again in a minute'

/**
 * opts:
 *   stdin, stdout, stderr  streams (process.stdin and friends in production)
 *   version                serverInfo.version for the initialize answer
 *   install()              async; resolves with whatever handover needs, rejects with the reason
 *   handover({ leftover, result })  async; starts the real server on the same stdio. stdin is
 *                          paused and any partial line has been unshifted back onto it.
 *   onEnd()                called when stdin ends while the shim still owns it
 * Returns { done }: a promise that settles after the handover, or after an install failure
 * has been recorded (the shim then keeps answering with the failure).
 */
export function runBootstrap({ stdin, stdout, stderr, version, install, handover, onEnd = () => {} }) {
  let buf = Buffer.alloc(0)
  let failure = null

  const send = (msg) => { stdout.write(`${JSON.stringify(msg)}\n`) }
  const result = (id, value) => send({ jsonrpc: '2.0', id, result: value })
  const status = () => (failure ? `pilcrino-browser could not install its packages: ${failure}` : INSTALLING)

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
        return result(msg.id, { tools: [] })
      case 'tools/call':
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
    try {
      installed = await install()
    } catch (err) {
      failure = err?.message ?? String(err)
      stderr.write(`pilcrino-browser: ${status()}\n`)
      return { ok: false, reason: failure }
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
