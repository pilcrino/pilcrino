# SERP source choice (plugin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the blog owner choose where Google-style search results come from (`research.serp: bing | google | extension`), with Bing the default, and ship the Pilcrino extension plus the `serp_search` bridge that reads Google in the owner's own browser.

**Architecture:** The browser MCP server gains a WebSocket bridge on 127.0.0.1 (ports 47390 to 47399) that a Manifest V3 extension connects to; `serp_search` sends one `{id, url, token}` per query and writes the extension's capture to a file. The `capture` tool's check handling becomes host-aware so Bing works in the Pilcrino browser. Both research skills and blog-setup branch on the config key. The companion app has its own plan (`/Users/slav/work/blogsmith/docs/superpowers/plans/2026-11-08-serp-source-choice-app.md`), run after this plugin is tagged.

**Tech Stack:** Node 22 ESM (`.mjs`), `node --test`, `ws` 8.x (already in `browser/node_modules` through puppeteer-core; becomes a direct dependency), `linkedom` as a regular dependency for DOM tests (the install step prunes dev dependencies), Chrome extension Manifest V3 (plain scripts, no bundler).

**Spec:** `docs/superpowers/specs/2026-11-08-serp-source-choice-design.md`

## Global Constraints

- Every change bumps `version` in `.claude-plugin/plugin.json` and adds a top Changelog entry in `README.md` (plugin CLAUDE.md). This plan goes 0.62.0 to 0.63.0, done once in the last task.
- `./tests/lint.sh` must pass before the PR; CI also runs `cd browser && npm ci && node --test test/*.test.mjs`.
- No em dashes anywhere (prose, code comments, skill text, commit messages).
- Skill text is read by a blog owner who is not a developer: plain words, exact sentences where the spec fixes them.
- The browser server's stdout is the MCP channel: diagnostics go to stderr only (`tabs.mjs` `stderrLog` pattern).
- Page content never enters a tool result: `serp_search` returns counts and flags, the capture goes to `outFile`.
- Port range `47390` to `47399`, loopback only, WebSocket only, Origin must equal the extension's origin.
- Protocol version is an integer, `1` at first release, held in two places that a test keeps equal: `browser/src/bridge.mjs` and `extension/lib/protocol.js`.
- Timeouts: 30 s `serp_search` deadline; 60 s extension-side safety timer; 5 s rescan while connected, 30 s alarm otherwise; 30 s backoff on a refused port; 10 s content-script poll at 250 ms; lock stale after 60 s.
- Commits: small, one per task step 'Commit', with the attribution lines from the session's system reminder.

## Review Focus

- A query with `&`, `#`, quotes or non-ASCII must reach Google intact: `buildSearchUrl` percent-encodes `q`; test in Task 5.
- A bad `outFile` (relative, or outside the roots) fails with `bad_path` before any message goes to the extension; test in Task 5.
- A malformed or oversized socket frame from the extension (not JSON, or JSON without `type`) must not crash the server process; the bridge drops it and logs; test in Task 4.
- A results page that never reaches five organic results (a thin query) must still return after the 10 s poll with what it has, as a zero-or-few-results capture, not as blocked and not as a timeout; `pollDecision` test in Task 2.
- A `hello` without a `protocol` field (an extension from before versioning, or a stranger) is treated as outdated and closed with `extension_outdated`, never accepted; test in Task 4.

---

## File structure

Plugin repository `/Users/slav/work/pilcrino`:

- Create `extension/manifest.json`: MV3 manifest, fixed `key`, permissions, content script and worker registration.
- Create `extension/lib/protocol.js`: `PILCRINO_PROTOCOL = 1`, `PILCRINO_PORTS` (47390..47399), shared constants, loaded by both worker and tests.
- Create `extension/lib/read-serp.js`: pure functions over a document (`readSerp(doc, loc)`, `pollDecision(value, tries)`), used by `content.js` and tested with linkedom.
- Create `extension/lib/worker.js`: `pilcrinoCreateWorker(chrome, WebSocketCtor, opts)`: sockets, tab ownership, message handling; tested with a fake `chrome`.
- Create `extension/background.js`: `importScripts` of the two libs, then `pilcrinoCreateWorker(chrome, WebSocket)`.
- Create `extension/content.js`: marker check, poll, one `chrome.runtime.sendMessage`.
- Create `browser/src/bridge.mjs`: `createBridge(opts)`, the WebSocket listener, connection arbitration, search lifecycle, `extensionIdFromKey`.
- Create `browser/src/serp.mjs`: `buildSearchUrl`, `serpSearchTool(bridge, args, ctx)`.
- Create `browser/src/extension-copy.mjs`: `refreshExtensionCopy`, stamp, lock, swap.
- Modify `browser/src/server.mjs`: register `serp_search`, host-aware capture, start bridge and refresh in `startServer`.
- Modify `browser/src/tabs.mjs`: `isBingUrl`, `checkKind(value, { onlyBlocked })`.
- Modify `browser/src/pagetools.mjs`: `bingCheck` option.
- Modify `browser/src/cli.mjs`, `browser/bin.mjs`: `refresh-extension` command.
- Modify `browser/package.json`: `ws` dependency, `linkedom` dev dependency.
- Tests in `browser/test/`: `bridge.test.mjs`, `serp.test.mjs`, `extension-copy.test.mjs`, `extension-read.test.mjs`, `extension-worker.test.mjs`, plus edits to `server.test.mjs`, `tabs.test.mjs`, `pagetools.test.mjs`.
- Modify `skills/blog-setup/scripts/validate-config.mjs` and its test: check 17.
- Modify `skills/blog-post-workflow/references/config-schema.md`, `skills/blog-post-workflow/SKILL.md`, `skills/blog-post-workflow/references/console-contract.md`, `templates/research-serp.md`, `agents/blog-researcher.md`, `skills/plan-content/SKILL.md`, `skills/plan-content/references/queries.md`, `skills/blog-setup/SKILL.md`, `README.md`, `.claude-plugin/plugin.json`, `tests/lint.sh`, `.github/workflows/plugin.yml`.
- Delete `spike/` (untracked throwaway) in the last task.

---

### Task 1: The config key and its validator check

**Files:**
- Modify: `skills/blog-post-workflow/references/config-schema.md` (the empty `research:` line near line 166)
- Modify: `skills/blog-setup/scripts/validate-config.mjs` (`runChecks`, after check 16; the "16 invariants" wording in the header comment and the `n <= 16` skip loop)
- Test: `skills/blog-setup/scripts/validate-config.test.mjs`

**Interfaces:**
- Produces: config key `research.serp` with values `bing` (default when absent), `google`, `extension`. Check 17 titled `The search source, when given, is bing, google or extension`.

- [ ] **Step 1: Write the failing tests**

Add to `validate-config.test.mjs`, following the file's existing pattern of building a config object and calling `runChecks(cfg, { repo })`:

```js
test('check 17: research.serp accepts bing, google and extension, refuses others, passes when absent', () => {
  const base = validConfig() // the helper the file already uses for a passing config; if it has another name, use that
  for (const v of ['bing', 'google', 'extension']) {
    const r = runChecks({ ...base, research: { serp: v } }, { repo: REPO }).find((c) => c.n === 17)
    assert.equal(r.ok, true, v)
  }
  const bad = runChecks({ ...base, research: { serp: 'duckduckgo' } }, { repo: REPO }).find((c) => c.n === 17)
  assert.equal(bad.ok, false)
  assert.match(bad.detail, /research\.serp must be one of bing, google, extension/)
  const absent = runChecks(base, { repo: REPO }).find((c) => c.n === 17)
  assert.equal(absent.ok, true)
  assert.equal(runChecks(base, { repo: REPO }).length, 17)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test skills/blog-setup/scripts/validate-config.test.mjs`
