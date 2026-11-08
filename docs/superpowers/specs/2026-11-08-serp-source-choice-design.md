# Where search results come from: a choice of three

## Why

Since 5 Oct 2026 (0.40.0) research runs in the Pilcrino browser, a Chrome of its own launched with `--remote-debugging-port`. Since mid October every Pilcrino run has started with Google's robot check. The profile's own history shows the pattern on 16 of 18 days with searches: the first Google search of a run is redirected to `/sorry` within one second, the owner solves it, Google sets a three-hour exemption cookie, and the next eight to ten searches pass. Task #139 (lucky72o/slavhurmanau) holds the findings.

Controlled experiments on 6 Nov settled the cause. Any Chrome launched with a remote-debugging transport, port or pipe, now reports `navigator.webdriver = true` to every page, and Google's search page blocks on it at once. Chrome 154 reported `false` on 5 Oct (the 0.40.0 spec measured it); Chrome 155 and 156 report `true`. It is not the profile (an empty profile is blocked the same way), not the IP (a Chrome without the flag passes on the same connection), not Puppeteer (blocked with raw CDP and no Puppeteer attached), not background tabs, and `--disable-blink-features=AutomationControlled` no longer hides it. Loading our own extension into a flagless Chrome is out too: `--load-extension` is ignored in branded Chrome since 137. Bing and DuckDuckGo serve normal results to the same debug-launched Chrome.

So the Google search step has to leave the debug-launched Chrome, or accept the check. Everything else the Pilcrino browser does (Reddit, X, LinkedIn, reading pages, screenshots) is unaffected.

A spike on 8 Nov proved the third option: a throwaway extension in the owner's own browser (Brave, in the test) read five of five Google searches with no check, seven to nine organic results each, one to two seconds per search.

## What changes

The owner chooses, at setup and in `config.yaml`, where search results come from:

| Choice | `research.serp` | What the owner gets | What it costs them |
|---|---|---|---|
| Bing in the Pilcrino browser (**default**) | `bing` | Nothing to install, no checks, runs unattended | Bing's ranking, not Google's; no AI Overview flag |
| Google in the Pilcrino browser | `google` | Real Google results and the AI Overview flag, nothing to install | One robot check per run (about every three hours), at the keyboard; an unattended run parks on it |
| Google through the Pilcrino extension in their own browser | `extension` | Real Google results, no checks, runs unattended | A one-time install by hand in developer mode; the browser nags about developer-mode extensions until the extension is on the Web Store; a tab opens and closes in their browser per search |

The choice applies to every Google search Pilcrino makes: the SERP capture in `blog-post-workflow` (Stage 1a) and the Google round in `plan-content`, including its `site:reddit.com` queries. Reddit, X, LinkedIn, competitor reads and deep fetches stay in the Pilcrino browser under every choice.

## Goals

- A new owner who takes the defaults never sees a robot check and never installs anything beyond Chrome.
- An owner who wants Google's own ranking has two ways to get it, and setup says plainly what each costs.
- The choice is one config key, asked at setup on both paths and changeable later by editing `config.yaml` or re-running setup.
- The research files keep their shape. The researcher agent, the plan reviewer and the content planner read `_serp.json` and the plan-content capture files as they do today, plus an `engine` field.
- The app follows the same key with no new UI: its sign-in gate stops requiring Google when Google is not searched in the Pilcrino browser, and its parked cards say the right thing for each choice.

## Non-goals

- Moving Reddit, X, LinkedIn, competitor reads or deep fetches into the extension. The owner's browser is automated for one page type only, and never clicked or typed into.
- A Chrome Web Store listing. Wanted later (it removes the developer-mode nag), out of scope here.
- A search API (SerpAPI, Brave, Google Programmable Search). Keys and billing for the owner; not now.
- Hiding automation from Google. Every option here either accepts the check or searches from a browser Google already trusts.
- Changing how a block is handled under `google` beyond wording: the 0.45.1 "Pilcrino: pass the check" tab and the 0.59.2 plan-content stop stay.

## Anti-goals

