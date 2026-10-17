# Blog setup quick path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/pilcrino:blog-setup` into a quick path of about ten counted questions plus a detailed path, with every derived value shown before the commit, no app mention, and a "What next?" menu at the end.

**Architecture:** The wizard is one markdown skill, `skills/blog-setup/SKILL.md`, read by the model at run time. The detailed path stays the source of truth: every existing question keeps its place and gains a one-line `Quick path:` disposition (ask / derive / omit / action) right under it, so the two paths cannot drift. New mechanics (the choice menu, the counter, the summary-before-commit with correction mode, the What next menu) are new sections. Phase 7 disappears into Phase 6.

**Tech Stack:** Markdown skill text; `tests/lint.sh` (bash); `skills/blog-setup/scripts/validate-config.mjs` (unchanged); manual acceptance runs of the skill in scratch blogs.

**Spec:** `/Users/slav/work/pilcrino/docs/superpowers/specs/2026-10-17-setup-quick-path-design.md`

**Branch:** `feat/setup-quick-path` from `main` in `/Users/slav/work/pilcrino` (use a worktree per superpowers:using-git-worktrees). Commits in this plan are on that branch; the PR comes after Task 9.

## Global Constraints

- Every change bumps `version` in `.claude-plugin/plugin.json` and adds a Changelog entry at the top of `README.md` in the same branch (repo CLAUDE.md). Done once, in Task 8.
- `./tests/lint.sh` passes after every task.
- No em dashes anywhere in new text (the lint does not check this; the implementer greps `—` and `–` before each commit).
- Owner-facing text never contains: a hex code, a font stack, a count of checks or invariants, a file name other than the final folder, the word "app", a phase number, "press enter".
- A default is an `AskUserQuestion` menu option, first in the list, never a key press. Free text keeps "reply `default` for ..." only when the default is too long for a label, and then the menu is "Use the suggestion" / "I'll type my own".
- `config.yaml` and `profile/*.md` keep their shape. The only downstream edit is one comment in `skills/blog-post-workflow/references/config-schema.md`.
- Never run the wizard against a live blog during acceptance; scratch folders only. Never touch `~/.pilcrino`.
- `AskUserQuestion` takes two to four options.

## Review Focus

1. An address typed with a path (`https://example.com/journal`) on a WordPress blog: the adapter must probe `https://example.com/journal/wp-json/` and the prefix must start with `/journal/`. Pinned in Task 6's check.
2. A Hugo repo whose config overrides the section route and whose `baseURL` has a path: prefix `/docs/articles/`, image prefix `/docs/images`, base never doubled. Pinned in Task 2's and Task 6's checks and acceptance case 3.
3. A copied repository with the original's Pages workflow and an address on the original's host: `site_live` must be asked, not derived true. Pinned in Task 6's check and acceptance 4b.
4. A site whose posts carry several bylines or a guest name: the author name must be asked, never taken from a byline. Pinned in Task 3's check.
5. A quick-path owner who changes a derived-only field (content pillars) in the summary: the value must be taken verbatim and the category mapping refreshed, before and after the commit. Pinned in Task 7's check and acceptance 2.

---

### Task 1: Rules, the two paths, the counter

**Files:**
- Modify: `skills/blog-setup/SKILL.md` lines 1-23 (frontmatter description), 24-80 (How to talk to the owner), 124-216 (Global rules), 450-466 (0d Resume detection, add the choice after it)

**Interfaces:**
- Produces: the terms every later task uses verbatim: **quick path**, **detailed path**, **disposition** (`ask`, `derive`, `omit`, `action`), **counter**, **summary** (the summary-before-commit), **correction mode**. The disposition line format under a question: `Quick path: <ask|derive|omit|action>. <rule in one or two sentences>`.

- [ ] **Step 1: Add rules 8 to 11 to "How to talk to the owner"**

