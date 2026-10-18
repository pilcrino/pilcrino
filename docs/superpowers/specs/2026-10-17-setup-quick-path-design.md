# Blog setup: quick path and detailed path

Date: 2026-10-17. Status: draft for the owner's approval. Codex review
rounds 1 to 3 applied.

## Why

A first run of `/pilcrino:blog-setup` asks about 60 questions. The owner
answered `default` to most of them and still had to read a suggested
paragraph, a palette table with hex codes, a font stack with two caveats,
and a pitch for the app. Nobody outside the author will finish that.

The run that produced the complaints used plugin 0.45.1 (installed 6 Oct);
main is 0.56.3. "Press enter for X" (impossible in Claude Code) was already
banned in 0.49.0. Everything below is about what main still does.

## Goals

- A new owner finishes setup by answering about ten questions.
- Every question says where it is in the run ("3 of 10").
- A default is one menu click, never typed.
- Nothing internal reaches the owner: no hex codes, no font stacks, no
  file names, no invariant counts, no "app".
- Every value setup derived is shown once, before anything is checked or
  committed, and can be changed there.
- Setup ends with a menu of things to do next.
- The owner who wants control gets every question, in the same clean form.

## Non-goals

- Changing what setup writes. `config.yaml` and every `profile/*.md` keep
  their shape; downstream skills do not change.
- Changing Phase 0 (preflight, finding the blog), Phase 3.5 (browser
  sign-in), or Phase 5's adapter mechanics (Astro format edits, WordPress
  keychain, markdown platform). Those stay; only the questions around them
  change.
- A new UI. This is the terminal skill only.

## Anti-goals

- A quick path that writes placeholders or empty sections. Every file is
  as complete as after the detailed path; the difference is who supplied
  the answer, the owner or the evidence.
- A "detailed" path that is the old wizard unchanged. The cuts below apply
  to both paths.
- A derived value the owner never saw. Everything derived appears in the
  summary before the commit.

## The choice at the start

Right after Phase 0 finds the blog and detects the site platform, one menu:

- "Quick setup (recommended)": about ten questions, everything else taken
  from your site and repository and shown to you before it is saved.
- "Detailed setup": every question, about forty, one at a time, each with
  a default to click.

Re-running setup on a blog set up either way offers today's per-phase
choices (keep, update, start over); "update" runs that phase's detailed
questions pre-filled with what is on file.

## Every prompt gets a disposition

The builder goes through every question, confirmation and offer in the
current skill and gives each one of four dispositions on the quick path:
**ask** (counted), **derive** (written from evidence, shown in the summary),
**omit** (default written, shown in the summary), **action** (a consent or
sign-in that is not an interview question: the WordPress password dialog,
the Astro format edit, the browser sign-in, the commit). The table below
fixes the ones that matter; anything not listed is derive or omit, never
ask.

### Asked on the quick path

Counter: "Question 3 of 10" as the first words of every asked question. The
total is computed after Phase 0's platform detection (WordPress adds the
username) and raised by one, said aloud, when a conditional question
arises ("One more than I said: 11 now").

1. Blog name. Default from the repo, as today.
2. Blog address. Default from the repo, as today. Setup keeps two values
   from it: the **site address** as entered or discovered (may carry a
   path: `https://example.com/journal`) and the **origin**
   (`https://example.com`), and writes the origin as `blog.url`, because
   every reader concatenates `{blog.url}{route_prefix}`. The site address
   is what the WordPress adapter probes (`<site address>/wp-json/`) and
   what `publish.wordpress.base_url` defaults to; its path becomes the
   leading part of the route prefix (`/journal/` + the permalink's fixed
   part, so a post-name permalink under `/journal` gives `/journal/`, not
   `/`). Phase 5's permalink correction composes with that path instead of
   replacing it.
3. What the blog is about, one or two sentences. Default from PRODUCT.md,
   README, the site's home page, or an earlier setup on this Mac, when any
   exists; otherwise no default.
4. Who reads it. Same default sources.
5. Credibility: "What makes you the one to write this? One sentence." Free
   text, no default. It cannot be derived without inventing an authority
   claim, and every post's expertise statement comes from it.