- The extension doing anything on a page without Pilcrino's marker, or on any site but Google search. The owner's own searches are never touched.
- Anything but the extension's own service worker talking to the local server: no page may reach it, and no request without a live token is accepted.
- An unattended run on `extension` silently falling back to a blocked Pilcrino-browser search. A missing extension is reported as such.
- Setup recommending `google` or `extension` to a first-time owner. The default is `bing`; the others are offered, with their costs, not pushed.

## The config key

```yaml
research:
  serp: bing          # bing (default) | google | extension
```

`research` is a new top-level block; `config-schema.md` gains it next to `browser`. A missing block means `bing`. `validate-config.mjs` checks the value is one of the three. The owner's everyday browser is not recorded: the server never launches it (below), so nothing needs its path. `browser.executable` stays what it is, the Chrome the Pilcrino browser launches.

## Setup

Both paths ask the question, after the research-source questions (Reddit, X) and before the browser sign-in, because the answer decides whether Google is in the sign-in list.

Wording, in these words or close to them:

> Where should Pilcrino get search results from? It searches for every post and plan.
> 1. Bing, in Pilcrino's own browser (recommended). Nothing to install, no robot checks, works while you are away. Bing's ranking is not Google's, and there is no AI Overview flag.
> 2. Google, in Pilcrino's own browser. Google's own results. Google asks you to prove you are not a robot once per session, about every three hours, so you need to be at the keyboard; a run while you are away waits for you.
> 3. Google, through a small Pilcrino extension in your own browser. Google's own results, no checks, works while you are away. You install the extension once by hand (about a minute, I'll walk you through it), and your browser shows a "developer mode" notice when it starts until the extension is in the Chrome Web Store.
> You can change this later.

Quick path: ask, counted. Default 1.

On `extension`, setup runs the install walk-through right away (below). On `google`, Google joins the sign-in list as today. On `bing` and `extension`, Google leaves the sign-in list: a Bing search needs no account, and the extension searches in a browser that is already signed in. Setup's summary repeats the choice in one line.

Re-running setup on an existing blog offers the current value as the default and says which it is.

### The install walk-through (extension only)

