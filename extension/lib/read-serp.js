// Pilcrino extension: reads a Google results page. Plain script (no modules):
// content.js loads it in the page, and the plugin's tests load it in Node with a
// small DOM. Both functions are pure over the document they are given.
;(function (root) {
  const bodyText = (doc) => (doc.body && (doc.body.innerText != null ? doc.body.innerText : doc.body.textContent)) || ''
  const query = (loc) => new URLSearchParams(loc.search).get('q')

  /**
   * The capture both Pilcrino skills read: top ten organic results, SERP
   * features, title, text and links. On Google's check: { blocked, query, url }.
   */
  function readSerp(doc, loc) {
    const text = bodyText(doc)
    if (loc.pathname.startsWith('/sorry') || /unusual traffic/i.test(text)) {
      return { blocked: 'unusual_traffic', query: query(loc), url: loc.href }
    }
    const results = Array.from(doc.querySelectorAll('a[jsname][href^="http"]'))
      .map((a) => { const h = a.querySelector('h3'); return { url: a.href, title: h ? (h.innerText != null ? h.innerText : h.textContent).trim() : '' } })
      .filter((r) => r.title && !r.url.includes('google.com') && !r.url.includes('youtube.com/watch'))
      .slice(0, 10)
    const features = []
    if (doc.querySelector('[data-attrid*="generative"]')) features.push('ai_overview')
    if (doc.querySelector('[data-attrid*="answer"]')) features.push('featured_snippet')
    if (text.includes('People also ask')) features.push('people_also_ask')
    if (doc.querySelector('[data-sgsc]')) features.push('shopping')
    return {
      query: query(loc),
      searchedAt: new Date().toISOString(),
      url: loc.href,
      serpFeatures: features,
      topResults: results.map((r, i) => ({ rank: i + 1, url: r.url, title: r.title })),
      title: doc.title,
      text: text.substring(0, 20000),
      links: Array.from(doc.querySelectorAll('a[href]')).slice(0, 200).map((a) => ({ href: a.href, text: ((a.innerText != null ? a.innerText : a.textContent) || '').trim().substring(0, 120) })),
    }
  }

  /** Stop polling when the page is a check, has five results, or 40 tries (10 s at 250 ms) are spent. */
  function pollDecision(value, tries) {
    if (value && value.blocked) return true
    if (value && Array.isArray(value.topResults) && value.topResults.length >= 5) return true
    return tries >= 40
  }

  root.pilcrinoReadSerp = readSerp
  root.pilcrinoPollDecision = pollDecision
})(globalThis)
