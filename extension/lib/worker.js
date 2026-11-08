// Pilcrino extension: the service worker's logic, as a factory so the plugin's
// tests can drive it with a fake chrome and a fake WebSocket. It keeps one
// socket to every Pilcrino browser server on the loopback port range, opens one
// background tab per search it is asked for, and only ever touches tabs it
// opened itself. Requires lib/protocol.js and, in the page, lib/read-serp.js.
;(function (root) {
  const SEARCH_PREFIX = 'https://www.google.com/search?'
  const isCheckUrl = (url) => typeof url === 'string' && (url.startsWith('https://www.google.com/sorry/') || url.startsWith('https://consent.google.com/'))
  const checkKind = (url) => (url.startsWith('https://consent.google.com/') ? 'consent' : 'unusual_traffic')
  const isOwnedUrl = (url, token) => {
    try { return new URL(url).searchParams.get('pilcrino') === token } catch { return false }
  }
  // A tab is still ours while its committed address carries our token (or is
  // Google's check or consent page, where the token is gone) and no navigation
  // elsewhere is pending (Chrome reports that as pendingUrl). A tab whose first
  // navigation has not committed yet (empty or about:blank) is ours when the
  // pending address is our search.
  const oursOrCheck = (url, token) => isOwnedUrl(url, token) || isCheckUrl(url)
  const blank = (url) => !url || url === 'about:blank'
  const isOwnedTab = (tab, token) => {
    if (!tab) return false
    if (tab.pendingUrl && !oursOrCheck(tab.pendingUrl, token)) return false
    if (oursOrCheck(tab.url, token)) return true
    return blank(tab.url) && !!tab.pendingUrl
  }
  // The check or consent page the tab shows or is about to show, or null.
  const checkOn = (tab) => (tab && isCheckUrl(tab.pendingUrl) ? tab.pendingUrl : tab && isCheckUrl(tab.url) ? tab.url : null)

  function createWorker(chrome, WebSocketCtor, opts = {}) {
    const ports = opts.ports || root.PILCRINO_PORTS
    const now = opts.now || Date.now
    const setTimer = opts.setTimeout || root.setTimeout.bind(root)
    const clearTimer = opts.clearTimeout || root.clearTimeout.bind(root)
    const pluginVersion = opts.pluginVersion || (chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '0')
    const sockets = new Map() // port -> ws
    const refusedUntil = new Map() // port -> ms
    const outdated = new Set() // ports that closed us with 4001, retried on the next alarm
    const owned = new Map() // tabId -> { id, token, ws, timer }
    const creating = new Map() // id -> { token, ws, cancelled }
    let tickTimer = null
    let ticks = 0

    const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)) } catch {} }
    const forget = (tabId) => { const e = owned.get(tabId); if (e) { clearTimer(e.timer); owned.delete(tabId) } }
    // Never closes a tab on or heading to a check page: that one is the owner's to pass.
    const closeIfOwned = (tabId, token) => Promise.resolve(chrome.tabs.get(tabId)).then((tab) => {
      if (isOwnedTab(tab, token) && !checkOn(tab)) return chrome.tabs.remove(tabId)
    }).catch(() => {})
    const keepForOwner = (tabId) => { forget(tabId); Promise.resolve(chrome.tabs.update(tabId, { active: true })).catch(() => {}) }
    const lost = (tabId, reason) => { const e = owned.get(tabId); if (!e) return; forget(tabId); send(e.ws, { type: 'lost', id: e.id, token: e.token, reason }) }

    // The cancel path: forget the request and close its tab only while the tab still shows our search.
    const cancelTab = (tabId) => { const e = owned.get(tabId); if (!e) return; forget(tabId); closeIfOwned(tabId, e.token) }
    const cancelRequest = (id) => {
      const c = creating.get(id)
      if (c) c.cancelled = true
      for (const [tabId, e] of owned) if (e.id === id) cancelTab(tabId)
    }
    const cancelSocket = (ws) => {
      for (const c of creating.values()) if (c.ws === ws) c.cancelled = true
      for (const [tabId, e] of [...owned]) if (e.ws === ws) cancelTab(tabId)
    }

    function startSearch(ws, msg) {
      const { id, url, token } = msg
      if (typeof url !== 'string' || !url.startsWith(SEARCH_PREFIX) || typeof token !== 'string' || !id) {
        send(ws, { type: 'lost', id, token, reason: 'refused' })
        return
      }
      creating.set(id, { token, ws, cancelled: false })
      Promise.resolve(chrome.tabs.create({ url, active: false })).then((tab) => {
        const c = creating.get(id)
        creating.delete(id)
        if (!c || c.cancelled) { closeIfOwned(tab.id, token); return }
        owned.set(tab.id, { id, token, ws, timer: setTimer(() => cancelTab(tab.id), root.PILCRINO_SAFETY_MS) })
      }).catch(() => { creating.delete(id); send(ws, { type: 'lost', id, token, reason: 'tab_lost' }) })
    }

    function handleFrame(ws, data) {
      let msg
      try { msg = JSON.parse(typeof data === 'string' ? data : String(data)) } catch { return }
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'ping') send(ws, { type: 'pong' })
      else if (msg.type === 'search') startSearch(ws, msg)
      else if (msg.type === 'cancel') cancelRequest(msg.id)
    }

    function onClose(ws, port, ev) {
      cancelSocket(ws)
      if (sockets.get(port) === ws) sockets.delete(port)
      const code = ev && ev.code
      if (code === 4002) refusedUntil.set(port, now() + root.PILCRINO_REFUSED_BACKOFF_MS)
      if (code === 4001) outdated.add(port)
      schedule()
    }

    function connect(port) {
      let ws
      try { ws = new WebSocketCtor(`ws://127.0.0.1:${port}`) } catch { return }
      sockets.set(port, ws)
      ws.onopen = () => send(ws, { type: 'hello', protocol: root.PILCRINO_PROTOCOL, plugin: pluginVersion })
      ws.onmessage = (ev) => handleFrame(ws, ev.data)
      ws.onclose = (ev) => onClose(ws, port, ev)
      ws.onerror = () => {}
    }

    function scan({ alarm = false } = {}) {
      if (alarm) outdated.clear()
      for (const port of ports) {
        if (sockets.has(port)) continue
        if (outdated.has(port)) continue
        const until = refusedUntil.get(port)
        if (until !== undefined) { if (until > now()) continue; refusedUntil.delete(port) }
        connect(port)
      }
      schedule()
    }

    // While any socket is open the worker stays awake on a 5 s tick: rescans, and pings every fourth tick.
    function schedule() {
      if (tickTimer || sockets.size === 0) return
      tickTimer = setTimer(() => {
        tickTimer = null
        ticks++
        if (ticks % root.PILCRINO_PING_EVERY_TICKS === 0) for (const ws of sockets.values()) if (ws.readyState === undefined || ws.readyState === 1) send(ws, { type: 'ping' })
        scan()
      }, root.PILCRINO_RESCAN_MS)
    }

    function onUpdated(tabId, changeInfo, tab) {
      const e = owned.get(tabId)
      if (!e) return
      const url = (changeInfo && changeInfo.url) || (tab && tab.url)
      if (!url) return
      if (isCheckUrl(url)) {
        forget(tabId)
        send(e.ws, { type: 'result', id: e.id, token: e.token, value: { blocked: checkKind(url), url } })
        Promise.resolve(chrome.tabs.update(tabId, { active: true })).catch(() => {})
        return
      }
      if (!isOwnedUrl(url, e.token)) lost(tabId, 'tab_lost')
    }

    function handleMessage(msg, sender) {
      if (!msg || msg.type !== 'pilcrino-serp') return
      const tabId = sender && sender.tab && sender.tab.id
      const e = owned.get(tabId)
      if (!e || sender.frameId !== 0 || msg.token !== e.token) return
      const value = msg.value || {}
      // The capture counts only if the tab is still ours right now: a message
      // from a document the owner has since left is stale.
      Promise.resolve(chrome.tabs.get(tabId)).then((tab) => {
        if (!owned.has(tabId)) return
        if (!isOwnedTab(tab, e.token)) { lost(tabId, 'tab_lost'); return }
        const check = checkOn(tab)
        if (check) {
          // The page is redirecting to a check: the capture is stale, the check is the answer.
          forget(tabId)
          send(e.ws, { type: 'result', id: e.id, token: e.token, value: { blocked: checkKind(check), url: check } })
          Promise.resolve(chrome.tabs.update(tabId, { active: true })).catch(() => {})
          return
        }
        send(e.ws, { type: 'result', id: e.id, token: e.token, value })
        if (value.blocked) { keepForOwner(tabId); return }
        forget(tabId)
        closeIfOwned(tabId, e.token)
      }).catch(() => lost(tabId, 'tab_lost'))
    }

    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.tabs.onRemoved.addListener((tabId) => lost(tabId, 'tab_lost'))
    chrome.runtime.onMessage.addListener(handleMessage)
    if (chrome.alarms) {
      chrome.alarms.create('pilcrino-scan', { periodInMinutes: root.PILCRINO_ALARM_MINUTES })
      chrome.alarms.onAlarm.addListener((a) => { if (!a || a.name === 'pilcrino-scan') scan({ alarm: true }) })
    }
    scan()

    return {
      scan,
      sockets: () => new Map(sockets),
      owned: () => new Map(owned),
      refusedUntil: () => new Map(refusedUntil),
      handleMessage,
      onUpdated,
      stop: () => { if (tickTimer) clearTimer(tickTimer); tickTimer = null },
    }
  }

  root.pilcrinoCreateWorker = createWorker
})(globalThis)