After rule 7, add:
- 8. **Nothing internal, ever.** Extends rule 1 with: a hex code, a font stack, a count of checks or invariants ("Checks passed", never "14 pass"), a file name other than the final folder, the word "app". The Pilcrino app is never mentioned during setup.
- 9. **Known answers are stated, not asked.** One line with its source: "Language: English, from your site."
- 10. **Defaults are clicked.** Every question with a default is an `AskUserQuestion` menu, default first, in owner words. Free text keeps "reply `default` for ..." only when the default is too long for a label; then the menu is "Use the suggestion" / "I'll type my own". Supersedes the "reply `default`" wording in rule 3 and Global rule 1 (edit both to point here).
- 11. **Every derived value is shown before it is saved**, in the summary (Phase 6), one line per topic in owner words.

- [ ] **Step 2: Add Global rule 10, "Two paths and the counter"**

After Global rule 9, add rule 10 with exactly these decisions:
- The choice menu text (owner words): "Quick setup (recommended): about ten questions, everything else taken from your site and repository and shown to you before it is saved." / "Detailed setup: every question, about forty, one at a time, each with a default to click." Asked once, right after Phase 0d on a fresh run, with `AskUserQuestion`.
- The disposition line format (Interfaces above) and its meaning: on the quick path `ask` is asked and counted; `derive` is written from the evidence the line names and shown in the summary; `omit` writes the default named and shows it in the summary; `action` is a consent or sign-in, done as today, never counted. On the detailed path every question is asked unless its line says "both paths".
- The counter: every asked question starts with "Question N of T". T is computed after Phase 0's platform detection: quick path 10 (name, address, about, readers, credibility, product, competitors, where posts go, push consent, commit) plus 1 for WordPress (username) plus 1 when the product answer is yes (its address). A conditional question (route prefix, site live, author name, product identity fallback, image serving fallback) raises T by one when it arises, said aloud: "One more than I said: 11 now." Detailed path T: the implementer counts the questions per phase after Tasks 2 to 7 and writes the per-adapter and per-module table here (the base, plus product +9, competitors +1, X research +0, two or more authors +2 per author, writing samples present -4).
- Resume runs (0d found files) skip the choice menu; "update" on a phase runs that phase's detailed questions pre-filled.

- [ ] **Step 3: Update Global rule 1 and rule 3 of How to talk to the owner to defer to rule 10 for defaults; replace "Where an older line in this file still says press enter" with a pointer to rule 10**

- [ ] **Step 4: Update the frontmatter description**

Replace the "Six resumable phases ... plus Phase 3.5" sentence set so it says: two paths (quick, about ten questions; detailed, every question), a summary of every derived value before the commit, and a What next menu; drop the Phase 7 sentence and the "optional Phase 7 offers to prepare the blog for the Pilcrino app" sentence. Keep the rest.

- [ ] **Step 5: Check**

Run:
```bash
cd /Users/slav/work/pilcrino && ./tests/lint.sh && grep -c 'Quick path:' skills/blog-setup/SKILL.md; grep -n 'press [Ee]nter' skills/blog-setup/SKILL.md; grep -n '—' skills/blog-setup/SKILL.md | head -3
```
Expected: lint prints nothing and exits 0; `press enter` appears only inside rule 3's ban; no em dash lines added by this task (pre-existing ones are left alone unless the line is edited).

- [ ] **Step 6: Commit**

```bash
git add skills/blog-setup/SKILL.md && git commit -m "blog-setup: two paths, counter, owner language rules"
```

---

### Task 2: Phase 1 and Phase 1.5 dispositions

**Files:**
- Modify: `skills/blog-setup/SKILL.md` 467-684 (Phase 1), 685-856 (Phase 1.5)

**Interfaces:**
- Consumes: disposition line format from Task 1.
- Produces: the two address values every later task uses: **site address** (as entered or discovered, may carry a path) and **origin** (scheme and host only, written as `blog.url`); the **route prefix rule** (two kinds of evidence, never combined); `existing_blog` set on the quick path from whether the address answers.

- [ ] **Step 1: Identity questions, dispositions**