6. Your product: "Do posts promote a product of yours?" Menu: yes / no.
   Yes asks the product's address (counted as 6b). See Product below.
7. Competitors: "Will posts name competitors to compare you with?" Menu:
   "No competitors" / "Yes, I'll name them"; yes takes the names as free
   text in the same turn. Names only; profiles are researched later as today.
8. Where posts go. Adapter detected as today, confirmed with one menu in
   owner words. Adapter actions follow as today (WordPress password dialog,
   Astro format edit consent); they are not counted.
9. Pushing Pilcrino's own files to main without asking. Menu, as today.
10. The commit question from Phase 6 (push now / not yet). Counted, because the owner answers it.

Conditional questions, each counted when it arises:

- Route prefix, only when no evidence settles it (see Derived).
- Site live, only when no evidence settles it (see Derived).
- Author name, only when the site's bylines do not settle it (see Derived).
- WordPress username (required by the adapter, cannot be derived).

### Derived on the quick path (shown in the summary)

| Topic | Value and source |
|---|---|
| Language | `<html lang>`, the site config, or `en` |
| Route prefix | always one complete root-relative path, normalised to `/.../`. Two kinds of evidence, never combined with each other: a **complete** path, taken as is: a post link on the live site with the post's own part removed (`https://example.com/journal/post/` gives `/journal/`); or a **site-relative** route, to which the site address's path (the deployment base) is prepended exactly once: Hugo's effective section route (`permalinks` in the config, else the section folder name) under `baseURL`'s path (`/docs/` + `articles/` gives `/docs/articles/`); Astro's collection route under the site address's path; WordPress's permalink fixed part under the installation path. No evidence: ask (menu: `blog` / nothing / another word), counted. The builder writes the composition as a two-step rule in the skill so the base is never added twice. |
| Trailing slash | read as today; for platforms where today's rule says "ask", default yes, shown in the summary |
| Mission, point of view | derived from the niche and audience, marked "derived at setup" in the file. Content pillars are not written by setup at all (amended 2026-10-18): `plan-content` owns them and the post's category is picked from the site's own category list. Tags: copied from the site, never invented; a site without tags gets `none yet` and `plan-content` fills the list. |
| Primary CTA | the product's address when the product module is on, the blog's home page otherwise; hook one sentence from the niche. No trial, signup or pricing path is ever assumed. |
| Publish cadence | weekly |
| Secondary audience | none |
| Pain points, language to use and avoid, jargon, posture | from the audience answer; posture "translate on first use" |
| Voice | from the live posts when the site has them (Phase 1.5 evidence) or the home page; otherwise tone "direct, clear, practical", lexicon and anecdotes "none yet", positioning from the product answer. Credibility from question 5. |
| Authors | one author. Name: the byline, only when every fetched post carries the same single name; otherwise, or with no posts, ask "What name goes on your posts?". Bio and expertise only from that person's about page or the credibility answer; otherwise "none yet". Never the Mac's git identity. |
| Site live | means "online and rebuilds from this repository's base branch", so true only on deployment evidence that names both this repository's production branch and the entered site's host: GitHub Pages: the repository's Pages site metadata (`gh api repos/<owner>/<repo>/pages`) reports a URL or custom domain equal to the entered site's host and a source branch equal to the base branch; Netlify, Vercel, Cloudflare: a successful deployment status or check run on the base branch's latest commit whose target or environment URL is on the entered site's host. A config file or workflow in the repo, a matching host header, or matching page text is not evidence on its own (a copied repository has all three). Anything less, or `gh` unable to read it: ask today's menu (online and rebuilds from GitHub / not online / I don't know), counted. WordPress and hosted CMS: online when the address answers, no rebuild part. |
| Reddit, X research, repurpose | Reddit on, X off, repurpose on |
| Competitor profile folder | the default |
| Images | diagrams drawn by code on; AI pictures on only when `codex` is installed (no test generation offered); screenshots on; featured default: planner picks; project folder `tools/remotion` |
| Palette, fonts | the site's own from its stylesheet or Phase 1.5, else the scaffold's. Never shown as codes, never asked. The test render still runs; its result is one line and never a list of problems to decide on. |
| Mood, watermark, annotation, aspect ratio, cover layouts | defaults as today |
| Astro content folder, authors map, preview comment marker | content folder from the collection; authors map from `src/content/authors/` or the config, else off; preview marker off |
| Markdown image serving | derived from the repository's configuration as a folder-to-URL pair, with the deployment base prepended to the URL exactly once, because the adapter uses the prefix verbatim for cover and body images: Hugo `static/images` served at `<baseURL path>/images`; Next.js `public/images` served at `<basePath>/images`; Eleventy only from a folder actually passed to `addPassthroughCopy` in its config, with the URL it maps to, and `assets_dir` set to that folder; Astro relative paths. When the config does not establish the pair (Eleventy with no passthrough, an unusual Hugo `static` setting), ask today's question, counted. |
| Site conventions | drafted as today, confirmed in the summary, not on its own |
| Plan approval | ask |
| Custom instructions | none, not asked |
| Content plan file and console block | always written on both paths (create if missing, never overwrite), no question, no mention of the app anywhere in the run |

