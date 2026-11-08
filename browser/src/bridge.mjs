import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { WebSocketServer as NodeWebSocketServer } from 'ws'
import { codedError } from './chrome.mjs'

/**
 * The extension bridge: a WebSocket listener on the loopback interface that
 * the Pilcrino extension in the owner's browser connects to. One per server
 * process, started with the process. Every search is one message out and one
 * message back, bound by a single-use token. See
 * docs/superpowers/specs/2026-11-08-serp-source-choice-design.md.
 */

/** Bumped only when the messages between extension and server change. extension/lib/protocol.js holds the same number. */
export const PROTOCOL_VERSION = 1
export const BRIDGE_PORTS = Array.from({ length: 10 }, (_, i) => 47390 + i)
export const SEARCH_DEADLINE_MS = 30000
/** A capture is under 200 KB; anything near this is not ours. */
export const MAX_PAYLOAD = 2 * 1024 * 1024

export const NOT_CONNECTED_HINT = 'The Pilcrino extension did not answer. Is your browser running with the extension loaded? Load it once from ~/.pilcrino/extension (blog-setup walks you through it).'
export const NO_PORT_HINT = 'The Pilcrino extension bridge has no free port: too many Pilcrino sessions are running. Close one and retry.'

/** Chrome's extension id for a manifest `key`: the first 16 bytes of SHA-256 over the DER key, each nibble as a letter a to p. */
export function extensionIdFromKey(base64Key) {
  const hex = createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest('hex').slice(0, 32)
  return hex.split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')
}

export function extensionOrigin(manifestPath, fs = { readFileSync }) {
  const { key } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  return `chrome-extension://${extensionIdFromKey(key)}`
}

/** The hint for an extension at another protocol version: who has to update. */
export function outdatedHint(theirs, mine) {
  if (theirs > mine) return `The Pilcrino extension in your browser is newer than this Pilcrino (protocol ${theirs}, this server speaks ${mine}): update the Pilcrino plugin in Claude Code, or the Pilcrino app if it runs this blog.`
  return `The Pilcrino extension in your browser is out of date (protocol ${theirs}, this server speaks ${mine}): run blog-setup again to refresh ~/.pilcrino/extension, then click Reload on the extension card.`
}

const stderrLog = (msg) => { process.stderr.write(`pilcrino-browser: ${msg}\n`) }
const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)) } catch {} }