Under each of the 12 identity questions add a `Quick path:` line:
1. name: ask. 2. address: ask; then the site address / origin split, written as a short paragraph after the question: origin to `blog.url`; site address kept in `setup-notes.md` under `Site address: <value>` for Phase 5; its path is the deployment base. 3. language: derive (`<html lang>` of the fetched home page, the site config's language key, else `en`). 4. niche: ask; default from PRODUCT.md, README, the home page, or an earlier setup on this Mac, offered as "Use the suggestion" / "I'll type my own". 5. mission, 6. point of view: derive from the niche and audience answers, one sentence each, written under the heading with the line `_Derived at setup; change it any time._` as the first line of the section. 7. pillars: derive, **both paths**, 3 to 5 buckets from the niche, same marker; add one sentence that site-conventions, the brief, the post workflow's category step and both git adapters read this section, so it stays. 8. tags: derive, the site's existing tags or categories, else six from the niche. 9. CTA: derive, the product's address when the product module is on, else the home page; hook one sentence; keep the no-invented-path rule. 10. cadence: omit, `weekly`. 11. route prefix: derive, **both paths**, replace the question's "Ask it in owner words..." with the rule in Step 2. 12. trailing slash: keep today's text; the "Everything else ... ask" branch becomes omit `true` on the quick path, shown in the summary.

- [ ] **Step 2: Write the route prefix rule (replaces Q11's asking text, both paths)**

Exact decisions: the result is one root-relative path normalised to `/.../`. Evidence is one of two kinds and the two are never combined: (a) a **complete path**, used as is: a post link on the live site with the post's own segment removed (`https://example.com/journal/post/` gives `/journal/`); (b) a **site-relative route**, to which the site address's path is prepended once: Hugo's effective route (the `permalinks` entry for the section in the Hugo config, else the section folder name) under `baseURL`'s path (`/docs/` plus `articles/` gives `/docs/articles/`); Astro's route from `src/pages`; WordPress's permalink fixed part under the installation path (Phase 5 corrects it from the site, composing with the path, never replacing it). Order: (a) when the site answers, else (b), else ask with the menu `blog` / nothing / another word, counted. Never a folder name when the config overrides it; never the bare address alone.

- [ ] **Step 3: Audience questions, dispositions**

1 primary: ask, default from the same sources as the niche. 2 secondary: omit, none. 3 to 7: derive from the audience answer; 7 posture: omit, translate on first use.

- [ ] **Step 4: Phase 1.5 on the quick path**

Add a paragraph after "**Offer.**": on the quick path neither question is asked. If the site address answers (`curl -sfI`), set `existing_blog: true`, say "Reading your site to fill in the rest", and run (a) to (d) without consent prompts; otherwise set `existing_blog: false` and skip. Every confirmation in (f) ("keep, edit, or skip", the trailing-slash confirmation) is not asked on the quick path; the values go to the summary (Task 7). The decline sub-case's "firm up Q12 by asking" becomes omit `true` on the quick path.

- [ ] **Step 5: Check**

```bash
cd /Users/slav/work/pilcrino && ./tests/lint.sh && sed -n 467,900p skills/blog-setup/SKILL.md | grep -c 'Quick path:'
```
Expected: lint clean; count is 19 or more (12 identity + 7 audience). Read the Q11 rule once more against the spec's example (`/docs/articles/`, `/journal/`).

- [ ] **Step 6: Commit** `git commit -am "blog-setup: Phase 1 and 1.5 quick-path dispositions, route prefix rule"`

---

### Task 3: Phase 2 voice and authors

**Files:**
- Modify: `skills/blog-setup/SKILL.md` 857-1048

**Interfaces:**
- Produces: the credibility question text, asked on both paths as the quick path's question 5.

- [ ] **Step 1: Voice dispositions**

Writing-sample path: on the quick path, when Phase 1.5 fetched posts, derive the voice from them and skip the "Confirm, edit, or tell me what's off" prompt (summary instead); with no posts, derive from the home page or write tone "direct, clear, practical", lexicon "none yet", anecdotes "none yet". Questions: 1 tone: derive. 2 credibility: ask, **both paths**, exact text: "What makes you the one to write this? One sentence, for example: after ten years running support teams, I..." Free text, no default. 3 lexicon: derive or "none yet". 4 anecdotes: omit, "none yet" (keep the never-invent rule). 5 positioning: derive from the product answer (Task 4) or "none yet". 6 forbidden phrases, 7 allowlist domains: omit, none.

- [ ] **Step 2: Authors dispositions**

1 count: omit, one. 2 details: name is derived only when every post Phase 1.5 fetched carries the same single byline; otherwise (several names, a guest name, no posts) ask "What name goes on your posts?", counted. Bio and expertise only from that person's about page on the site or the credibility answer; otherwise "none yet". Keep the never-git-identity rule. 3 co-signed: omit.

- [ ] **Step 3: Check**

```bash
grep -n 'What makes you the one to write this' skills/blog-setup/SKILL.md; grep -n 'same single byline' skills/blog-setup/SKILL.md; ./tests/lint.sh
```
Expected: one hit each, lint clean.

- [ ] **Step 4: Commit** `git commit -am "blog-setup: Phase 2 quick-path dispositions, credibility question"`

---

### Task 4: Phase 3 modules, product, competitors

**Files:**
- Modify: `skills/blog-setup/SKILL.md` 1049-1360

- [ ] **Step 1: Modules dispositions**

1 Reddit: omit, on. 2 X: omit, off. 3 product: ask, menu yes / no, exact text "Do posts promote a product of yours?". 4 competitors: ask as the names question, exact text "Name the competitors posts may compare you with, or say none." (free text; `modules.competitors` is true iff at least one name); 4a folder: omit, default. 5 repurpose: omit, on.

- [ ] **Step 2: Product on the quick path, new subsection "Product from first-party evidence (quick path)"**

Placed before the product interview. Decisions: one counted question, the product's address. Read its home, features, pricing and about pages (the links the home page carries) plus PRODUCT.md and README in the repo. Fill `product.md` with every feature line followed by its source in brackets (`(from <url or file>)`). This relaxes "Features and differentiators come from the owner only" for this path; say so in the subsection and keep the readback in the summary instead of here. Section rules when evidence is silent: Identity: from the home page, else ask "In one sentence, what does <product> do?", counted. Features, differentiators, unique-in-category: only what the pages say, else "none found at setup". First-party data: "none yet". Positioning rule: "teach first, name <product> once near the end", read back in one sentence. Existing posts: from the site. Pricing: the pricing link found on the product site; else the fallback wording "No pricing page found at setup. Posts never state a price; they point to <CTA target> instead." (never "No public pricing page yet").

- [ ] **Step 3: Competitors on the quick path**

The names from Step 1 seed `methodology.md`'s "Competitors currently profiled" list as today's interview does; no other competitor question.

- [ ] **Step 4: Check**

```bash
grep -n 'No pricing page found at setup' skills/blog-setup/SKILL.md; grep -n 'teach first, name' skills/blog-setup/SKILL.md | head -2; ./tests/lint.sh
```
Expected: hits present, lint clean.

- [ ] **Step 5: Commit** `git commit -am "blog-setup: Phase 3 quick-path dispositions, product from first-party evidence"`

---

### Task 5: Phase 4 images

**Files:**
- Modify: `skills/blog-setup/SKILL.md` 1386-1629

- [ ] **Step 1: images block dispositions**

1 kinds: omit, Remotion on, `ai-prompt` on iff `codex` is installed, screenshot on. 2 featured default: omit, planner picks (key omitted). 3 project dir: omit, `tools/remotion`.

- [ ] **Step 2: image-style dispositions and the merged detailed question**

Replace detailed questions 1 (palette) and 2 (fonts) with one menu, exact text: "Images will use your site's colours and fonts, found in its stylesheet" (or "the standard set" when none was found) "/ Tell me my brand colours in words". Hex codes and font stacks are written to the file but never printed unless the owner gives their own. Delete the "Say now, once, that a webfont..." caveat. Quick path: derive, same sources. 3 mood, 4 watermark, 5 annotation, 6 aspect ratio, 7 cover layouts: omit, defaults as written.

- [ ] **Step 3: Test render reports one line**

In the remotion subsection, replace the result reporting with: one line, "Test image rendered." plus, when a webfont fell back, "It uses a standard font on this Mac; your site is not affected." Never a list of problems, never a question. In the `ai-prompt` subsection, the test generation offer is detailed path only (quick path: omit, no generation).

- [ ] **Step 4: Check**

```bash
sed -n 1386,1640p skills/blog-setup/SKILL.md | grep -n '#[0-9A-Fa-f]\{6\}' | head; ./tests/lint.sh
```
Expected: hex codes remain only in the scaffold defaults list meant for the file, with the sentence that they are never printed; lint clean.

- [ ] **Step 5: Commit** `git commit -am "blog-setup: Phase 4 quick-path dispositions, one-line test render"`

---

### Task 6: Phase 5 publishing

**Files:**
- Modify: `skills/blog-setup/SKILL.md` 1630-2372

**Interfaces:**
- Consumes: site address and origin (Task 2).

- [ ] **Step 1: Site live, the evidence rule**

Under "Interview: how the site goes live", add the quick-path rule: `publish.site_live: true` only on deployment evidence naming both this repository's base branch and the entered site's host: GitHub Pages: `gh api repos/<owner>/<repo>/pages` reports `html_url` or `cname` on the site's host and `source.branch` equal to the base branch; Netlify, Vercel, Cloudflare: a successful deployment status or check run on the base branch's latest commit (`gh api repos/<owner>/<repo>/commits/<sha>/status` and `.../check-runs`) whose `target_url` or environment URL is on the site's host. A config file, a workflow, a host header or matching page text is not evidence (a copied repository has all three). Anything less, or `gh` unable to read it: ask today's menu, counted. WordPress and hosted CMS: online iff the site address answers.

- [ ] **Step 2: Adapter and Astro dispositions**

Adapter choice: ask (the detected option first), counted as question 8. Astro: content folder: derive from the collection; authors map: derive (present iff `src/content/authors/` or the config has one); preview marker: omit, none; the format edit consent: action. The WordPress password dialog: action.

- [ ] **Step 3: WordPress uses the site address**

In the WordPress section, `base_url` defaults to the **site address** from Task 2 (not `blog.url`), and the permalink correction composes the fixed part under the installation path (`/journal/` plus `/%postname%/` gives `/journal/`, never `/`). Username: ask, counted.

- [ ] **Step 4: Markdown image serving, derived**

Replace question 5's "Offer two answers" with: derive a folder-to-URL pair from the config, with the deployment base (the site address's path, or Next.js `basePath`) prepended to the URL once: Hugo `static/images` at `<base>/images`; Next.js `public/images` at `<basePath>/images`; Eleventy only from a folder passed to `addPassthroughCopy`, at the URL it maps to, `assets_dir` set to that folder; Astro relative paths. When the pair cannot be established, ask today's question, counted. Detailed path keeps the question with the derived pair as the first option.

- [ ] **Step 5: Site conventions and the app sentence**

Site conventions confirmation: on the quick path it goes to the summary. Delete the sentence at lines 2225-2230 ("Mention 'or download the post's zip from the Pilcrino app' ONLY when ...") entirely: the app is never mentioned.

- [ ] **Step 6: Check**

```bash
grep -n 'Pilcrino app' skills/blog-setup/SKILL.md; grep -n 'source.branch\|cname' skills/blog-setup/SKILL.md | head -3; grep -n 'site address' skills/blog-setup/SKILL.md | wc -l; ./tests/lint.sh
```
Expected: no "Pilcrino app" hits in Phase 5 (Phase 7's go in Task 7); the Pages fields present; "site address" used in Phase 2 and Phase 5; lint clean.

- [ ] **Step 7: Commit** `git commit -am "blog-setup: Phase 5 quick-path dispositions, site-live evidence, subpath-safe URLs"`

---

### Task 7: Phase 6 summary, correction mode, always-on console block, What next

**Files:**
- Modify: `skills/blog-setup/SKILL.md` 2373-2808 (Phase 6, Phase 7, Completion); `skills/blog-post-workflow/references/config-schema.md` 254-257

- [ ] **Step 1: New subsection "The summary before the commit (both paths)", placed before "Run the validator"**

Decisions: print one line per topic in owner words (name and address, about, readers, voice, author, product, competitors, images, posts go, research sources, plan approval, pushing), each derived or omitted value marked "(from your site)" / "(standard)" and asked values unmarked. Then `AskUserQuestion`: "Save this" / "Change something". "Change something" is **correction mode**: the owner names a topic or one line in free text; setup takes the owner's value directly for any derived field, including the ones no path asks (pillars, route prefix, trailing slash, tags, mission); when the owner asks for the questions, run that topic's detailed questions pre-filled. Rewrite the affected files (Global rule 4), refresh dependants (Remotion theme when images change; site-conventions category mapping when pillars change; nothing else depends on the prefix inside setup, the files that embed it are rewritten), print the summary again. Loop until "Save this".

- [ ] **Step 2: Always write the content plan and console block**

Move Phase 7 steps 1 and 2 into Phase 6 as a step before the validator, unconditional, both paths: scaffold `blog-ops/content-plan.md` if missing (never overwrite), merge the `console:` block with `publish_policy: gated` if absent (whole-file rewrite). Say nothing about it beyond the one sentence "Every post waits for your approval before it goes live." Delete the Phase 7 section and its "Handoff" preamble; delete every "Pilcrino app" mention in Phase 6 and the completion recap item 6.

- [ ] **Step 3: Validator and the two standing decisions**

Validator output to the owner: "Checks passed" or, on failure, the failing item in owner words; never a count. Standing decision 1 (plan approval): omit `ask` on the quick path; drop the sentence "Say once that the Pilcrino app, if used, has its own approval screens". Decision 2 (push): ask, both paths, question 9. Custom instructions: omit, not asked on the quick path. The commit question: counted as question 10.

- [ ] **Step 4: "Change a setup answer" after the commit**

Add to the completion section: the correction loop from Step 1 is re-entered from the What next menu; afterwards the validator runs again and a second commit is made under the same consent as the first (push too when the owner chose push); the recap says "pushed" only when the second push passed the same two checks.

- [ ] **Step 5: Replace the exact last line with the What next menu**

Keep the recap (items 1 to 5). Replace "Then print exactly: Setup complete. Run ..." with an `AskUserQuestion` titled "What next?" with at most four options in this order: "Plan a batch of posts (research, about half an hour, unattended)" runs `/pilcrino:plan-content`; "Write a post now" runs `/pilcrino:blog-post-workflow new`; "Research a competitor" runs `/pilcrino:research-competitor` when the competitors module is on, else this slot is "Change a setup answer"; "Something else" opens a second menu: "Change a setup answer" / "Nothing now, show me the commands", which prints the three commands one per line in plain words. Choosing a skill invokes it in this session, the way Phase 3.5 hands off.

- [ ] **Step 6: config-schema comment**

In `config-schema.md` under `### console: (optional)`, replace "Present only for blogs operated by the Pilcrino app's console. Absence = interactive-only blog; zero behavior change." with: "Written by setup for every blog with `publish_policy: gated`. The app decides whether a blog is connected from `~/.pilcrino/console/blogs.json`, not from this block; its presence changes nothing for a terminal-only blog."

- [ ] **Step 7: Check**

```bash
cd /Users/slav/work/pilcrino && grep -n 'Pilcrino app\|Phase 7' skills/blog-setup/SKILL.md; grep -n 'What next' skills/blog-setup/SKILL.md; grep -n 'Setup complete. Run' skills/blog-setup/SKILL.md; grep -rn 'Phase 7' skills/ README.md | grep -v Changelog; ./tests/lint.sh && cd skills/blog-setup/scripts && node --test validate-config.test.mjs 2>&1 | tail -3
```
Expected: no "Pilcrino app" or "Phase 7" hits in the skill, one "What next" hit, no "Setup complete. Run" line, no other skill or README text referring to setup's Phase 7 (fix any that do), lint clean, validator tests pass.

- [ ] **Step 8: Commit** `git commit -am "blog-setup: summary before commit, correction mode, console block always written, What next menu"`

---

### Task 8: Version, changelog, detailed-path totals

**Files:**
- Modify: `.claude-plugin/plugin.json`, `README.md` (Changelog top), `tests/check_page_anatomy.sh:79`, `skills/blog-setup/SKILL.md` Global rule 10 (the T table)

- [ ] **Step 1: Count the detailed path**

Count asked questions per phase in the edited skill (lines with a number and a question, minus those marked "both paths" derive) and fill Global rule 10's T table: base per adapter (astro-git-pr, wordpress-rest, markdown) and the deltas (product +N, competitors +N, extra author +N, writing samples -N) with the real numbers.

- [ ] **Step 2: Bump to 0.57.0 and write the changelog entry**

Entry: "0.57.0: blog-setup has a quick path (about ten questions, the rest from your site, shown before saving) and a detailed path; defaults are menu clicks; no colour codes, font stacks or app pitch; the content plan and approval settings are always written; setup ends with a What next menu."

- [ ] **Step 3: Check and commit**

```bash
./tests/lint.sh && grep -n '"version"' .claude-plugin/plugin.json && head -5 README.md | grep -n 0.57.0
git commit -am "blog-setup quick path (0.57.0)"
```
Expected: lint clean, version and changelog show 0.57.0. `tests/check_page_anatomy.sh` line 79 pins the version (`need .claude-plugin/plugin.json '"version": "0.56.3"'`); change it to 0.57.0 in the same commit and run `./tests/check_page_anatomy.sh`.

---

### Task 9: Acceptance runs

**Files:**
- Create: `docs/superpowers/plans/2026-10-17-setup-quick-path-acceptance.md` (the record: per run, the question count, the counter's announced total, the files written, the summary shown, the prefixes and URLs)

Each run: a fresh scratch folder under `/private/tmp/pilcrino-setup-acceptance/<case>/`, `git init`, a GitHub remote only where the case needs one (a throwaway private repo, deleted after), the skill invoked from the branch (`claude --plugin-dir /Users/slav/work/pilcrino` or the worktree path), never a live blog.

- [ ] **Case 1:** new Astro blog, no live site, product off, quick path. Expect the announced total (10, plus one for the author name when no byline exists), the counter matching it, summary shown, "Checks passed", What next menu.
- [ ] **Case 2:** a blog with a live site and posts (use a scratch clone of a public Astro blog with a single byline), product on with a real product address. Expect byline, voice, palette and pricing from evidence in the summary; override content pillars in correction mode before the commit (value verbatim in `blog.md`, mapping in `site-conventions.md` refreshed); after the commit, change the route prefix via "Change a setup answer" and confirm a second commit.
- [ ] **Case 3:** Hugo repo, no live site, `baseURL = "https://example.com/docs/"`, posts in `content/posts/`, `[permalinks] posts = "/articles/:slug/"`. Expect `blog.url: https://example.com`, `route_prefix: /docs/articles/`, image prefix `/docs/images`; stage one post with the markdown adapter's dry path or inspect the config and the adapter's output: cover and body image URLs start with `/docs/images/<slug>/`.
- [ ] **Case 4:** WordPress with a test site if one is available; otherwise a dry run where the address is `https://example.com/journal` and the `/wp-json/` probe is mocked unreachable: expect the probe URL `https://example.com/journal/wp-json/` and a prefix beginning `/journal/`. Record "not run live" when no test site exists.
- [ ] **Case 4b:** copy of the Case 2 repo keeping its Pages workflow and deploy config, address on the original site's host: expect the site-live menu to be asked.
- [ ] **Case 4c:** Eleventy repo with `addPassthroughCopy({ "media": "assets" })`: expect image prefix `/assets` and `assets_dir: media`.
- [ ] **Case 5:** re-run Case 1's folder after adding two rows to `content-plan.md`: per-phase keep / update / start over offered; rows intact after the run.
- [ ] **Case 6:** detailed path on Case 1's folder from scratch: question count equals the announced total.
- [ ] **Record and commit** the acceptance file; then open the PR with `gh pr create` against `main` and run `gh pr checks`.
