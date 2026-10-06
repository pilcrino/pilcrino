---
name: post-to-linkedin
description: "Publish an already-written post to this blog's LinkedIn COMPANY page (social.linkedin.company_id) through the Pilcrino browser. Post-only mechanics, not a content generator; copy comes from a repurpose linkedin.md, a blog slug, or inline text. Bakes in the hard-won gotchas: posting AS the company, Quill-API text insertion (type REVERSES paragraphs; execCommand drops all but the first line), URL- and bare-domain-free body, link inline in the FIRST COMMENT."
argument-hint: "<slug | path-to-linkedin.md | inline>"
---

# post-to-linkedin

Publishes a prepared post to **the configured LinkedIn company page** and adds the blog link as the first comment. This skill does NOT write copy (use `repurpose-blog-post` for that); it drives the browser reliably, avoiding the failure modes that bite manual/automated LinkedIn posting.

It does not publish, approve, or go live the underlying blog post itself — per `config-schema.md` §Go-live is always human, going live is never configurable. This skill only posts social copy about a post that is already live.

## Standing rules (non-negotiable)

- **Company page only.** Always post as the configured company page (`{company_id}`, resolved in Step 0), using the company voice defined in `{profile_dir}/voice.md` / `custom-instructions.md`. Never a personal profile. Verify the composer header shows **the company's name** (from the admin page's title) **· Post to Anyone** before typing.
- **Body is link-free AND domain-free.** No URLs and no bare domains in the post body. LinkedIn auto-links bare domains too (e.g. `acme.com`, `acme.io`) and attaches an unwanted preview card, same as a URL. Rewrite bare-domain mentions without the domain suffix (`acme.com` → "Acme", or a plain description like "the platform"). The link lives only in the first comment.
- **Link in the first comment**, inline. LinkedIn penalizes body links ~42%.
- **Publishing is a public, irreversible action.** Show the human the exact copy and get explicit approval BEFORE clicking Post; approval in one run does not carry to the next.

## Step 0, Config preamble (guard first, before anything else)

1. **Locate the config.** `blog-ops/config.yaml` at the workspace repo root, per `${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md` §Bootstrap rule. If missing or does not parse as YAML → **HARD-STOP**: "No valid blog-ops/config.yaml, run /blog-setup first."
2. **Check the LinkedIn gate.** Read `social.linkedin.company_id`. If `social.linkedin` is absent, or `company_id` is empty → **HARD-STOP**: "social.linkedin.company_id is not configured in blog-ops/config.yaml — this skill requires it. Add a social.linkedin block (see config-schema.md §Schema) by hand, then retry." Do not proceed, do not open a browser.
3. **Resolve `{company_id}`** = `social.linkedin.company_id`. It is a public LinkedIn page id, not a secret: config never carries LinkedIn credentials; this skill relies entirely on the operator's LinkedIn session in the Pilcrino browser for auth.
4. **Resolve path variables**: `{drafts_dir}` (`blog-ops/drafts`), `{profile_dir}` (`blog-ops/profile`), `{route_prefix}` (`blog.route_prefix`), and read `blog.url` and `blog.trailing_slash`. Canonical post URL = `{blog.url}{route_prefix}<slug>`, with a trailing `/` appended iff `blog.trailing_slash: true`.

## Inputs

Resolve the post body + first-comment (teaser line + blog URL) from, in order of preference:

1. **A `linkedin.md` path** (a `repurpose-blog-post` output): parse the `## Body` code block (the full post text) and the `## First comment, the link` block.
2. **A slug**: read `{drafts_dir}/_archive/<slug>/repurpose/linkedin.md`, else `{drafts_dir}/<slug>/repurpose/linkedin.md`. If neither exists, tell the human to run `/repurpose-blog-post <slug>` first.
3. **Inline text** the human pastes in chat.