export function createBridge({ ports = BRIDGE_PORTS, origin, protocol = PROTOCOL_VERSION, pluginVersion = '0', deadlineMs = SEARCH_DEADLINE_MS, log = stderrLog, WebSocketServer = NodeWebSocketServer } = {}) {
  if (!origin) throw new Error('createBridge needs the extension origin')
  let wss = null
  let port = null
  let conn = null // the one accepted extension socket
  let lastOutdated = null // { protocol, plugin } of the last refused extension, cleared by an accepted one
  let current = null // { id, token, url, state, resolve, reject, timer }
  const queue = []

  function listen() {
    return new Promise((resolve) => {
      const tryAt = (i) => {
        if (i >= ports.length) { resolve(null); return }
        const server = new WebSocketServer({ host: '127.0.0.1', port: ports[i], maxPayload: MAX_PAYLOAD, verifyClient: (info) => info.origin === origin })
        server.once('listening', () => {
          wss = server
          port = server.address().port
          server.on('connection', onConnection)
          server.on('error', (err) => log(`bridge listener error: ${err?.message ?? err}`))
          resolve(port)
        })
        server.once('error', (err) => {
          server.removeAllListeners()
          server.close()
          if (err?.code === 'EADDRINUSE') tryAt(i + 1)
          else { log(`bridge could not listen on ${ports[i]}: ${err?.message ?? err}`); tryAt(i + 1) }
        })
      }
      tryAt(0)
    })
  }

  function onConnection(ws) {
    let greeted = false
    // ws closes the socket itself after an error (1009 for an oversized frame, 1002 for a bad one); nothing to do but log.
    ws.on('error', (err) => { log(`bridge socket error: ${err?.message ?? err}`) })
    ws.on('message', (data) => {
      let msg
      try { msg = JSON.parse(data.toString()) } catch { log('bridge dropped a frame that is not JSON'); return }
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') { log('bridge dropped a frame without a type'); return }
      if (!greeted) {
        if (msg.type !== 'hello' || msg.protocol !== protocol) {
          lastOutdated = { protocol: Number.isInteger(msg.protocol) ? msg.protocol : 0, plugin: String(msg.plugin ?? '') }
          ws.close(4001, 'extension_outdated')
          return
        }
        if (conn) { ws.close(4002, 'already_connected'); return }
        greeted = true
        conn = ws
        lastOutdated = null
        send(ws, { type: 'welcome' })
        dispatch()
        return
      }
      if (msg.type === 'ping') { send(ws, { type: 'pong' }); return }
      if (msg.type === 'result' || msg.type === 'lost') onReply(ws, msg)
    })
    ws.on('close', () => {
      if (conn !== ws) return
      conn = null
      if (current && current.state === 'pending') settle(codedError('extension_timeout', 'The Pilcrino extension disconnected during the search. ' + NOT_CONNECTED_HINT))
    })
  }

  function onReply(ws, msg) {
    if (!current || current.state !== 'pending' || ws !== conn) return
    if (msg.id !== current.id || msg.token !== current.token) return
    if (msg.type === 'lost') { settle(codedError('extension_timeout', `The Pilcrino extension lost the search tab (${msg.reason ?? 'tab_lost'}); retry.`)); return }
    settle(null, { value: msg.value ?? {} })
  }

  function settle(err, result) {
    const c = current
    if (!c) return
    clearTimeout(c.timer)
    c.state = err ? 'cancelled' : 'done'
    current = null
    if (err) c.reject(err); else c.resolve(result)
    dispatch()
  }

  function dispatch() {
    if (!current && queue.length) {
      current = queue.shift()
      current.timer = setTimeout(onDeadline, deadlineMs)
    }
    if (current && current.state === 'waiting' && conn) {
      current.state = 'pending'
      send(conn, { type: 'search', id: current.id, url: current.url, token: current.token })
    }
  }

  function onDeadline() {
    if (!current) return
    if (current.state === 'pending') {
      if (conn) send(conn, { type: 'cancel', id: current.id })
      settle(codedError('extension_timeout', 'The Pilcrino extension did not reply within 30 seconds. Is your browser awake and online? Retry.'))
      return
    }
    if (lastOutdated) settle(codedError('extension_outdated', outdatedHint(lastOutdated.protocol, protocol), { extension: lastOutdated }))
    else settle(codedError('extension_not_connected', NOT_CONNECTED_HINT))
  }

  function search({ url, token }) {
    if (typeof url !== 'string' || !url.startsWith('https://www.google.com/search?')) throw codedError('bad_argument', 'the bridge only sends Google search urls')
    if (wss === null) return Promise.reject(codedError('extension_not_connected', NO_PORT_HINT, { detail: 'too many Pilcrino sessions' }))
    return new Promise((resolve, reject) => {
      queue.push({ id: randomUUID(), url, token, state: 'waiting', resolve, reject, timer: null })
      dispatch()
    })
  }

  async function close() {
    if (current && current.state === 'pending' && conn) send(conn, { type: 'cancel', id: current.id })
    while (current || queue.length) settle(codedError('extension_not_connected', 'The Pilcrino browser server is shutting down.'))
    if (conn) {
      // Let the cancel frame flush before the socket goes: a graceful close, capped at 300 ms.
      const ws = conn
      await new Promise((r) => { const t = setTimeout(r, 300); ws.once('close', () => { clearTimeout(t); r() }); try { ws.close(1001, 'server_exit') } catch { clearTimeout(t); r() } })
    }
    const server = wss
    wss = null
    if (server) await new Promise((r) => { for (const c of server.clients) { try { c.terminate() } catch {} } server.close(() => r()) })
  }

  return { listen, get port() { return port }, connected: () => conn !== null, search, close, pluginVersion }
}