Expected: FAIL, `find` returns undefined for n 17.

- [ ] **Step 3: Add check 17 and the schema block**

In `validate-config.mjs`, after check 16:

```js
const serp = get(cfg, 'research.serp')
check(17, 'The search source, when given, is bing, google or extension', serp !== undefined && !['bing', 'google', 'extension'].includes(serp) && `research.serp must be one of bing, google, extension, got ${JSON.stringify(serp)}`)
```

Change the skip loop bound to `n <= 17` and the header comment's "16" to "17", and the report's total wherever the script prints `All 16 checks pass` or `of 16 checks failed`. Update the existing assertions in `validate-config.test.mjs` that count 16 `ok` lines or match `All 16 checks pass` and `of 16 checks failed` (near lines 157, 165, 171, 178) to 17. In `config-schema.md`, replace the bare `research:` line with:

```yaml
research:                     # OPTIONAL block
  serp: bing                  # bing (default) | google | extension. Where search results
                              #   come from: Bing in the Pilcrino browser; Google in the
                              #   Pilcrino browser (one robot check per run); or Google
                              #   through the Pilcrino extension in your own browser.
                              #   Setup asks; change it here or by re-running blog-setup.
```

Add one line to the schema's validation-invariants list (wherever checks 1 to 16 are enumerated in that document) for check 17.

- [ ] **Step 4: Run the tests**

Run: `node --test skills/blog-setup/scripts/validate-config.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/blog-setup/scripts/validate-config.mjs skills/blog-setup/scripts/validate-config.test.mjs skills/blog-post-workflow/references/config-schema.md
git commit -m "config: research.serp picks the search source (bing, google, extension)"
```

---

### Task 2: The extension's read function

**Files:**
- Create: `extension/lib/read-serp.js`
- Create: `browser/test/fixtures/serp/results.html`, `sorry.html`, `ai-overview.html`, `thin.html`
- Test: `browser/test/extension-read.test.mjs`
- Modify: `browser/package.json` (dependency `"linkedom": "^0.18.0"`, a regular dependency on purpose: `ensureInstalled` runs `npm install --omit=dev` when the stamp is missing, which would prune a dev dependency under the test suite), then `cd browser && npm install` to refresh the lock file

**Interfaces:**
- Produces, on `globalThis` (plain script, no modules, so the content script and the test can both load it): `pilcrinoReadSerp(doc, loc) -> value` and `pilcrinoPollDecision(value, tries) -> boolean`.
- `value` on a results page: `{ query, searchedAt, url, serpFeatures, topResults: [{rank, url, title}], title, text, links: [{href, text}] }` with `text` capped at 20000 characters, `links` at 200, `topResults` at 10. On a check: `{ blocked: 'unusual_traffic', query, url }`.
- `pilcrinoPollDecision(value, tries)` is true when `value.blocked`, or `topResults.length >= 5`, or `tries >= 40` (40 tries at 250 ms is the 10 s poll).

- [ ] **Step 1: Write the fixtures**

Hand-written minimal HTML that uses the selectors the spec fixes (the same as blog-post-workflow Step 4.2 today): organic results as `<a jsname="x" href="https://example.com/1"><h3>Title 1</h3></a>` (make eight in `results.html`, three in `thin.html`, plus one `google.com` link and one `youtube.com/watch` link that must be filtered out), `<div data-attrid="generative-ai">` in `ai-overview.html`, body text containing `People also ask` in `results.html`, `<div data-sgsc>` in `results.html`. `sorry.html` has body text `Our systems have detected unusual traffic from your computer network`. Each fixture has a `<title>`.

- [ ] **Step 2: Write the failing tests**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import { parseHTML } from 'linkedom'

const here = dirname(fileURLToPath(import.meta.url))
vm.runInThisContext(readFileSync(join(here, '..', '..', 'extension', 'lib', 'read-serp.js'), 'utf8'))
const load = (name, search = '?q=kanban+board&pilcrino=abc', pathname = '/search') => {
  const { document } = parseHTML(readFileSync(join(here, 'fixtures', 'serp', name), 'utf8'))
  return globalThis.pilcrinoReadSerp(document, { pathname, search, href: `https://www.google.com${pathname}${search}` })
}