Confirm the resolved body is link-free and the first-comment URL is a plain canonical `{blog.url}{route_prefix}<slug>` (trailing slash per `blog.trailing_slash`; no tracking params). Present the exact body + first comment to the human and wait for approval.

## Browser: the Pilcrino browser

Load `mcp__plugin_pilcrino_pilcrino-browser__tabs`, `navigate`, `capture`, `run`, `click`, `screenshot`, `wait`, `login_status`, `open_login` via ToolSearch, in one call:
`select:mcp__plugin_pilcrino_pilcrino-browser__tabs,mcp__plugin_pilcrino_pilcrino-browser__navigate,mcp__plugin_pilcrino_pilcrino-browser__capture,mcp__plugin_pilcrino_pilcrino-browser__run,mcp__plugin_pilcrino_pilcrino-browser__click,mcp__plugin_pilcrino_pilcrino-browser__screenshot,mcp__plugin_pilcrino_pilcrino-browser__wait,mcp__plugin_pilcrino_pilcrino-browser__login_status,mcp__plugin_pilcrino_pilcrino-browser__open_login`
Never Playwright. Below, tool names are written unprefixed.

**Clicking.** `click` by selector, or `run` a script that finds the element by its text and calls `.click()`. Avoid `click` by `x`, `y`: those are CSS pixels, and a screenshot on a Retina screen is in device pixels (about 2x), so screenshot coordinates must be divided by `window.devicePixelRatio` first.