1. Setup copies the extension from `${CLAUDE_PLUGIN_ROOT}/extension/` to `~/.pilcrino/extension/` (overwriting), so the path the owner loads survives plugin updates. The plugin's own copy is the source of truth; every later `blog-setup` run and the browser server's first start after an update refresh the copy when the plugin version differs from the stamp inside it.
2. It asks which browser the owner uses day to day: Google Chrome (default), Brave, Microsoft Edge, another Chromium browser, or something else (Safari, Firefox). The answer only picks the wording of the next step and is not saved. It adds: load the extension in that one browser only. On "something else" it says, in words, that the extension only works in a Chromium browser that is open while Pilcrino researches, so for them it would mean keeping Chrome open; it offers to go on anyway or to take Bing instead, and saves whichever they pick.
3. It says, in these words or close to them: "Open your browser and go to `chrome://extensions` (in Brave `brave://extensions`, in Edge `edge://extensions`). Turn on Developer mode, top right. Click Load unpacked and choose this folder: `~/.pilcrino/extension`. Tell me when it is loaded." On macOS it reveals the folder in Finder (`open`); on Windows and Linux the equivalents already used by setup.
4. On the owner's reply it runs one test search through the browser server's `serp_search` tool (below) with a harmless query and reports "The Pilcrino extension is installed and working" or the failure in plain words: not connected within the deadline (the extension is not loaded or the browser is not running), or `blocked` (the owner's own browser got a check, rare). It offers to try again or to switch to Bing for now. The choice is saved either way.

Uninstall: the README's uninstall list gains "remove the Pilcrino extension from `chrome://extensions`, then delete `~/.pilcrino/extension`".

## The browser server

One new MCP tool on `pilcrino-browser`, `serp_search`, and one new piece of state, the extension bridge. Nothing else changes; the existing `tabs`, `navigate`, `capture` and `wait` tools stay as they are for Bing and for `google`.

### `serp_search`

Input: `query` (string), `outFile` (a path under the same output roots `capture` accepts), `locale` (optional, `hl` and `gl` as plan-content passes today). Output: `{ path, bytes, items, engine: 'google' }` on success, exactly what `capture` returns; `{ ..., blocked: true }` when the page was a check; the error `extension_not_connected` with a one-line hint when no extension answered within the deadline; `bad_argument` on a bad path, as `capture`.

The file it writes is one JSON object with both shapes the skills read today, so neither skill needs two tools:

```json
{
  "engine": "google",
  "query": "...", "searchedAt": "...", "url": "...",
  "serpFeatures": ["people_also_ask"],
  "topResults": [{ "rank": 1, "url": "...", "title": "..." }],
  "title": "...", "text": "<first 20000 chars of innerText>",
  "links": [{ "href": "...", "text": "..." }]
}
```

`topResults` and `serpFeatures` are what blog-post-workflow reads; `text` and `links` are what plan-content reads. `blocked: 'unusual_traffic'` replaces the body when the page is a check.

### The extension bridge

- The server listens on `127.0.0.1` only, on the first free port in a fixed range the extension also knows, 47390 to 47399. One listener per server process, started when the server process starts (not on the first search), so the extension has connected long before the first query. It speaks WebSocket to the extension and nothing else; there is no HTTP API.
- Many server processes run at once: every Claude session has its own, and the app starts one per headless run. Each takes its own port, and the extension holds one socket per live port (below), so every server has its own connection and a capture always returns to the server that asked for it. Ten ports cap the number of concurrent servers at ten; the eleventh fails `serp_search` with `extension_not_connected` and the detail "too many Pilcrino sessions".
- It accepts a WebSocket only when the `Origin` header is the extension's own origin. The extension's id is fixed by a `key` in its manifest, so the origin is the same on every computer.
- Each search is one message to the extension: `{ id, url, token }`. The URL is `https://www.google.com/search?q=<query>&hl=..&gl=..&pilcrino=<token>` (the marker in the query, not the fragment: Google rewrites the URL on load and drops fragments). The token is 128 random bits, single use, valid for one search, and expires with it. The reply must carry it.
- Deadline: 30 seconds from the `serp_search` call to the reply. If no extension is connected when the call arrives, the server waits within the same 30 seconds for one to connect (the extension rescans the port range every 5 seconds while it has any socket open, every 30 seconds otherwise), and sends the search as soon as it does. At the deadline the error is `extension_not_connected` if no extension ever connected, `extension_timeout` if one was connected.
- One search at a time per server process; a second `serp_search` queues behind the first and its 30 seconds start when it is sent.
- One extension per server. The server keeps the first accepted socket as its connection and closes any later socket from another extension instance (another browser or profile with the extension loaded) with a close reason `already_connected`; the extension retries a refused port on a backoff of 30 seconds (so when the browser that held the connection closes, the other instance takes the port within a minute). When the connection drops, the next socket to arrive is accepted. Setup tells the owner to load the extension in one browser only, and the README says so too.
- Every search has a lifecycle at both ends: `pending` (sent), `done` (reply accepted), `cancelled`. The server cancels on the deadline, when its socket drops, and when the process exits (it sends `{ cancel: id }` while the socket is open). A reply for an id that is not `pending` (late, replayed, unknown, or with the wrong token) is dropped without effect. The extension treats `cancel`, a dropped socket and a 60-second local safety timer the same way: it forgets the request and closes the tab it opened for it, only if the tab is still owned (below) and not one it kept for the owner as blocked. Ownership ends the moment the tab's URL stops carrying `pilcrino=<token>` in its query (Google's own rewrite with `sei` keeps it; the owner typing another search or leaving Google drops it), except for the check and consent landings the worker recognises. A tab that lost ownership, or was closed, is left alone; both end the request with `tab_lost`, which the server reports as `extension_timeout`. Every close the worker performs re-reads the tab's current URL first and skips the close if ownership has ended.
- The server checks every URL it sends is `https://www.google.com/search?...`; the extension refuses any other URL it receives.