test('results page: ten or fewer organic results, features, text and links', () => {
  const v = load('results.html')
  assert.equal(v.blocked, undefined)
  assert.equal(v.query, 'kanban board')
  assert.equal(v.topResults.length, 8)
  assert.deepEqual(v.topResults[0], { rank: 1, url: 'https://example.com/1', title: 'Title 1' })
  assert.ok(v.topResults.every((r) => !r.url.includes('google.com') && !r.url.includes('youtube.com/watch')))
  assert.deepEqual(v.serpFeatures, ['people_also_ask', 'shopping'])
  assert.ok(v.text.length > 0 && v.text.length <= 20000)
  assert.ok(v.links.length <= 200 && v.links.every((l) => typeof l.href === 'string'))
  assert.equal(typeof v.title, 'string')
  assert.match(v.searchedAt, /^\d{4}-\d{2}-\d{2}T/)
})
test('sorry page is blocked', () => {
  const v = load('sorry.html', '?continue=x', '/sorry/index')
  assert.equal(v.blocked, 'unusual_traffic')
  assert.equal(v.topResults, undefined)
})
test('ai overview is a feature', () => assert.ok(load('ai-overview.html').serpFeatures.includes('ai_overview')))
test('poll decision: blocked, five results, or 40 tries', () => {
  const d = globalThis.pilcrinoPollDecision
  assert.equal(d({ blocked: 'unusual_traffic' }, 0), true)
  assert.equal(d({ topResults: new Array(5) }, 0), true)
  assert.equal(d({ topResults: new Array(3) }, 39), false)
  assert.equal(d({ topResults: new Array(3) }, 40), true)
})
test('thin page returns its three results, not blocked', () => {
  const v = load('thin.html')
  assert.equal(v.topResults.length, 3)
  assert.equal(v.blocked, undefined)
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd browser && npm install && node --test test/extension-read.test.mjs`
Expected: FAIL, `pilcrinoReadSerp is not a function` (or the file is missing).

- [ ] **Step 4: Implement `extension/lib/read-serp.js`**

A plain script (no `export`, no `import`) that defines both functions on `globalThis`. `readSerp` takes `doc` and `loc` so the content script passes `document` and `location`. Check order: `blocked` when `loc.pathname.startsWith('/sorry')` or `/unusual traffic/i` matches `doc.body.innerText` (linkedom gives `textContent`; use `doc.body.innerText ?? doc.body.textContent`). Selectors and filters from the spec: `a[jsname][href^="http"]` with an `h3`, filter `google.com` and `youtube.com/watch`, slice 10; features `[data-attrid*="generative"]` ai_overview, `[data-attrid*="answer"]` featured_snippet, text includes `People also ask`, `[data-sgsc]` shopping; `title` is `doc.title`; `text` first 20000 of body text; `links` first 200 `a[href]` as `{ href, text }` with text trimmed to 120. `url` is `loc.href`.

- [ ] **Step 5: Run the tests**

Run: `cd browser && node --test test/extension-read.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add extension/lib/read-serp.js browser/test/extension-read.test.mjs browser/test/fixtures/serp browser/package.json browser/package-lock.json
git commit -m "extension: pure SERP reader with fixtures"
```

---

### Task 3: The extension itself (manifest, worker, content script)

**Files:**
- Create: `extension/manifest.json`, `extension/lib/protocol.js`, `extension/lib/worker.js`, `extension/background.js`, `extension/content.js`, `extension/README.md` (ten lines: what it is, load unpacked, one browser only)
- Test: `browser/test/extension-worker.test.mjs`

**Interfaces:**
- `extension/lib/protocol.js` defines on `globalThis`: `PILCRINO_PROTOCOL = 1`, `PILCRINO_PORTS = [47390, ..., 47399]`, `PILCRINO_RESCAN_MS = 5000`, `PILCRINO_ALARM_MINUTES = 0.5`, `PILCRINO_REFUSED_BACKOFF_MS = 30000`, `PILCRINO_SAFETY_MS = 60000`.
- Wire messages (JSON text frames). Extension to server: `{ type: 'hello', protocol: 1, plugin: '<manifest version>' }` first; `{ type: 'result', id, token, value }`; `{ type: 'lost', id, token, reason: 'tab_lost' }`. Server to extension: `{ type: 'welcome' }`; `{ type: 'search', id, url, token }`; `{ type: 'cancel', id }`; `{ type: 'ping' }` (answered `{ type: 'pong' }`). Server closes with code `4001` reason `extension_outdated` or `4002` reason `already_connected`.
- Content script to worker: `{ type: 'pilcrino-serp', token, value }`.
- `pilcrinoCreateWorker(chrome, WebSocketCtor, { ports, now, setTimeout, clearTimeout })` returns `{ scan(), sockets(), owned(), handleMessage(msg, sender), stop() }` for tests; `background.js` calls it with defaults.
- Each owned request is bound to the socket object that sent it (`{ id, token, ws }`), never to the port: a replacement connection on the same port never receives a result from before it. Any `onclose` (whatever the code) cancels every request bound to that socket as `cancel` does; a `tabs.create` that resolves after its request was cancelled closes the tab it just made.
- Manifest: `manifest_version: 3`, `name: "Pilcrino"`, `version` equal to the plugin version (`0.62.0` now, bumped with it in Task 11), `description: "Reads Google search results for Pilcrino, in this browser, on request. Touches no other page."`, `key: <base64 RSA public key>`, `permissions: ["tabs", "alarms"]`, `host_permissions: ["https://www.google.com/*", "http://127.0.0.1/*"]`, `background: { service_worker: "background.js" }`, `content_scripts: [{ matches: ["https://www.google.com/search*"], js: ["lib/read-serp.js", "content.js"], run_at: "document_idle" }]`.

- [ ] **Step 1: Generate the fixed key**

Run once and paste the output into the manifest's `key`:

```bash
openssl genrsa 2048 2>/dev/null | openssl rsa -pubout -outform DER 2>/dev/null | base64 | tr -d '\n'
```

The private key is not kept: an unpacked extension only needs the public key in `key` for a fixed id. Record the resulting id (Task 4's `extensionIdFromKey`) in `extension/README.md`.

- [ ] **Step 2: Write the failing worker tests**

Build a fake `chrome` with `tabs.create/remove/update/get` recording calls, `tabs.onUpdated/onRemoved.addListener`, `runtime.onMessage.addListener`, `alarms.create/onAlarm.addListener`; a fake `WebSocketCtor` class whose instances record `send` and can be driven with `onopen`, `onmessage({data})`, `onclose({code, reason})`. Load the two lib files with `vm.runInThisContext` as in Task 2.

```js
test('scan opens one socket per port and sends hello first', ...)        // 10 ports, 10 sockets, first frame is hello with protocol 1
test('search opens a background tab and remembers it', ...)              // tabs.create called with { url, active: false }; owned() has the tab with token
test('search with a non-google url is refused and nothing opens', ...)   // tabs.create not called
test('result from the owned tab, frame 0, right token is sent and the tab closed only if its url still carries the token', ...)
test('result from an unowned tab, from frame 1, or with a stale token is ignored and closes nothing', ...)
test('inline blocked result keeps the tab, activates it, forgets it', ...) // tabs.update(tabId, {active:true}); tabs.remove not called; owned() empty
test('owned tab landing on /sorry or consent.google.com replies blocked and keeps the tab', ...) // drive onUpdated with changeInfo.url
test('owned tab whose url loses the token ends the request with lost and closes nothing', ...)
test('onRemoved of an owned tab sends lost', ...)
test('cancel closes the tab only while still owned', ...)
test('a socket drop cancels every request bound to that socket and closes their still-owned tabs', ...)
test('a reconnect on the same port never receives a result from a request of the old socket', ...)
test('cancel arriving before tabs.create resolves closes the new tab', ...)
test('safety timer after 60 s behaves like cancel', ...)                   // fake setTimeout captured and fired
test('a 4002 close marks the port refused and the next scan skips it for 30 s, then retries', ...)
test('a 4001 close stops retrying that port until the next alarm scan', ...)
test('ping is answered with pong', ...)
```

Each test asserts the exact frames sent (`JSON.parse(socket.sent[n])`) and the exact `chrome.tabs` calls.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd browser && node --test test/extension-worker.test.mjs`
Expected: FAIL, `pilcrinoCreateWorker is not a function`.

- [ ] **Step 4: Implement `extension/lib/protocol.js` and `extension/lib/worker.js`**

Worker state: `sockets: Map<port, {ws, state: 'connecting'|'open'|'refusedUntil:<ms>'}>`, `owned: Map<tabId, {id, token, ws}>`, `creating: Set<id>` for requests whose `tabs.create` has not resolved. `scan()` opens a socket to each port not open and not inside its refusal window; `onopen` sends `hello`; `onmessage` dispatches `welcome` (nothing), `search` (validate `url` starts with `https://www.google.com/search?`, `tabs.create({url, active:false})`, remember, start safety timer), `cancel`, `ping`. `onclose` first cancels every owned request whose `ws` is the closing socket (same path as `cancel`); then with 4002 sets `refusedUntil = now + 30000`; with 4001 leaves the port alone until the next alarm. Ownership test: `new URL(tab.url).searchParams.get('pilcrino') === token`, or the URL starts with `https://www.google.com/sorry/` or `https://consent.google.com/`. `handleMessage(msg, sender)` implements the spec's acceptance rule and the close rule (`tabs.get` then check ownership before `tabs.remove`). Keepalive: while any socket is open, `setTimeout` loop every 20 s sends `ping` and calls `scan()` every 5 s; `alarms.create('pilcrino-scan', { periodInMinutes: 0.5 })` always, handler calls `scan()`.

- [ ] **Step 5: Write `background.js`, `content.js`, `manifest.json`**

`background.js`:

```js
importScripts('lib/protocol.js', 'lib/worker.js')
pilcrinoCreateWorker(chrome, WebSocket)
```

`content.js`: read the token from `new URLSearchParams(location.search).get('pilcrino')`; return if absent; every 250 ms call `pilcrinoReadSerp(document, location)` and stop when `pilcrinoPollDecision(value, tries)`; then one `chrome.runtime.sendMessage({ type: 'pilcrino-serp', token, value })`.

- [ ] **Step 6: Run the tests**

Run: `cd browser && node --test test/extension-worker.test.mjs test/extension-read.test.mjs`
Expected: PASS.

- [ ] **Step 7: Load it once by hand**

In Brave or Chrome: `chrome://extensions`, Developer mode, Load unpacked, choose `/Users/slav/work/pilcrino/extension`. Expected: the card shows "Pilcrino 0.63.0" with no manifest error, and the id matches the one recorded in `extension/README.md`. Remove the spike extension from the same browser now.

- [ ] **Step 8: Commit**

```bash
git add extension browser/test/extension-worker.test.mjs
git commit -m "extension: Pilcrino MV3 extension with tab ownership and a tested service worker"
```

---

### Task 4: The bridge in the browser server

**Files:**
- Create: `browser/src/bridge.mjs`
- Modify: `browser/package.json` (dependency `"ws": "^8.18.0"`)
- Test: `browser/test/bridge.test.mjs`

**Interfaces:**
- `export const PROTOCOL_VERSION = 1`, `export const BRIDGE_PORTS = [47390, ..., 47399]`, `export const SEARCH_DEADLINE_MS = 30000`.
- `export function extensionIdFromKey(base64Key) -> string` (32 chars `a` to `p`: SHA-256 of the DER key bytes, first 16 bytes, each nibble mapped to `a`..`p`).
- `export function extensionOrigin(manifestPath) -> 'chrome-extension://<id>'` reading `key` from `extension/manifest.json`.
- `export function createBridge({ ports = BRIDGE_PORTS, origin, protocol = PROTOCOL_VERSION, pluginVersion, deadlineMs = SEARCH_DEADLINE_MS, log = stderrLog, WebSocketServer = ws.WebSocketServer })` returns `{ listen() -> Promise<number|null>, port, connected() -> boolean, search({ url, token }) -> Promise<{ value }>, close() -> Promise<void> }`.
- `search` rejects with `codedError('extension_not_connected', hint)` when no extension connected within the deadline (hint: `The Pilcrino extension did not answer. Is your browser running with the extension loaded? Load it once from ~/.pilcrino/extension (blog-setup walks you through it).`), `extension_timeout` when one was connected, `extension_outdated` with the hint from the spec when the only extension that tried to connect had another protocol (the hint names the side to update: when the extension's protocol is newer, `update the Pilcrino plugin in Claude Code, or the Pilcrino app if it runs this blog`, otherwise `run blog-setup again to refresh ~/.pilcrino/extension, then click Reload on the extension card`). `listen()` resolving `null` means every port was taken; `search` then rejects `extension_not_connected` with detail `too many Pilcrino sessions`.
- Searches queue: one in flight per bridge; the next starts when the previous settles.
- `WebSocketServer` is created with `maxPayload: 2 * 1024 * 1024` (a capture is under 200 KB); every socket and the server get an `error` handler that logs and, for a socket, drops it (a pending search bound to it rejects `extension_timeout`). An oversized or invalid frame therefore closes that socket, and the next valid connection and search work.
- A `{ type: 'ping' }` frame from the extension is answered with `{ type: 'pong' }`; the worker (Task 3) sends one every 20 s while a socket is open.

- [ ] **Step 1: Write the failing tests**

Use `ports: [0]` so tests never touch the real range, connect with `new WebSocket(`ws://127.0.0.1:${port}`, { headers: { origin } })` from `ws`, and `deadlineMs` of 300 where a timeout is under test.

```js
test('extensionIdFromKey matches a known vector', ...)            // compute once by hand with node crypto from a fixed key string and pin the result
test('a socket with the wrong Origin is refused at the upgrade (HTTP 401, what ws sends for a boolean verifyClient refusal)', ...)
test('hello with another protocol closes 4001 extension_outdated; a later search says extension_outdated with the right hint', ...)
test('hello without a protocol field is treated as outdated', ...)
test('second extension is closed 4002 already_connected, first keeps working', ...)
test('search sends {type:search,id,url,token}; a result with the right id and token resolves; the token is single use', ...)
test('result with wrong token, unknown id, or after settle is dropped without effect', ...)
test('a non-JSON frame and a JSON frame without type are dropped, the socket stays open, the next search works', ...)
test('an oversized frame (3 MB) closes that socket without crashing; a new connection and search then work', ...)
test('an invalid WebSocket frame (raw bytes on the upgraded net socket) is survived the same way', ...)
test('no extension: search waits up to the deadline for a connection then rejects extension_not_connected', ...)
test('a connection arriving during the wait gets the search at once', ...)
test('connected but silent: extension_timeout at the deadline and a cancel frame is sent', ...)
test('socket drop during a pending search rejects extension_timeout', ...)
test('two searches run one after the other; the second is sent only after the first settles', ...)
test('lost frame rejects extension_timeout', ...)
test('ping is answered with pong', ...)
test('close() sends cancel for the pending search and stops listening', ...)
test('listen() takes the first free port of the range and returns null when all are taken', ...)   // bind a plain net server on the single port in `ports`
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd browser && npm install && node --test test/bridge.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `browser/src/bridge.mjs`**

`WebSocketServer({ host: '127.0.0.1', port, verifyClient: ({ origin }) => origin === opts.origin })`, iterating `ports` on `EADDRINUSE`. Connection handling: the first frame must be `hello`; on protocol mismatch record `lastOutdated = { protocol, plugin }` and close 4001; if a connection is already held close 4002; otherwise hold it and send `welcome`. Search state machine: `{ id, token, resolve, reject, timer, state: 'waiting'|'pending' }`; `waiting` becomes `pending` when a connection exists; deadline timer from the `search()` call. `randomUUID()` for `id`; `token` is given by the caller (Task 5 makes it). Frame handling wrapped in `try { JSON.parse } catch { log; return }`; `ws.on('error')` and `wss.on('error')` attached as the interfaces say. Ping every 20 s from the server too is not needed (the extension pings). Export `stderrLog` reuse from `tabs.mjs` or duplicate the one-liner.

- [ ] **Step 4: Run the tests**

Run: `cd browser && node --test test/bridge.test.mjs`
Expected: PASS.

- [ ] **Step 5: Add the protocol equality test**

In `bridge.test.mjs`:

```js
test('extension and server agree on the protocol version', () => {
  const src = readFileSync(join(here, '..', '..', 'extension', 'lib', 'protocol.js'), 'utf8')
  assert.equal(Number(/PILCRINO_PROTOCOL\s*=\s*(\d+)/.exec(src)[1]), PROTOCOL_VERSION)
  assert.equal(JSON.parse(readFileSync(join(here, '..', '..', 'extension', 'manifest.json'), 'utf8')).version, JSON.parse(readFileSync(join(here, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version)
})
```

Task 3 set the manifest version to the current `plugin.json` version (0.62.0), so this passes now; Task 11 bumps both to 0.63.0 together.

- [ ] **Step 6: Commit**

```bash
git add browser/src/bridge.mjs browser/test/bridge.test.mjs browser/package.json browser/package-lock.json extension/manifest.json
git commit -m "browser: WebSocket bridge for the Pilcrino extension"
```

---

### Task 5: The `serp_search` tool

**Files:**
- Create: `browser/src/serp.mjs`
- Modify: `browser/src/server.mjs` (`buildServer(session, { bridge })`, tool registration; `startServer` builds the bridge, calls `listen()` before `server.connect`, and `bridge.close()` in `bye`)
- Test: `browser/test/serp.test.mjs`, `browser/test/server.test.mjs` (tool count becomes twelve, `serp_search` in the sorted list)

**Interfaces:**
- `export function buildSearchUrl(query, { hl, gl } = {}, token) -> string`: `https://www.google.com/search?q=<encoded>&hl=<hl>&gl=<gl>&pilcrino=<token>`; `hl`/`gl` omitted when not given.
- `export function newToken() -> string`: 128 random bits, base64url (`randomBytes(16).toString('base64url')`).
- `export async function serpSearchTool(bridge, { query, outFile, locale }, ctx) -> { path, bytes, items: 1, engine: 'google', blocked?: true }`: resolves `outFile` with `resolveOutFile(outFile, ctx.roots, { profile: ctx.profile })` first (so `bad_path` happens before any socket message), builds the URL, calls `bridge.search({ url, token })`, writes `JSON.stringify({ engine: 'google', ...value }, null, 2)` to the path, returns the counts plus `blocked: true` when `value.blocked`.
- Tool schema: `{ query: z.string(), outFile: z.string(), locale: z.object({ hl: z.string().optional(), gl: z.string().optional() }).optional() }`. Description (the owner's Claude reads it): `Search Google through the Pilcrino extension in the owner's own browser and write the results to outFile as one JSON object (engine, query, url, serpFeatures, topResults, title, text, links). Returns {path, bytes, items, engine} and blocked: true when Google showed a check in the owner's browser (the tab is left open there). Fails with extension_not_connected when no extension answered within 30 s, extension_timeout when one was connected but did not reply, extension_outdated when the loaded extension has another protocol version; each carries a one-line hint for the owner.`

- [ ] **Step 1: Write the failing tests**

```js
test('buildSearchUrl encodes the query and places the marker in the query string', () => {
  const u = new URL(buildSearchUrl('a & b #c "d" é', { hl: 'en', gl: 'us' }, 'tok'))
  assert.equal(u.origin + u.pathname, 'https://www.google.com/search')
  assert.equal(u.searchParams.get('q'), 'a & b #c "d" é')
  assert.equal(u.searchParams.get('hl'), 'en'); assert.equal(u.searchParams.get('gl'), 'us')
  assert.equal(u.searchParams.get('pilcrino'), 'tok'); assert.equal(u.hash, '')
})
test('newToken is 128 bits of base64url and unique', ...)                           // length 22, matches /^[A-Za-z0-9_-]+$/, 100 distinct
test('serp_search writes the capture with engine google and returns counts only', ...) // fake bridge resolving { value: {...topResults: [..]} }; file has engine; result has no text
test('blocked value sets blocked: true on the result and in the file', ...)
test('bad outFile fails bad_path before the bridge is asked', ...)                   // fake bridge records calls; expect 0
test('bridge errors pass through with their code', ...)                              // extension_not_connected
```

And in `server.test.mjs`, change the expected tool list to twelve names including `serp_search`, and add an in-memory test that `serp_search` with a relative `outFile` is `bad_path` with a fake bridge that must not be called.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd browser && node --test test/serp.test.mjs test/server.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `serp.mjs` and wire `server.mjs`**

`buildServer(session, { bridge } = {})`; the tool handler throws `codedError('extension_not_connected', 'The Pilcrino extension bridge is not running in this server.')` when `bridge` is undefined (tests that build the server without one). `startServer`: `const bridge = createBridge({ origin: extensionOrigin(join(root, '..', 'extension', 'manifest.json')), pluginVersion })`; `await bridge.listen()` (a `null` result is logged to stderr as `pilcrino-browser: no free bridge port, too many Pilcrino sessions`); `bye` calls `await bridge.close()` before `closeOwned`.

- [ ] **Step 4: Run the tests**

Run: `cd browser && node --test test/*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add browser/src/serp.mjs browser/src/server.mjs browser/test/serp.test.mjs browser/test/server.test.mjs
git commit -m "browser: serp_search tool over the extension bridge"
```

---

### Task 6: Refreshing `~/.pilcrino/extension`

**Files:**
- Create: `browser/src/extension-copy.mjs`
- Modify: `browser/src/cli.mjs` (`refresh-extension` command), `browser/bin.mjs` (accept it in the command list and usage line), `browser/src/server.mjs` (`startServer` calls the refresh, not awaited, errors logged)
- Test: `browser/test/extension-copy.test.mjs`

**Interfaces:**
- `export const STAMP_FILE = 'pilcrino-stamp.json'` with content `{ protocol: <int>, plugin: '<semver>' }`.
- `export function compareBuilds(copyStamp, mine) -> 'newer' | 'same' | 'older'` (protocol first, then semver of `plugin`; a missing or unreadable stamp is `older`).
- `export async function refreshExtensionCopy({ src, dest, protocol, pluginVersion, fs = nodeFs, now = Date.now, lockStaleMs = 60000 }) -> { action: 'installed' | 'updated' | 'kept' | 'skipped_locked', stamp }`. `dest` defaults to `join(homedir(), '.pilcrino', 'extension')`; the lock is `dest + '.lock'` made with `mkdirSync` (EEXIST means held). A held lock is retried every 100 ms for up to `lockWaitMs` (default 5000); a lock older than `lockStaleMs` by its mtime is removed and retried. Only after the wait budget does the call return `skipped_locked`, and `startServer` logs that to stderr. Because the stamp is re-read after the lock is taken, a writer that waited behind an older writer still installs its newer build.
- Swap sequence under the lock, exactly the spec's: remove leftover `dest + '.new'` and `dest + '.old'`; re-read the stamp; decide; copy `src` to `dest.new` (`cpSync` recursive) and write the stamp there; rename `dest` to `dest.old` when it exists; rename `dest.new` to `dest`; on failure of that rename, rename `dest.old` back; remove `dest.old`; release the lock.
- CLI: `node bin.mjs refresh-extension` prints the result JSON on stdout, exit 0; exit 1 with `{ error, message }` on failure. It needs no Chrome and no packages beyond node core, so `bin.mjs` runs it before `ensureInstalled` would matter (place it with the other commands after `ensureInstalled`, which is a no-op once installed; that is acceptable).

- [ ] **Step 1: Write the failing tests**

All on a real temp directory, no mocked rename:

```js
test('first install copies the folder and writes the stamp', ...)                               // action installed; files equal to src; stamp {protocol:1, plugin:'0.63.0'}
test('same protocol, newer plugin version updates files and stamp', ...)                        // change a file in src, bump pluginVersion; action updated; file content changed
test('same protocol, older plugin version keeps the copy', ...)                                 // action kept; files unchanged
test('older protocol writer keeps a newer copy', ...)
test('newer protocol writer updates an older copy', ...)
test('a leftover .new and .old are removed at the start', ...)
test('a lock held for the whole wait budget returns skipped_locked without writing', ...)                      // lockWaitMs: 300
test('a lock released after 500 ms is waited for, then the newer build is installed', ...)                     // mkdirSync the lock, setTimeout(rmSync, 500), refresh concurrently; action updated
test('a stale lock is taken over', ...)                                                         // set the lock dir mtime back with utimesSync
test('an older writer holding the lock, then a newer writer: the newest build ends installed', ...)   // child process (spawn node -e) takes the lock, installs 0.63.0, holds 400 ms, releases; parent runs refresh for 0.64.0 meanwhile; final stamp 0.64.0 and the file content is 0.64.0's
test('compareBuilds orders protocol before plugin semver and treats a missing stamp as older', ...)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd browser && node --test test/extension-copy.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement, then wire the CLI and `startServer`**

In `startServer`, after the bridge listens: `refreshExtensionCopy({ src: join(root, '..', 'extension'), protocol: PROTOCOL_VERSION, pluginVersion }).catch((e) => log(...))` where `pluginVersion` is read from `.claude-plugin/plugin.json` two levels up (fall back to `browser/package.json` version when that file is missing, as under the app's pinned copy it is present too, so the fallback is for tests). Note `src` must exclude nothing: the extension folder holds only shippable files (no tests live there).

- [ ] **Step 4: Run the tests and the CLI once**

Run: `cd browser && node --test test/extension-copy.test.mjs && node bin.mjs refresh-extension`
Expected: PASS; the CLI prints `{"action":"installed",...}` and `~/.pilcrino/extension/manifest.json` exists.

- [ ] **Step 5: Commit**

```bash
git add browser/src/extension-copy.mjs browser/src/cli.mjs browser/bin.mjs browser/src/server.mjs browser/test/extension-copy.test.mjs
git commit -m "browser: refresh ~/.pilcrino/extension under a lock, newest build wins"
```

---

### Task 7: Host-aware check handling for Bing

**Files:**
- Modify: `browser/src/tabs.mjs` (`isBingUrl`, `checkKind(value, { onlyBlocked = false })`), `browser/src/pagetools.mjs` (`captureTool` option `bingCheck`), `browser/src/server.mjs` (`capture` passes `googleCheck: isGoogleUrl(url), bingCheck: isBingUrl(url)`; description sentence gains `On a Bing tab only a blocked value does this.`)
- Test: `browser/test/tabs.test.mjs`, `browser/test/pagetools.test.mjs`, `browser/test/server.test.mjs`

**Interfaces:**
- `export function isBingUrl(url) -> boolean` (`www.bing.com` or `bing.com`, http or https).
- `checkKind(value, { onlyBlocked })`: with `onlyBlocked` true, returns `'blocked'` or `null`, never `'noResults'`.
- `captureTool(page, script, outFile, ctx, { googleCheck = false, bingCheck = false })`: `googleCheck` as today; `bingCheck` uses `checkKind(value, { onlyBlocked: true })`.

- [ ] **Step 1: Write the failing tests**

```js
test('isBingUrl: www.bing.com yes, google.com and bing.example no', ...)
test('checkKind onlyBlocked: blocked stays blocked, empty topResults is null', ...)
test('capture on a bing tab: blocked value flags blocked, empty topResults flags nothing', async () => { /* captureTool with { bingCheck: true } twice */ })
// server.test.mjs, with the fake-browser MCP harness the Google tests near line 164 use, on a page whose url is https://www.bing.com/search?q=x:
// a blocked value leaves the tab open, titled, un-owned and in front, and closeOwned at shutdown leaves it; an empty topResults value returns the plain result and the tab closes as usual
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd browser && node --test test/tabs.test.mjs test/pagetools.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

Three small edits as the interfaces say. In `server.mjs` the `capture` handler computes `const url = p.url()` once and passes both flags; `leaveOpen` runs when `res.blocked || res.noResults` as today (on Bing `noResults` is never set).

- [ ] **Step 4: Run the whole browser suite**

Run: `cd browser && node --test test/*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add browser/src/tabs.mjs browser/src/pagetools.mjs browser/src/server.mjs browser/test/tabs.test.mjs browser/test/pagetools.test.mjs browser/test/server.test.mjs
git commit -m "browser: a Bing capture retains the tab only on a check"
```

---

### Task 8: blog-post-workflow branches on `research.serp`

**Files:**
- Modify: `skills/blog-post-workflow/SKILL.md` (frontmatter `allowed-tools`; §Browser sign-in gate near line 117; Step 4.2 near line 340; the autopilot park table near line 1450)
- Modify: `skills/blog-post-workflow/references/console-contract.md` (§Park reasons list near line 367, and the RUN-side emitter list below it)
- Modify: `templates/research-serp.md` (line 9 `Search engine:` and line 5 `Source:`), `agents/blog-researcher.md` (where it says Google SERP, say "the SERP (Google or Bing; `engine` in `_serp.json` says which)")

**Interfaces:**
- Consumes: `serp_search` (Task 5), Bing capture flags (Task 7), config key (Task 1).
- Produces: `_serp.json` always carries `engine`; park reason `extension_not_connected` in the contract.

- [ ] **Step 1: Config preamble and sign-in gate**

Where the skill's Step 0 config preamble lists the config values it reads (search for `modules.reddit_research` in the preamble area and add next to it): `research.serp` (default `bing`). In §Browser, change the `login_status` call to:

```
  sites: [<"google" if research.serp is google><, "reddit" if modules.reddit_research><, "x" if modules.x_research>]
```

and add the sentence: `Under bing and extension Google is not in the list: Bing needs no account, and the extension searches in your own browser, which is already signed in. If the list is empty, skip the call.`

- [ ] **Step 2: Rewrite Step 4.2 as three branches**

Keep today's text as the `google` branch, verbatim, under a heading `research.serp: google (today's flow)`. Add before it:

`research.serp: bing (default)`: the same `navigate` (to `https://www.bing.com/search?q=<URL-encoded target keyword>`), `wait` 2000 and `capture` to `_serp.json` with this script:

```js
if (/verify you are human/i.test(document.body.innerText)) return { engine: 'bing', blocked: 'bing_check', query: new URLSearchParams(location.search).get('q') };
const algo = Array.from(document.querySelectorAll('li.b_algo'));
const results = algo.map(li => li.querySelector('h2 a')).filter(a => a && a.href.startsWith('http'))
  .map(a => ({ url: a.href, title: a.innerText.trim() })).filter(r => r.title).slice(0, 10);
return { engine: 'bing', query: new URLSearchParams(location.search).get('q'), searchedAt: new Date().toISOString(),
  resultCount: algo.length, serpFeatures: [], topResults: results.map((r, i) => ({ rank: i + 1, url: r.url, title: r.title })) };
```

Then the rules: `The tool returns {path, bytes, items}, plus blocked: true, leftOpen: true only when the script returned blocked. Read the file. resultCount 0 with no blocked is a query with no results: wait 4000 ms, navigate and capture once more; still 0: write _serp.json as it is and go on to Step 4.3 with an empty selection (the researcher records "no results"). blocked: stop and tell the owner, word for word, "Bing is asking for a check. Pass it in the Pilcrino browser window that is open, then retry." (autopilot: park serp_blocked with that sentence as detail). Never show the Google sentence under bing.`

`research.serp: extension`: no tab for this step. Call

```
mcp__plugin_pilcrino_pilcrino-browser__serp_search
  query: <target keyword>
  outFile: {drafts_dir}/<slug>/research/_raw/_serp.json
```

Rules: `The file already has the shape Step 4.3 reads, with engine: google. blocked: true: tell the owner "Google asked for a check in your own browser; pass it there, then say retry." (the file says blocked: consent: "Google is showing a consent page in your own browser; accept it there, then say retry."); autopilot: park serp_blocked with that sentence. The tool fails with extension_not_connected, extension_timeout or extension_outdated: tell the owner, in words, that the Pilcrino extension did not answer, that their browser must be running with the extension loaded (for extension_outdated, repeat the tool's hint), and offer to retry or to switch to Bing for this run (then follow the bing branch, in a tab you open now); autopilot: park extension_not_connected with the tool's message as detail. topResults empty with no blocked: a query with no results, as on Bing (one retry after 4000 ms, then go on).`

Add `engine: 'google'` to the existing Google script's return object so every `_serp.json` has the field. The Bing script's first line is the comment `// pilcrino-bing-serp-script` so the test below can find it.

Add `browser/test/skill-scripts.test.mjs`: it reads both SKILL.md files, extracts each fenced script that begins with `// pilcrino-bing-serp-script` (blog-post-workflow) or `// pilcrino-plan-content-capture-script` (plan-content, Task 9), runs it with `new Function('document', 'location', body)` on linkedom documents built from `browser/test/fixtures/serp/bing-results.html` (eight `li.b_algo` with `h2 a`), `bing-empty.html` (a long page, over 3000 characters of navigation and footer text, no `li.b_algo`) and `bing-check.html` (`verify you are human`), and asserts, for both scripts: results give `engine: 'bing'` and `resultCount: 8`; the empty page gives `resultCount: 0` and no `blocked`; the check page gives `blocked: 'bing_check'`. Then per script: blog-post-workflow's gives ranked `topResults` (eight, `rank` 1 to 8, each with `url` and `title`) and `serpFeatures: []`; plan-content's keeps its own shape (`url`, `title`, `text` non-empty, `links` an array) and has no `topResults`. This pins the scripts the skills carry to the behaviour the branches assume.

- [ ] **Step 3: Autopilot table, allowed-tools, contract, templates**

In the park table near line 1450, replace the row `SERP capture returns 0 results or blocked (captcha or bot-block) ...` with three source-specific rows: `| research.serp google: SERP capture returns 0 results or blocked | Park serp_blocked with the Google sentence |`, `| research.serp bing or extension: the capture or serp_search says blocked | Park serp_blocked with that branch's sentence |`, `| research.serp bing or extension: 0 results after the one retry | Not a park: record no results and go on |`, and add `| serp_search fails with extension_not_connected, extension_timeout or extension_outdated | Park extension_not_connected with the tool's message as detail |`. Grep the skill for the old unconditional sentence afterwards; it must appear only inside the `google` branch. Add `mcp__plugin_pilcrino_pilcrino-browser__serp_search` to the frontmatter `allowed-tools`. In `console-contract.md` add `extension_not_connected` after `serp_blocked` in the list and in the RUN-side emitter list, with one line: `the Pilcrino extension did not answer a serp_search under research.serp: extension; detail carries the tool's hint`. In `templates/research-serp.md` line 9: `- Search engine: <google | bing, from engine in _serp.json>`; line 5: `Source: the SERP capture in _serp.json (Google or Bing, see engine)`. In `agents/blog-researcher.md`, where the SERP source is named Google, add the same parenthetical once.

- [ ] **Step 4: Lint and the script test**

Run: `./tests/lint.sh && (cd browser && node --test test/skill-scripts.test.mjs)`
Expected: no `LINT FAIL` lines (check 7 resolves every `${CLAUDE_PLUGIN_ROOT}` reference; the YAML block check passes); the script test passes for blog-post-workflow (its plan-content case is added in Task 9).

- [ ] **Step 5: Commit**

```bash
git add skills/blog-post-workflow templates/research-serp.md agents/blog-researcher.md browser/test/skill-scripts.test.mjs browser/test/fixtures/serp
git commit -m "blog-post-workflow: SERP capture follows research.serp (bing, google, extension)"
```

---

### Task 9: plan-content branches on `research.serp`

**Files:**
- Modify: `skills/plan-content/SKILL.md` (Step 0 research switches near line 239; the autopilot contract's reason list near line 121 and the browser lines near line 42; the sign-in gate near line 297; Step 2's capture block near line 340; Step 4 near line 369; the Step 10 checklist near line 742)
- Modify: `skills/plan-content/references/queries.md` (§Reading a Google result page: title becomes `Reading a result page (Google or Bing)`, first line names both URLs; Bing has no AI Overview or Discussions block, say so in one line)

**Interfaces:**
- Produces: result-file reasons `extension_blocked` and `extension_not_connected` (the app plan consumes them).

- [ ] **Step 1: Step 0 and the gate**

Add to the research switches: `research.serp (bing when missing) decides where Step 4 searches: bing or google in the Pilcrino browser, or extension through serp_search in the owner's own browser.` The autopilot paragraph near line 56 (`A Google block later in the run ... retries in a new tab ... fails with blocked`) is scoped with a leading `Under research.serp: google,`; add after it: `Under bing a Bing check is handled the same way with the Bing sentence; under extension a check or consent page in the owner's browser fails with extension_blocked and a silent extension with extension_not_connected (Step 4).` Change the sites in play (lines near 42 and 297): `google` is in play only under `research.serp: google`; under `bing` and `extension` the list is `reddit` and `x` as switched, and an empty list means no `login_status` call.

- [ ] **Step 2: Step 2 and Step 4**

In Step 2's capture script (its first line becomes the comment `// pilcrino-plan-content-capture-script`) add Bing awareness: the existing Google check line stays; add before the return:

```js
if (/(^|\.)bing\.com$/.test(location.hostname)) { if (/verify you are human/i.test(document.body.innerText)) return { engine: 'bing', blocked: 'bing_check', url: location.href, query: new URLSearchParams(location.search).get('q') }; }
```

and in the returned object add `engine: /bing\.com$/.test(location.hostname) ? 'bing' : 'google', resultCount: document.querySelectorAll('li.b_algo').length`.

Step 4 heading becomes `## Step 4: Search` with three sub-blocks. `bing`: URL `https://www.bing.com/search?q=<url-encoded query>`, same pacing, `resultCount: 0` with no `blocked` is retried once after the wait then recorded as "no results" in the SERP notes entry and the run goes on; `blocked`: interactive sentence `Bing is asking for a check. Pass it in the Pilcrino browser window that is open, then tell me to carry on.`, autopilot fails with `blocked` and that sentence as detail (the Google paragraph's wait-and-retry applies the same way). `google`: today's text unchanged. `extension`: open one `about:blank` tab with `tabs open` at the start of the round and keep it only for pacing: the 4000 to 6000 ms `wait` (`tabId`, `ms`) between `serp_search` calls runs on it (the headless session has no shell, so no `sleep`); close it with the other tabs at the end. One `serp_search` per query with `outFile: {raw}/<round>-<n>.json` and `locale: { hl: 'en', gl: 'us' }`. Outcomes: `blocked: true` in the result and the file says `blocked: 'unusual_traffic'`: interactive `Google asked for a check in your own browser; pass it there, then tell me to carry on.`; the file says `blocked: 'consent'`: interactive `Google is showing a consent page in your own browser; accept it there, then tell me to carry on.`; autopilot fails with `extension_blocked` and the matching sentence as detail. `topResults` empty with no `blocked`: a query with no results; `wait` 4000 ms and call `serp_search` once more; still empty: record `no results` in the notes entry and go on. Tool error `extension_not_connected`, `extension_timeout` or `extension_outdated`: interactive, say the extension did not answer and the browser must be running with it loaded (repeat the tool's hint for `extension_outdated`), offer retry or Bing for this run; autopilot fails with `extension_not_connected` and the tool's message as detail. Update the reason list near line 121 to the seven reasons.

- [ ] **Step 3: Notes and checklist**

The SERP notes file's first line names the engine: `Engine: google` or `Engine: bing`. The Step 10 checklist line about Google queries reads `Every search query in the bank captured ...`. Update `queries.md` as the Files block says.

- [ ] **Step 4: Lint, script test, commit**

Add the plan-content case to `browser/test/skill-scripts.test.mjs` (Task 8) and run `./tests/lint.sh && (cd browser && node --test test/skill-scripts.test.mjs)` (expected clean and passing), then:

```bash
git add skills/plan-content browser/test/skill-scripts.test.mjs
git commit -m "plan-content: search round follows research.serp; two extension failure reasons"
```

---

### Task 10: blog-setup asks the question and installs the extension

**Files:**
- Modify: `skills/blog-setup/SKILL.md` (frontmatter `allowed-tools`; the phase table near line 50; Phase 3 question list near line 1448 and its `config.yaml` merge block near line 1490; Phase 3.5 step 1 near line 1797; the summary and `What next`)

**Interfaces:**
- Consumes: `node ${CLAUDE_PLUGIN_ROOT}/browser/bin.mjs refresh-extension` (Task 6), `serp_search` (Task 5).

- [ ] **Step 1: The question (Phase 3, question 6)**

After question 5 add question 6 with the spec's wording verbatim (the four lines starting `Where should Pilcrino get search results from?` through `You can change this later.`), as an `AskUserQuestion` with the three options in that order, option 1 first. `Quick path: ask, counted. Default 1.` On a re-run with an existing `research.serp`, the current value is the default and the question says `(currently: <value>)`. Merge into `config.yaml`:

```yaml
research:
  serp: <bing | google | extension>
```

- [ ] **Step 2: The install walk-through (extension only)**

Add a subsection `### Installing the Pilcrino extension` after question 6, with the spec's four steps:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/browser/bin.mjs" refresh-extension` with Bash; on `{ "error": ... }` say the message and offer Bing.
2. Ask which browser they use day to day (Google Chrome, Brave, Microsoft Edge, another Chromium browser, something else such as Safari or Firefox), not counted and not saved; add `Load it in that one browser only.` On "something else": the spec's sentence about needing a Chromium browser kept open, offer to go on or take Bing, save the pick.
3. Say, in these words or close to them: `Open your browser and go to chrome://extensions (in Brave brave://extensions, in Edge edge://extensions). Turn on Developer mode, top right. Click Load unpacked and choose this folder: ~/.pilcrino/extension. Tell me when it is loaded.` Reveal the folder: macOS `open ~/.pilcrino/extension`, Linux `xdg-open`, Windows (Git Bash) `explorer "$(cygpath -w ~/.pilcrino/extension)"` (the forms setup already uses near line 2046).
4. On the reply, call `mcp__plugin_pilcrino_pilcrino-browser__serp_search` with `query: "pilcrino test search"` and `outFile` `<repo root>/blog-ops/serp-test.json` (absolute, derived with `git rev-parse --show-toplevel`; no dot segment, since the browser refuses paths with one below the root), then delete the file. Report `The Pilcrino extension is installed and working.` or the failure in plain words (`extension_not_connected`: the extension is not loaded or the browser is not running; `blocked`: the owner's browser got a check, rare). Offer to try again or to switch to Bing for now; save whichever they pick.

- [ ] **Step 3: Sign-in list, summary, allowed-tools, phase table**

Phase 3.5 step 1: `google` only when `research.serp` is `google`; add the sentence `Under bing and extension Google is not needed here.` The setup summary gains one line: `Search results: Bing in Pilcrino's browser` (or the other two wordings). Frontmatter `allowed-tools` gains `mcp__plugin_pilcrino_pilcrino-browser__serp_search`. The phase table's Phase 3 owner name stays.

- [ ] **Step 4: Lint and commit**

Run: `./tests/lint.sh` (expected clean), then:

```bash
git add skills/blog-setup/SKILL.md
git commit -m "blog-setup: asks where search results come from; installs the Pilcrino extension"
```

---

### Task 11: README, version, changelog, CI, spike removal, manual runs

**Files:**
- Modify: `README.md` (What it does near line 12; What you need accounts list near line 176; The Pilcrino browser near line 356; Uninstall near line 384; Changelog top near line 771), `.claude-plugin/plugin.json` (0.63.0), `extension/manifest.json` (`version` 0.63.0), `tests/lint.sh` (check 13's dir loop: no change needed since extension tests live in `browser/test`; add a check 15 that `extension/manifest.json` parses and its `version` equals `plugin.json`'s), `.github/workflows/plugin.yml` (no new line needed: browser tests already run)
- Delete: `spike/`

- [ ] **Step 1: README**

What it does: two sentences after the research bullet: `Search results come from Bing in Pilcrino's own browser by default, with no robot checks. You can pick Google instead, in Pilcrino's browser (one robot check per run) or through a small Pilcrino extension in your own browser (no checks, one install by hand); setup asks.` What you need, accounts: `Google, for research, only if you pick Google in Pilcrino's own browser at setup.` The Pilcrino browser section: move the robot-check sentences under a paragraph starting `If you chose Google in Pilcrino's browser, ...`, and add a paragraph `If you chose the Pilcrino extension, ...` (what it does, one browser only, developer-mode notice, how to remove). Uninstall: add the two lines `remove the Pilcrino extension from chrome://extensions, then` and `rm -rf ~/.pilcrino/extension`.

- [ ] **Step 2: Version and changelog**

`plugin.json` and `extension/manifest.json` to `0.63.0`. Changelog entry at the top:

```markdown
### 0.63.0 - Search results from Bing, Google, or the Pilcrino extension

- Setup asks where search results come from. Bing in Pilcrino's own browser is the default: no robot checks, runs while you are away. Google in Pilcrino's browser stays as a choice, with its one check per run. New: Google through a small Pilcrino extension in your own browser, installed once by hand, no checks (task #139: every new Pilcrino browser session hit Google's check because Chrome 155 reports remote control to pages).
- The browser server has a `serp_search` tool and a loopback bridge the extension connects to (ports 47390 to 47399); the extension only ever touches tabs it opened, closes them when read, and leaves a check tab open for you.
- A Bing search with no results is not a check: the run retries once and goes on.
- `research.serp` in `config.yaml`; validator check 17.
```

- [ ] **Step 3: Lint check for the manifest**

Append to `tests/lint.sh` before the final exit:

```bash
# <next free number>. The extension's manifest version is the plugin version
if [ -f extension/manifest.json ]; then
  mv_=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync("extension/manifest.json","utf8")).version)')
  pv_=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(".claude-plugin/plugin.json","utf8")).version)')
  [ "$mv_" = "$pv_" ] || err "extension/manifest.json version $mv_ differs from plugin.json $pv_"
fi
```

- [ ] **Step 4: Remove the spike and run everything**

```bash
rm -rf spike
./tests/lint.sh && (cd browser && node --test test/*.test.mjs)
```

Expected: no `LINT FAIL`, all browser tests pass.

- [ ] **Step 5: Manual runs on this Mac (not committed)**

With a test blog's `config.yaml`:
- `research.serp: extension`, extension loaded in one browser from `~/.pilcrino/extension` (after `node browser/bin.mjs refresh-extension`): run `/pilcrino:plan-content "<idea>"` and watch the Google round: tabs open in the background in your browser and close; no window comes forward; `serp.md` lists results. Then close that browser and run one more search: the skill reports the extension did not answer within 30 s and offers Bing.
- `research.serp: bing`: run one post's research (`/pilcrino:blog-post-workflow` to the end of Stage 1a): `_serp.json` has `engine: bing` and `resultCount`; no sign-in gate for Google.
- `research.serp: google`: one search in the Pilcrino browser still reaches the check tab as before (nothing regressed).
Record the three outcomes in the PR description.

- [ ] **Step 6: Commit and open the PR**

```bash
git add README.md .claude-plugin/plugin.json extension/manifest.json tests/lint.sh
git commit -m "release 0.63.0: search results from Bing, Google, or the Pilcrino extension"
```

Then branch, push and open the PR per the repo's flow (CI runs `tests/lint.sh` and the browser tests on three platforms). After merge, tag `v0.63.0`; the app plan pins that tag.

## Review log

- Codex plan review round 1 (8 Nov 2026): setup test path without a dot segment; worker binds requests to the socket and cancels on any drop; lock contention is waited out and tested across processes; the old unconditional park and retry rules are replaced, not supplemented; a retained blank tab paces the extension round (no shell in headless runs); plan-content handles consent and empty results; linkedom is a regular dependency so the install prune cannot remove it; maxPayload and error handlers on the bridge; server-level Bing tests and fixture-driven tests of the skills' capture scripts; validator totals and the 401 expectation.
- Codex plan review round 2 (8 Nov 2026): the skill-script test asserts the shared Bing fields for both scripts and each script's own success shape (plan-content keeps text and links, no topResults); Task 7 stages its server tests.