### Product on the quick path

With the product's address, setup reads the product's own site (home,
features, pricing, about pages it links to) plus PRODUCT.md or README in the
repo, and fills `product.md` from that **cited first-party evidence**: every
feature line names where it came from. This is a deliberate relaxation of
today's "owner only" rule for this path; the summary shows the feature
list and the owner corrects it there. Section by section when the evidence
is silent:

- Identity: from the home page; if even that fails, ask one fallback
  question ("In one sentence, what does <product> do?"), counted.
- Features, differentiators, unique-in-category: only what the pages say;
  an empty section says "none found at setup".
- First-party data: "none yet".
- Positioning rule: "teach first, name <product> once near the end", read
  back in one sentence.
- Existing posts: from the site.
- Pricing page: the pricing link found on the product site; when none is
  found, today's fallback wording with one change: "No pricing page found
  at setup. Posts never state a price; they point to <CTA target>
  instead." Never asserts that no pricing page exists.

## Reading the live site on the quick path

Phase 1.5 today asks two questions (does the site have posts, may Pilcrino
read it) and stops three times for confirmations. On the quick path none of
that is asked: when the address answers, setup says one line ("Reading your
site to fill in the rest") and runs the research; the pages are the owner's
own public site. Every confirmation moves to the summary. On the detailed
path Phase 1.5 keeps its questions and confirmations, counted in the total.

## The summary before the commit (both paths)

After the last interview question and before validation and the commit,
setup prints what it is about to save: one line per topic in owner words
("Readers: solo founders deciding what to build. Voice: direct, from your
three live posts. Images: diagrams drawn by code, in your site's colours.
Posts go: pull requests on GitHub, merging publishes."). Then one menu:
"Save this" / "Change something". "Change something" is **correction
mode**, distinct from the interview: the owner names a topic or a single
line (free text), and setup takes the owner's value directly for any
derived field, including the ones no path asks about (route prefix,
trailing slash, tags, mission), or runs that topic's
detailed questions when the owner asks for them. It rewrites the affected
files, refreshes what depends on them (the Remotion theme when images
change, internal-link rules when the prefix changes), and shows the summary again.
Only then: validation ("Checks passed", never a count), the commit
question, the commit as today.

"Change a setup answer" after the commit (from the What next menu) runs the
same loop, then validation and a second commit under the same consent, so
the recap never says "pushed" about files that are not.

## The detailed path

The same phases as today, every question one at a time, with these
changes:

- Counter on every question, "Question 12 of 41". The total is computed
  from the adapter, the modules, the number of authors and whether writing
  samples exist, and recomputed aloud when a yes adds a block.
- Every question with a default is an `AskUserQuestion` menu with the
  default first, in owner words. Free text keeps "reply `default` for ..."
  only when the default is too long for a label; then the menu is "Use the
  suggestion" / "I'll type my own".
- Tags and route prefix are derived as on the quick path and shown in
  the summary, not asked.
- Palette and fonts become one question: "Images will use your site's
  colours and fonts (found in its stylesheet) / the standard set. Keep
  that, or tell me your brand colours in words?" Codes and stacks appear
  only when the owner gives their own. No caveats about theme slots or
  headless Chrome.
- The test render reports one line and asks nothing.
- Phase 7 is gone as a question: the content plan file and console block
  are always written, nothing is said about the app. One validator run,
  reported as "Checks passed".
- The summary-before-commit applies here too.

## The ending (both paths)

After the commit, the recap as today (where the blog lives, how a post
reaches readers, competitors, anything the owner must still do). Then one
`AskUserQuestion` menu, at most four options:

- "Plan a batch of posts (research, about half an hour, unattended)"
- "Write a post now"
- "Research a competitor" (only when the competitors module is on;
  otherwise "Change a setup answer" takes this slot)
- "Something else": a second menu with "Change a setup answer" and
  "Nothing now, show me the commands".

Choosing an item invokes that skill in the same session (setup already
hands off to another skill this way at the browser sign-in step); "Nothing
now" prints the three commands, one line each, in plain words.

## Language rules added to How to talk to the owner

- Never show a hex code, a font stack, a count of checks or invariants, a
  file name other than the final folder, or the word "app".
- A question with a known answer is not asked; it is stated in one line
  with its source ("Language: English, from your site").
- A default is clicked, never typed, except free text too long for a label.
- Every derived value is shown in the summary before it is saved.

## What changes in the files

- `skills/blog-setup/SKILL.md`: the choice menu after Phase 0; the
  disposition of every prompt (one list, the detailed path as the source
  of truth with a quick-path column, so the two cannot drift); the counter
  rule; the summary-before-commit; Phase 7 folded into Phase 6 as an
  unconditional create-if-missing write; the What next menu; the language
  rules. The sentence in Phase 5's markdown section that uses "Phase 7 has
  added a console: block" as the sign of an app-run blog goes.
- `skills/blog-post-workflow/references/config-schema.md`: the comment
  saying the console block is "present only for blogs operated by the
  app" is updated. `plan-content` decides standalone or app from
  `~/.pilcrino/console/blogs.json`, so nothing else changes.
- `README.md` changelog and `.claude-plugin/plugin.json` version bump.
- `tests/lint.sh` passes; validator tests unchanged.

## Acceptance (manual, before the PR)

The lint and validator tests cannot show that a wizard asks fewer
questions, so the builder runs the skill and records each transcript's
question count and the files written, in a scratch folder, never a live
blog:

1. Fresh quick setup on a new Astro blog with no live site, product off.
2. Fresh quick setup on a blog with a live site and posts, product on with a
   real product address: byline, voice, palette and pricing page come from
   evidence; the summary shows them; a direct override of a derived-only
   field (tags) through "Change something" sticks before the
   commit, and a second one (route prefix) sticks after the commit and is
   recommitted.
3. Fresh quick setup on a Hugo blog with no live site, `baseURL`
   `https://example.com/docs/`, posts in `content/posts/` and a permalink
   setting of `/articles/:slug/`: expected `blog.url`
   `https://example.com`, prefix `/docs/articles/`, canonical URL
   `https://example.com/docs/articles/<slug>/`, image prefix
   `/docs/images`, and the cover and body image URLs in a staged post
   start with `/docs/images/<slug>/`.
4. WordPress quick setup when a test site is available; otherwise a dry
   run against a fixture address with a subdirectory install
   (`https://example.com/journal`): base URL and prefix keep `/journal`.
4b. A copied repository that still holds the original's Pages workflow
   and deploy config, with the entered address on the same host as the
   original site: setup asks the live-site menu instead of deriving true.
4c. An Eleventy repo with a custom passthrough mapping: the image folder
   and URL come from the config.
5. Re-run on a quick-path blog: per-phase keep / update / start over
   works and an existing content-plan.md with rows is left alone.
6. Detailed setup on blog 1, counting questions against the announced
   total.

## Left to the builder

- Exact wording of every question, summary line and "what was done"
  statement, within the language rules.
- The exact counter totals per adapter and module combination.
- The form of the "derived at setup" marker in the files.