### No fallback to a browser launch

The server never launches a browser or hands a URL to a running one for a search. Launching the owner's binary brought their window forward (the spike behaved like that), a URL launched from outside the extension cannot be matched to the server that asked for it when several run, and "already running" cannot be told from the Pilcrino browser, which is the same executable on another profile. When no extension answers, `serp_search` fails with `extension_not_connected` and the skills say what to do. The 30-second connection wait above covers the two cases the fallback was for: the first search after a server starts, and a service worker that was put to sleep.

## The extension

Lives in the plugin at `extension/`, MIT like the rest. Manifest V3, name "Pilcrino", a fixed `key`, permissions `tabs` and `alarms`, host permissions `https://www.google.com/*` and `http://127.0.0.1/*` (for the WebSocket; `ws:` is covered by the http origin), one content script on `https://www.google.com/search*` at `document_idle`, one service worker. No remote code, no other hosts, no storage of page content.

Service worker:
- Keeps one WebSocket open to every port in the fixed range that answers, so each running server has its own connection. While at least one socket is open the worker stays alive (it pings each under 30 seconds) and rescans the range every 5 seconds for new servers; with no socket open it rescans on a 30-second alarm, the slowest Manifest V3 allows, which is why the server's listener starts at process start rather than at the first search.
- On `{ id, url, token }`: checks the URL is `https://www.google.com/search?...`, opens it with `chrome.tabs.create({ url, active: false })`. The owner's window does not come forward. Remembers `{ id, token, socket }` against the tab id.
- Watches its own tabs with `chrome.tabs.onUpdated` and `onRemoved`. A Google check is a redirect to `https://www.google.com/sorry/...`, and a consent page is `https://consent.google.com/...`; neither URL runs the content script, and the marker is gone from the address. When an owned tab lands on either, the worker replies `blocked: 'unusual_traffic'` or `blocked: 'consent'` itself, makes that tab active so the owner can pass the check, and forgets it (it stays open). An owned tab that is closed before it reports, or whose address the owner changes (ownership rules above), ends the request with `tab_lost`.
- On a content-script message: accepts it only when `sender.tab.id` is an owned tab, `sender.frameId` is 0 and the message's token matches the one remembered for that tab. Anything else is ignored with no side effect: a Google page the owner opened with a `pilcrino` parameter in the address, a message from a frame, a stale token, a message from a tab whose ownership has ended. An accepted capture goes back over the remembered socket with the id and token. If the capture is `blocked` (an inline check on `/search`, which the content script detects from the page), the tab takes the same path as a URL-detected check: it stays open, is made active, and is forgotten. Otherwise the worker re-reads the tab's URL and closes it only if it still carries the token.
- Does nothing else. It never touches a tab it did not open.

Content script:
- Returns at once unless `location.search` carries `pilcrino=<token>`.
- Polls every 250 ms up to 10 seconds until at least five organic results are present or the page is a check, then reads: the top ten organic results (the same selectors blog-post-workflow uses today), the SERP features (AI Overview, featured snippet, People also ask, shopping), the title, the first 20000 characters of `innerText`, the first 200 links; or `blocked: 'unusual_traffic'`.
- Sends one message to the service worker and is done.

The spike's content script in `spike/extension/content.js` is the reference for the read; it read the results at idle in one millisecond on five of five pages.

Versioning: the extension and the server share a **protocol version**, a small integer, separate from the plugin version, bumped only when the messages between them change. The extension's manifest carries it (and the plugin version, for display). The server refuses a connection with a different protocol version with `extension_outdated` and a hint to run `blog-setup` again (which refreshes `~/.pilcrino/extension`; the owner then clicks the reload icon on the extension card; the hint says so). Ordinary plugin releases, which bump the plugin version on every change, do not make the extension outdated. In autopilot `extension_outdated` parks as `extension_not_connected` with that hint as the detail.