**Reading a page.** The only way to read a page is `capture` (runs a script in the tab and writes its JSON result to a file), then `Read` the file; `run` executes a script and discards its value. Both scripts are the body of an async function, and a `capture` script must `return` its value. Scratch files live in `{drafts_dir}/_linkedin/<slug>/` (`<slug>` is the post's slug; for inline text, `inline`). The browser refuses a relative `outFile`, so every `outFile` must be absolute: `{drafts_dir}/_linkedin/<slug>/...` as an `outFile` means `$(git rev-parse --show-toplevel)/{drafts_dir}/_linkedin/<slug>/...` (resolve the repo root once with Bash and reuse it). When the prompt names a scratch directory ("Scratch directory for browser captures and screenshots: <path>."), every capture and screenshot goes there instead.

## Procedure

### 1. Preflight

- Call `login_status` with `["linkedin"]`.
  - `signed_out`: call `open_login` with `["linkedin"]` and stop: "Sign in to LinkedIn in the Pilcrino window that just opened, then quit it with Cmd+Q and retry." (`open_login` quits the Pilcrino browser and opens a window without remote control.)
  - The tool fails with `signin_window_open`: stop: "The Pilcrino sign-in window is still open. Quit it with Cmd+Q, then retry."
  - `blocked`: stop: "LinkedIn is challenging the Pilcrino browser; open it, pass the check, then retry."
  - `error`, or the tool itself fails: stop: "The Pilcrino browser could not reach LinkedIn; check the connection and retry." (with the tool's message).
- Then `tabs` with `action: open` for a dedicated tab. Keep its `tabId`; every call below uses it.

### 2. Open the company composer (verify it is the company, not you)

- `navigate` the tab to `https://www.linkedin.com/company/{company_id}/admin/`. Reaching `/admin/dashboard/` (the `url` the tool returns) confirms you are logged in with admin rights. If instead you land on a login page, an "I'm interested in..." follow page, or any admin page without a dashboard (session expired, or the operator's account lost admin rights on this page): STOP and tell the human to sign in to LinkedIn in the Pilcrino browser as an admin of the company page, then retry. This is a common failure mode for a lapsed session (auth here is entirely session-based), so treat it as a first-class check, not an afterthought.
- Read the company's display name shown on the admin page itself. This is the ground truth the composer header must match; `social.linkedin` config carries only the id, never the name:
  ```
  capture
    tabId: <tabId>
    outFile: {drafts_dir}/_linkedin/<slug>/admin.json
    script: |
      return { url: location.href, title: document.title, header: document.querySelector('h1, [data-test-org-name], .org-top-card-summary__title')?.innerText || '' }
  ```
  `Read` the file. The name is `header`, else the company part of `title`. Confirm `url` still contains `/admin/dashboard/`.
- Open the composer with `run` text matches, never by screenshot coordinates:
  ```
  run
    tabId: <tabId>
    script: |
      const b=[...document.querySelectorAll('button,a')].find(e => /^\s*\+?\s*Create\s*$/.test(e.innerText));
      if(!b) throw new Error('no Create button'); b.click();
  ```
  Then the same pattern for **Start a post** (`/^\s*Start a post\s*$/`), then `wait` with `selector: .ql-editor`.
- `screenshot` (viewport) to `{drafts_dir}/_linkedin/<slug>/composer.png` and `Read` it. The composer header MUST read **"\<the captured company name\>" / "Post to Anyone"**. If it shows a personal name or any other page's name: STOP (do not post as a person), close the tab and report.

### 3. Insert the body (use the Quill API, not `type` or `execCommand`)

- `click` the "What do you want to talk about?" field (`.ql-editor`) so the editor is focused.
- **No `type` into the composer: `type` enters paragraphs in reverse order.** Do NOT use `execCommand('insertText')` with a multi-paragraph string either (Quill silently drops everything after the first line, so only the hook survives). The reliable path is Quill's own API on the `.ql-container.__quill` instance, which updates the editor model so all paragraphs render and hold. **Set the text with `run`:**
  ```
  run
    tabId: <tabId>
    script: |
      const c=[...document.querySelectorAll('.ql-container')].find(x=>x.__quill && x.offsetParent && x.getBoundingClientRect().width>400);
      if(!c) throw new Error('no composer quill');
      c.__quill.setText(BODY + "\n",'user');   // BODY = the body as a JS string literal (JSON-encoded), paragraphs joined by '\n\n'
      c.__quill.update();
  ```
  (Pick the visible composer `.ql-container` by `offsetParent` + width > 400, so a comment box or messaging editor never gets targeted by accident.)
- **Read it back with `capture`:**
  ```
  capture
    tabId: <tabId>
    outFile: {drafts_dir}/_linkedin/<slug>/composer.json
    script: |
      const c=[...document.querySelectorAll('.ql-container')].find(x=>x.__quill && x.offsetParent && x.getBoundingClientRect().width>400);
      if(!c) return {err:'no composer quill'};
      const L=[...c.querySelectorAll('.ql-editor p')].map(p=>p.innerText).filter(x=>x.trim());
      return {first:L[0], last:L[L.length-1], n:L.length};
  ```
  `Read` the file and compare to the body.
- **Verify:** `first` must be the hook, `last` the final line (hashtags), and `n` must equal the body's paragraph count (its non-empty lines). Re-run if any is wrong. Never post unverified.

### 4. Publish (after human approval)

- **Bare-domain guard (do this before Post).** Re-check the inserted body has NO URL and NO bare domain, either auto-links and attaches a preview card. Regex to run against the body text:
  ```
  /(https?:\/\/|\b[a-z0-9-]+\.(com|co\.uk|ca|io|net|org|de|fr|es|it|au|app)\b)/i
  ```
  Any hit → rephrase to non-domain wording and re-run step 3 before continuing. **Record the before/after text of every rephrase** (the exact hit and what it was changed to): Step 6's report must disclose it verbatim, this is human-authored copy being altered before it's posted publicly, and that must never happen silently.
- **Pre-Post check (the last recoverable moment, nothing is published yet).** `screenshot` (viewport) to `{drafts_dir}/_linkedin/<slug>/before-post.png` and `Read` it: confirm correct paragraph order, **no link-preview card** attached, unicode rendered, and the **Post** button is active. This is the last point a preview card can still be dropped: LinkedIn only lets a preview be removed at compose time, before Post is clicked, and once it's attached at publish it can only be removed by deleting and reposting the post, and that only with your explicit yes (see the recovery step below). If either check fails, do not click Post: tell the human, let them clear the preview card or wait for the button to activate, then re-screenshot.
- **Human approval.** Show the human the `before-post.png` screenshot together with the exact body and first comment, then ask for explicit approval to post. No approval, no Post; approval from an earlier run does not count.
- After approval, `click` the Post button (selector `button.share-actions__primary-action`). `wait` 3000 ms, then `screenshot` to `{drafts_dir}/_linkedin/<slug>/after-post.png` and `Read` it to confirm the "Post successful" toast. **From this click onward the post may already be live.** If the toast never appears, do not assume the post failed just because the toast didn't render; check the company page directly before deciding what to do next.
- **Open the published post on its own page (the default for steps 4 and 5).** Never act on the feed: its first text match can be another post. Run this every time, before any comment or delete:
  1. Capture the toast's **View post** link while the toast is up:
     ```
     capture
       tabId: <tabId>
       outFile: {drafts_dir}/_linkedin/<slug>/view-post.json
       script: |
         const a=[...document.querySelectorAll('a')].find(e => /^\s*View post\s*$/.test(e.innerText));
         return { href: a ? a.href : null };
     ```
     `Read` it. If `href` is null (the toast is gone), STOP and ask the human for the post's URL; do not search the feed for it.
  2. `navigate` the tab to that `href`.
  3. Capture the post's first line on that page:
     ```
     capture
       tabId: <tabId>
       outFile: {drafts_dir}/_linkedin/<slug>/post-page.json
       script: |
         const post=document.querySelector('.feed-shared-update-v2, [data-urn*="urn:li:activity"]');
         if(!post) return { url: location.href, err: 'no post on this page' };
         const t=post.querySelector('.update-components-text, .feed-shared-update-v2__description, .feed-shared-text') || post;
         return { url: location.href, first: (t.innerText || '').split('\n').map(x => x.trim()).find(Boolean) || '' };
     ```
  4. `Read` it and compare `first` with the body's first line (the hook). Only on a match do the actions below run, on this page and scoped to `post`. On a mismatch or `err`: STOP, tell the human what the page shows, and do nothing on it.
- **If a preview card slipped through anyway:** editing the post will NOT remove an already-attached preview (LinkedIn only lets you drop a preview at compose time). The recovery is to delete the post and re-post a clean, domain-free version:
  1. Open the post's own page and verify its first line (the steps above).
  2. **Ask the human every time, before the click:** "Delete the LinkedIn post at <url> that starts \"<first line>\"? (yes/no)". Anything but an explicit yes: do not delete; report the stray preview card instead. Approval from an earlier run or an earlier post does not count.
  3. On yes, open that post's "..." menu with a `run` scoped to the verified post, then **Delete post** and the dialog's **Delete** with `run` text matches as in step 2:
     ```
     run
       tabId: <tabId>
       script: |
         const post=document.querySelector('.feed-shared-update-v2, [data-urn*="urn:li:activity"]');
         const b=post && [...post.querySelectorAll('button')].find(e => /control menu|more actions/i.test(e.getAttribute('aria-label') || ''));
         if(!b) throw new Error('no menu button on the verified post'); b.click();
     ```

### 5. Add the first comment (link, inline)

- Work on the post's own page, opened and verified per step 4 ("Open the published post on its own page"); never on the feed. If that was not done yet in this run, do it now. Then open **Comment** on the verified post with a `run` scoped to it, to open the "Comment as \<company name\>..." box, and `click` into it:
  ```
  run
    tabId: <tabId>
    script: |
      const post=document.querySelector('.feed-shared-update-v2, [data-urn*="urn:li:activity"]');
      const b=post && [...post.querySelectorAll('button')].find(e => /^\s*Comment\s*$/.test(e.innerText));
      if(!b) throw new Error('no Comment button on the verified post'); b.click();
  ```
- Insert with `run` via the comment box's Quill instance (same reason as step 3: `type` reverses lines and `execCommand` is unreliable here too). **Put the URL INLINE on the same line as the teaser** (e.g. "\<teaser line\>: \<canonical URL\>"). A bare URL on its own line after a blank line gets STRIPPED on submit. The comment link SHOULD linkify, that is wanted (a preview card of our own post is a bonus).
  ```
  run
    tabId: <tabId>
    script: |
      const c=[...document.querySelectorAll('.ql-container')].find(x=>x.__quill && x.offsetParent);
      if(!c) throw new Error('no comment quill');
      c.__quill.setText('<teaser>: <canonical URL>','user'); c.__quill.update();
  ```
- **`wait` 5000 ms** for LinkedIn to linkify / attach the preview (submitting too early drops the link), then `click` the comment Post button (selector `button[class*="comments-comment-box__submit-button"]`; the tool scrolls it into view, so do not scroll the page yourself).
- Verify with a `capture` to `{drafts_dir}/_linkedin/<slug>/comment.json` that returns the hrefs of `a[href*="<slug>"]` under the post, and `Read` it; the clickable anchor must exist. If the link dropped: open the comment's "..." then **Edit**, re-insert the URL inline with `run`, wait, Save.

### 6. Report

- Close the tab (`tabs` with `action: close`) and delete the scratch folder by its exact path: `rm -rf "$(git rev-parse --show-toplevel)/{drafts_dir}/_linkedin/<slug>"`. It is never committed.
- Report the post is live on the configured company page and the first comment carries the link (with the anchor confirmed). Note anything the human should eyeball, including a stray preview card if one slipped through. **If step 4's bare-domain guard rephrased any text, state that plainly and show the exact before/after wording**: never let a silent copy edit reach a public post unremarked.

## Gotchas (why this skill exists)

- `type` into the composer → paragraphs land REVERSED. `execCommand('insertText')` with multi-paragraph text → everything after the first line is DROPPED (only the hook survives). Use the Quill API: `.ql-container.__quill.setText(BODY + "\n", 'user')`.
- Bare domains in the body (e.g. `acme.com`, `acme.co.uk`) auto-link and attach a preview card, exactly like a URL. Body must be URL- AND domain-free; rewrite without the domain suffix. Run the step-4 domain regex before posting — and record the before/after of any rephrase, it goes in the Step 6 report, never silently.
- An already-attached preview cannot be removed by editing the post (LinkedIn only drops previews at compose time). That is also why the pre-Post screenshot (step 4) is the last chance to catch one, before Post is ever clicked, rather than relying on catching it after. If one slips through anyway, delete + repost clean, on the post's own verified page and only after the human says yes (step 4).
- Bare URL alone on its own comment line → stripped on submit. Put it inline after text, and wait for the preview before submitting.
- A lapsed LinkedIn session in the Pilcrino browser or lost admin rights never reaches the composer: it dead-ends on the admin page itself, before the composer-identity check even applies. Don't rely on the composer-identity-mismatch check to cover it, a login wall isn't a mismatched identity.
- Once Post is clicked, an abort is no longer "nothing happened": treat the post as possibly already live and check the company page before deciding what to do next, rather than assuming it failed.
- Composer can silently default to a personal profile. Always verify the composer header against the company name captured from the admin page, not an assumed name.
- The comment submit button is often below the fold. `click` it by selector (the tool scrolls the element into view); do not scroll the page yourself (page scroll can hang).

## What this skill does NOT do

- Does not write or rewrite copy (that is `repurpose-blog-post`).
- Does not post to a personal profile, X, or any other platform.
- Does not schedule; it posts immediately after human approval.
- Does not add tracking params to the URL.
- Does not publish, approve, or go live the underlying blog post: going live is always a human action (`config-schema.md` §Go-live), never configurable and never something this skill can authorize.
