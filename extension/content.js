// Pilcrino extension: runs on Google results pages, does nothing unless the
// address carries Pilcrino's marker, then reads the results (lib/read-serp.js)
// and sends them once to the service worker.
;(() => {
  const token = new URLSearchParams(location.search).get('pilcrino')
  if (!token) return
  let tries = 0
  const tick = () => {
    const value = pilcrinoReadSerp(document, location)
    if (pilcrinoPollDecision(value, tries++)) {
      chrome.runtime.sendMessage({ type: 'pilcrino-serp', token, value })
      return
    }
    setTimeout(tick, 250)
  }
  tick()
})()