Who owns `~/.pilcrino/extension`: both the owner's Claude Code plugin and the app's pinned plugin copy may refresh it, and they may be at different plugin versions. The copy carries a stamp file with its protocol version and plugin version. A writer refreshes when the copy is missing, when its protocol version is older than the writer's, or when the protocol versions are equal and the copy's plugin version is older than the writer's (semver order, so selector and security fixes arrive and an older pinned app never overwrites a newer build); it never writes when the copy is newer on either count. The check and the write run under a lock (`~/.pilcrino/extension.lock`, a directory made with `mkdir`, stale after 60 seconds): take the lock, re-read the stamp, decide, write the new copy to a sibling folder `extension.new`, move the installed folder aside to `extension.old` (a rename cannot replace a non-empty folder), rename `extension.new` to `extension`, delete `extension.old`, release. If the second rename fails, `extension.old` is renamed back before the lock is released; a leftover `extension.old` or `extension.new` found at the start of a refresh is removed. Two writers at once therefore cannot leave a half-written folder, the previous complete copy survives until the new one is in place, and the newest build always ends up installed. The browser's loaded extension keeps running from the old inode until the owner clicks reload, which the hint asks for. When the two sides are at different protocol versions, the newer one owns the folder and the older server reports `extension_outdated` with a hint naming what to update: "update the Pilcrino app" when the app's pinned plugin is the older one, "update the Pilcrino plugin in Claude Code" otherwise. The hint is built from the two versions the server can see: its own, and the connecting extension's. Protocol bumps are rare by construction, so this state is short-lived.

## Bing in the Pilcrino browser

The existing `navigate` and `capture` tools on `https://www.bing.com/search?q=<query>`. The capture script in blog-post-workflow gets a Bing branch: organic results from `li.b_algo h2 a`, no features (Bing's are not Google's; `serpFeatures` is `[]`), `engine: 'bing'`. plan-content's capture (text and links) works on Bing unchanged apart from the URL and `engine`. Both Bing scripts count `li.b_algo` after the wait and return it as `resultCount`; a `resultCount` of 0 is the empty-results signal in both skills (plan-content's text length is not a signal, since a zero-result Bing page is still long). Both scripts return `blocked: 'bing_check'` when the page text says "verify you are human" or a Bing challenge page is showing; this has not been seen in testing.

The server's check handling on `capture` becomes host-aware: on a Google tab it works as today (`blocked` and `noResults` both retain the tab); on a Bing tab (`www.bing.com`) only a value with a `blocked` field retains the tab (titled `Pilcrino: pass the check`, window to the front, no longer owned), and the reply carries `blocked: true, leftOpen: true`; an empty result on Bing carries no flag. The skills read the written file: `resultCount: 0` on Bing is a zero-result query, not a check. The Bing branch retries that query once after the usual wait, then records it as having no results and goes on to the next query. On `blocked` the skill says "Bing is asking for a check. Pass it in the Pilcrino browser window that is open, then retry." (autopilot: blog-post-workflow parks `serp_blocked` with that sentence; plan-content fails with `blocked`), and the retained tab is there to act on.

## The skills

`blog-post-workflow` Step 4.2 and `plan-content`'s Google round read `research.serp` in their config preamble and branch:

