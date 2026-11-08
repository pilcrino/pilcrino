# Pilcrino extension

Reads Google search results for Pilcrino in your own browser, so Pilcrino's
research gets Google's results without the robot check its own browser hits.
It acts only on tabs it opened itself, each carrying a one-time marker, and
closes them when read; a tab Google blocks stays open for you. It talks to the
Pilcrino browser server on this computer only (127.0.0.1, ports 47390 to 47399).

Install: `blog-setup` copies this folder to `~/.pilcrino/extension` and walks
you through `chrome://extensions`, Developer mode, Load unpacked. Load it in one
browser only. Its id is fixed by the `key` in `manifest.json`:
`baadncnanikldfjmdekjakgjgmclbkbl`.

Files: `background.js` (service worker), `lib/worker.js` (its logic),
`lib/protocol.js` (constants shared with `browser/src/bridge.mjs`),
`content.js` and `lib/read-serp.js` (the page read). Tests live in
`browser/test/extension-*.test.mjs`.