- `bing`: today's tab, navigate and capture flow on the Bing URL with the Bing script. The "Google is asking for a check" stop cannot happen; `noResults` keeps today's handling.
- `google`: today's flow, unchanged, including the check handling of 0.45.1 and 0.59.2.
- `extension`: one `serp_search` call per query, no tab of their own for Google. `blocked` from the tool: tell the owner "Google asked for a check in your own browser; pass it there, then say retry" (for `consent`: "Google is showing a consent page in your own browser; accept it there, then say retry"). `extension_not_connected`, `extension_timeout` or `extension_outdated`: tell the owner, in words, that the Pilcrino extension did not answer, that their browser must be running with the extension loaded (for `extension_outdated`, the tool's hint), and offer to retry or to switch to Bing for this run. A reply with zero `topResults` and no `blocked` is a zero-result query, handled as on Bing. The 4 to 6 second pacing between Google searches in plan-content stays under `extension`, since the searches are still Google's.

Autopilot differs by skill, because the two skills report failure through different contracts:

- blog-post-workflow parks the post: `serp_blocked` with the sentence above as `detail`; `extension_not_connected` (also for `extension_timeout` and `extension_outdated`) with the hint as `detail`.
- plan-content writes its result file with two new reasons next to today's five (`browser_unavailable`, `login_required`, `blocked`, `no_profile`, `other`): `extension_blocked` for a check or consent page in the owner's own browser, `extension_not_connected` for a missing, silent or outdated extension, with the hint as `detail`. Under `bing` and `google` the existing reasons apply. The app learns both (below), so the failed research row says where the check is and does not offer the Pilcrino browser.

Both skills record `engine` in the files they write and name the engine in the research summary the owner reads (`research/serp.md` says "Bing results" when they are). The researcher agent's SERP analysis is unchanged except that it writes the engine name where it says "Google" today; `references/queries.md` in plan-content says the same.

The sign-in gate in both skills asks `login_status` for `google` only under `google`.

## The app

- `config.ts` reads `research.serp` into `ConsoleConfig.research`, default `bing`.
- `browser-gate.ts`: `requiredSites` includes `google` only under `google`. `allSitesFor` in `browser-cli.ts`, which the Setup screen's sign-in rows and the browser check use, drops `google` the same way, so a Bing or extension owner is never told to sign in to Google. The research gate keeps asking about Reddit (and X as today).
- Research runs: `RESEARCH_SKILL_REASONS` and `ResearchReason` gain `extension_blocked` and `extension_not_connected`; `REASON_TEXT` in `research-routes.ts` gives them "Google asked for a check in your own browser. Pass it there, then try again." and "The Pilcrino extension did not answer. Is your browser running with the extension loaded? The detail says more."; the failed-run row in `post-ideas-view.js` shows no Open browser button for either (they are not in `SIGN_IN_FAILURES`).
- `contract.ts`: one new park reason, `extension_not_connected`; `status-words.js` gives it the card text "The Pilcrino extension did not answer. Is your browser running with the extension loaded?" and no Open browser button. The parked card shows `parkDetail` for `serp_blocked` when the skill wrote one and falls back to the fixed sentence otherwise (today `parked.js` always shows the fixed sentence), so the extension's "in your own browser" wording reaches the owner.
- The headless sessions' tool allowlists gain `serp_search`.
- No settings UI. Changing the choice is editing `config.yaml` or re-running `blog-setup`, as for every other blog setting (the app has no PATCH for config).
- The app pins the plugin tag that carries this change and bumps its own version; the app README's browser paragraph gains one sentence on the choice.

## README and docs

- "What it does" and "The Pilcrino browser" describe the choice in two or three plain sentences and point to the setup question. The robot-check paragraph moves under the `google` choice.
- "What you need" drops Google from the accounts list except under `google`.
- Uninstall gains the extension lines.
- `config-schema.md` gains the `research` block.
- Changelog entry at the top, version bump in `plugin.json`, as the plugin CLAUDE.md requires.

## Tests

- Browser server: unit tests for the bridge (origin check, token check, single use, deadline, queueing, connection wait, cancellation, second-instance refusal, version check) with a fake WebSocket client; `serp_search` output shape; `bad_argument` on paths outside the roots.
- Extension: the content script's read function is a pure function over a document; test it on saved Google result pages (one with results, one `/sorry`, one with an AI Overview) under `node --test` with a small DOM. The service worker's message handling is tested with a fake `chrome` object.
- Validator: the three values, the path rule, the warning.
- Lint: `./tests/lint.sh` covers the new `${CLAUDE_PLUGIN_ROOT}` references.
- A manual run of each choice on this Mac before tagging: one post's research under `bing`, one plan-content Google round under `extension`, and the `google` path once to confirm nothing regressed.
- Bridge races: a reply after the deadline is dropped and the queued search runs; a socket drop during a pending search cancels it and the extension closes only a tab still on google.com; a second extension instance is refused with `already_connected` while the first keeps working, and takes the port within a minute after the first disconnects; a reconnect during a pending search does not resend it.
- Extension ownership: a content-script message from a tab the worker did not open, from a frame, or with the wrong token has no effect and closes nothing; a `/sorry` or `consent.google.com` landing on an owned tab produces `blocked` without the content script running; closing an owned tab mid-search, or the owner typing another search or leaving Google in it, ends the request with `tab_lost` and no close; a late capture from a tab that lost ownership closes nothing; an inline `blocked` capture on `/search` leaves the tab open and active.
- Refresh: same protocol with a newer plugin version rewrites the copy; an older plugin version or an older protocol writer leaves a newer copy alone; two interleaved writers end with the newest build installed; an initial install followed by an update on the real filesystem (no mocked rename) changes both the files and the stamp; the outdated hint names the right side.
- Bing: a zero-result page with a long body (`resultCount: 0`) is recorded as no results after one retry and the run goes on; a `blocked` Bing capture retains the tab through the server and the skill names Bing; `noResults` on Bing retains nothing.
- plan-content headless: missing extension, outdated protocol and a Google check each end with a valid result file (`extension_not_connected` or `extension_blocked`) the console accepts, and the rendered failed row shows the right text and no Open browser button.
- App: Setup rows and the browser check omit Google under `bing` and `extension`; the parked card shows the skill's detail for `serp_blocked`.

## Left to the builder

- The exact WebSocket framing library (a dependency in `browser/package.json`, or the small hand-rolled server; the server already ships `@modelcontextprotocol/sdk` and `puppeteer-core`, so size matters less than reliability).
- How the extension copy is stamped and refreshed (a version file inside `~/.pilcrino/extension` is fine).
- Bing selectors beyond `li.b_algo h2 a` if Bing's markup differs by locale.
- Finder and Explorer reveal wording, reusing setup's existing phrases.

## Calls made in this document, for the owner to check

- `bing` is the default (agreed in conversation).
- The extension handles Google search only (agreed in conversation).
- The marker is a query parameter, not a fragment, so Google sees a random token per search. Harmless (single use, loopback only) and necessary (fragments are dropped).
- The extension connects to the server, not the other way round, so the normal path opens background tabs and the owner's window never comes forward; there is no browser launch at all.
- A fixed port range and a fixed extension id, so nothing has to be configured on the extension side.
- Google leaves the sign-in list under `bing` and `extension`.
- No app settings UI; the key is edited like every other blog setting.
- One socket per server process and a listener that starts with the process, because many servers run at once (one per Claude session, one per app run).
- A protocol version separate from the plugin version decides "outdated", and a refresh of `~/.pilcrino/extension` never downgrades, because the owner's plugin and the app's pinned copy differ in plugin version most of the time.
- Setup asks which browser the owner uses and steers Safari and Firefox users to Bing, without forbidding the extension.
- Codex review round 1 (8 Nov 2026): the browser-launch fallback is cut; the server waits within the deadline for the extension instead. The extension closes or reads only tabs it opened, matched by tab id and token, and detects check and consent pages from the tab URL in the service worker. One extension instance per server; later ones are refused. Refresh of `~/.pilcrino/extension` also runs on same-protocol plugin changes, atomically; the outdated hint names which side to update. plan-content keeps its five existing failure reasons. Bing zero results are not a check. The app's second site list (`allSitesFor`) and the parked card are in scope.
- Codex review round 2 (8 Nov 2026): a refresh within a protocol only moves to a newer plugin version, under a lock. Tab ownership ends when the owner changes the tab's address; every close re-checks it; an inline check keeps the tab open like a redirect check. Bing captures return `resultCount`, and a Bing check retains the tab through a host-aware server check. plan-content gets two new failure reasons (`extension_blocked`, `extension_not_connected`) that the app's research row understands, reversing round 1's "no new reason". Refused extension instances retry every 30 seconds.
- Codex review round 3 (8 Nov 2026): the extension refresh moves the installed folder aside before renaming the new one in, since a rename cannot replace a non-empty folder.
