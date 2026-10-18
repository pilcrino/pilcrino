# Setup quick path: acceptance record

Driven from a neighbouring herdr pane with `claude --model opus --plugin-dir /Users/slav/work/pilcrino-quick-path`; every answer typed or clicked by the test driver, screens read after each step. Commit answered "Not yet" in every run (Slav's instruction).

# Acceptance case 1: new Astro blog, quick path (branch 8762d11, Opus, 2026-10-18)

Folder /private/tmp/pilcrino-setup-acceptance/case1, `npm create astro --template blog`, one commit on main, no remote.

| Step | What the wizard said | Finding |
|---|---|---|
| 1 | Mac check in one sentence; "Is this folder your blog, case1?" menu | ok, uncounted as designed |
| 2 | "What is your blog called?" with Keep "Astro Blog" / Another name | FINDING A: asked before the quick/detailed path menu, no "Question N of T" prefix. Also narrates "I'll name the repository based on your blog's title... need to figure out a better name" (internal reasoning shown). |
| 3 | Repo: "Shall I create a private GitHub repository called clockfold-notes...?" | ok; created lucky72o/pilcrino-acceptance-case1 (throwaway, delete after). Spoken: "next time, just cd there before running claude" although claude WAS started there (FINDING B, minor). Mentions reuse from other blogs on this Mac: "I'll reuse matching answers (voice, writer, product, competitors, image style)" before the path menu; spec says reuse menus are detailed-only (check what it does on quick). |
| 4 | Path menu: Quick setup (recommended) / Detailed setup | ok, wording as designed |
| 5 | "Question 2 of 10: What is your blog's web address?" Keep https://example.com / Another address | counter ok (name was Q1). Narration muddled: "Next up: what your blog is about, since I noticed your site's address is still set to the placeholder" (FINDING C, minor). |
| 6 | "Language: English, from your site." then "Question 3 of 10: What is Clockfold Notes about" as free text | ok, derived value stated with source |
| 7 | "Question 4 of 10: Who reads Clockfold Notes?" free text; Claude Code pre-filled a suggestion in the input box | ok (suggestion is the harness, not the plugin) |
| 8 | Wrote blog.md (cadence "weekly" derived) and audience; "Question 5 of 10: What makes you the one to write this?" | ok |
| 9 | "One more than I said: 11 now. Question 6 of 11: What name goes on your posts?" | ok, conditional author question raises T. blog.md: no pillars, tags "none yet", cadence weekly derived. No CTA section yet (written after Phase 3 per design). |
| 10 | "Question 7 of 11: Do posts promote a product of yours?" Yes/No | ok. Case 1 is product off: answer No. |
| 11 | "Question 8 of 11: Name the competitors posts may compare you with, or say none." free text, no menu | FINDING D: free text where a menu with "None" would be the clickable default (spec: defaults clicked). Minor. |
| 12 | Images: no question asked on the quick path; test image rendered and opened. Said "it falls back to a standard system font on this Mac, but that won't affect your actual site" | FINDING E: a font caveat reached the owner (design says no font stack caveats). Minor. Research sources: not asked, as designed. |
| 13 | "One more than I said: 12 now. Question 9 of 12: Is your blog online now...?" No / Yes / I don't know | FINDING F: with a placeholder address (example.com) the answer is knowable (not live); the question could be omitted. As designed though (no deployment evidence → ask). Counter consistent. |
| 14 | "Question 10 of 12: Where do posts go?" Into my Astro site (Recommended) / Text I paste elsewhere | ok |
| 15 | Derived: posts in src/content/blog, images src/assets/blog, trailing slashes. Uncounted consent: "Add tags and the author's name to your site's post format?" Add both / Leave them out | ok, uncounted as designed. Narration "let me know if you'd like me to add those..." then the menu (double ask, minor). |
| 16 | Uncounted consent: "Add the draft switch to your site?" Add it (Recommended) / Leave it out. Narration explains "one-line format change plus a filter on the index, post pages, and RSS feed" | ok; the technical detail in the narration is borderline (owner-words rule), minor. |
| 17 | Phase 5 done without a counted question; "Question 11 of 12: ...may it push those files to main later without asking each time?" No, ask me / Yes | ok. "Besides the setup commit we're about to make" is said before the commit question offers "not yet" (minor wording). |
| 18 | Summary before the commit, one line per topic with origin markers "(standard)", "(from your repository)"; address shape https://example.com/blog/<post>/; "Save this / Change something" | ok. config.yaml: url origin, route_prefix /blog/, trailing_slash true, site_live false, review ask, console block gated, push_without_asking false. blog.md: no pillars, tags "none yet", CTA target home page. Top of the summary scrolled off (pane read shows only the screen). |
| 19 | "Change something" → typed "Tags: billing, invoicing, ..." → blog.md §Tag taxonomy holds the five tags verbatim; summary printed again with Save/Change | ok, correction mode works for a derived-only field |
| 20 | Checks ran; "Question 12 of 12: Shall I commit them and push them to main on GitHub now?" Push now (Recommended) / Not yet | ok: N equals T on the last question; two options only. Narration before it lists technical items ("draft-filtering across index/pages/RSS, ... git config") (minor, owner-words rule). Did not see "Checks passed" line on screen (scrolled). |
| 21 | "Not yet" → recap: 3 sentences (files safe locally, re-run picks up, pending push and placeholder domain). Then What next: Plan a batch / Write a post now / Change a setup answer / Nothing now | menu correct for competitors off. FINDING G: recap is not the designed one (missing "where the blog lives", "what setup took", "how a post reaches readers"); it also calls the push "required for posts to publish" (a git task the design says never to list). Minor. |
| 22 | "Nothing now" → three commands printed; before them: "run /pilcrino:blog-setup again before your first post. It goes straight to the push question." | ok. Files: config.yaml, content-plan.md (empty table), profile/{audience,authors,blog,image-style,setup-notes,voice}.md; validator passes; git-dir lists kept (not committed). |

Case 1 result: PASS with minor findings A to G. Announced total 10 → 11 (author) → 12 (site live); 12 counted questions asked; numbering consistent throughout.

# Case 5: resume case 1's folder with two content-plan rows (uncommitted setup)
| 23 | Resume: after "Is this folder your blog" it went to the summary with every answer kept; line "Content plan: 2 posts, kept as they were. Every post waits for your approval" | ok (per-phase keep/update prompts not seen on screen; the quick resume keeps answers by design). |
| 24 | Save → "Checks passed." → "Question 1 of 1. Pilcrino's setup files are ready: ... Shall I commit them and push them to main on GitHub now?" Push now / Not yet. Rows intact (2 planned). | ok. Narration "The first try tripped over a shell quirk and built nothing. Trying again" reached the owner (FINDING H, minor: internal detail). |
| 25 | What next shown again after "Not yet"; "Nothing now" → commands | ok |

Case 5 result: PASS. Resume kept every answer and the two plan rows; one counted question (the commit).
## Case 3: Hugo under /docs/, custom permalink, quick path (2026-10-18)

Folder /private/tmp/pilcrino-setup-acceptance/case3, repo lucky72o/pilcrino-acceptance-case3 (throwaway). Opus, plugin at f863fbe.

| Step | What the wizard said | Finding |
|---|---|---|
| 1 | Preflight one line; "Is this folder your blog, case3? It holds a Hugo site called Clockfold Notes, connected to ..." Yes / No | ok |
| 2 | main branch line; "Since Pilcrino is already set up for other blogs on this Mac, I'll reuse matching answers where applicable, but things like ... will need fresh values" then the path menu | reuse sentence before the path menu again (narration, minor; 0c is detailed-only on quick) |
| 3 | "About 10 questions..." then "Question 1 of 10. What is your blog called? Your site's settings call it Clockfold Notes." Keep / Another | ok |
| 4 | "Question 2 of 10. What is your blog's address? ... https://example.com/docs/, which is a stand-in..." Keep / Another | ok (names hugo.toml, a file name: rule 8 says only the final folder; minor) |
| 5 | "Question 3 of 10. What is Clockfold Notes about..." Use the suggestion / I'll type my own | ok; narration "Based on the site's self-description, I've drafted..." (reasoning, minor) |
| 6 | "Question 4 of 10. Who reads Clockfold Notes?..." free text with a ghost-text suggestion, no menu | FINDING I: readers has a default (from the niche) so rule 10 says menu "Use the suggestion" / "I'll type my own"; asked as free text. Minor. |
| 7 | blog.md written with Tag taxonomy tools, notes (copied from the post) and cadence weekly; "Question 5 of 10. What makes you the one to write this?" free text | ok |
| 8 | "One more than I said: 11 now. Question 6 of 11. What name goes on your posts?" | ok (no byline on the site) |
| 9 | authors.md written; the model rewrote the template heading "## mira — Mira Holt" to "## mira: Mira Holt" after its own "no long dashes" grep | FINDING J: the authors.md template heading in SKILL.md uses an em dash; the model avoids it, so the heading shape varies between blogs. Check readers of the heading. |
| 10 | "Question 7 of 11. Do posts promote a product of yours?" Yes / No | ok |
| 11 | "Question 8 of 11. Will posts name competitors to compare you with?" No competitors / Yes, I'll name them | ok: finding D fixed |
| 12 | Browser sign-in reused; image project scaffolded; site live derived false from the placeholder address, not asked (finding F fixed) but narrated at length ("merging a post's PR just files it in the repo... Hugo doesn't need to be installed here", with an em dash) | FINDING K: narration too long and uses "PR"; minor |
| 13 | "Question 9 of 11. Where do posts go?" Into this Hugo site / Into WordPress / Pasted into another platform | ok |
| 14 | Adapter narration ("...each post opens a PR from blog/<post> against main..."); "Question 10 of 11 ... may it push those files to main later without asking..." No, ask me / Yes | ok; narration again uses "PR" and a branch name |
| 15 | Summary: tags tools, notes; images standard set in words; "Post addresses look like https://example.com/docs/articles/<post>/, ending with a slash (from your repository)"; Save this / Change something | ok: prefix /docs/articles/ |
| 16 | "Checks passed" not seen on screen (scrolled); "Question 11 of 11. Shall I commit these files and push them to main on GitHub now?" Push now (recommended) / Not yet | ok; preceding narration lists tools/remotion and "two small git config tweaks" (file-ish detail, minor) |
| 17 | Push now: "Pushed to main". Recap: one paragraph ("...syncing with lucky72o/... on GitHub — posts arrive as PRs that go live once merged... swap the placeholder URL in hugo.toml") then What next: Plan / Write / Change / Nothing now | FINDING G persists in shape: prose paragraph, not the listed lines; em dash, "PRs", hugo.toml named. The "push required" sentence is gone. |

Case 3 result: PASS. config.yaml: url https://example.com, route_prefix /docs/articles/, trailing_slash true, content_dir content/posts, assets_dir static/images, image_url_prefix /docs/images, platform hugo, frontmatter keys incl. cover, site_live false (derived from the placeholder address, not asked). Counter 10 → 11 (author), 11 questions asked. Pushed to the throwaway repo. New findings I, J, K; G persists in shape.

## Case 2 + 4b: live Astro site with posts and several bylines, product on, copied repo (2026-10-18)

Folder /private/tmp/pilcrino-setup-acceptance/case2: clone of satnaing/astro-paper (MIT) pushed to throwaway lucky72o/pilcrino-acceptance-case2; address https://astro-paper.pages.dev/ (the original's live site, 12 posts, bylines Sat Naing x10 plus two guests). Expect: site live ASKED (copied repo), author name ASKED (several bylines), palette/voice from the site in the summary, tags changed verbatim in correction mode, product address asked, route prefix /posts/ from a live post link; after the push, change the route prefix via "Change a setup answer" and get a second commit.

| Step | What the wizard said | Finding |
|---|---|---|
| 1 | preflight; "Is this folder your blog, case2?" Yes / No | ok |
| 2 | "...configured for Affilytics, Olga Pak, Pilcrino, and Markdown Test in ~/work, I'll reuse shared answers (audience, tone, writer, product, competitors, image style)..." then the path menu | FINDING L: 0c promises reuse of other blogs' audience/voice/product before the path is chosen; wrong for a different-niche blog and not what the quick path does. Fix 0c wording. |
| 3 | "Question 1 of 10: What is your blog called? Your repository calls it AstroPaper, which is the name of the site template..." Keep / Another name | ok (good catch of the template name) |
| 4 | "Question 2 of 10: What is your blog's web address? Your repository still has https://astro-paper.pages.dev, which is the site template's own demo address, not yours." Keep the demo address / Another | ok (sharp); kept for the live-site evidence |
| 5 | "Everything in the repository describes the site template, not Paper Trail, so there is nothing to suggest here. Question 3 of 10. What is Paper Trail about...?" free text | ok |
| 6 | "Question 4 of 10. Who reads Paper Trail?" free text with ghost suggestion | finding I again |
| 7 | author asked: "One more than I said: 11 now. Question 6 of 11. What name goes on your posts?" | ok: several bylines so asked, not derived. But blog.md Tag taxonomy = "none yet" while the repo posts carry tags (docs, release, ...) | FINDING M: tags not copied from the posts' frontmatter; check the derive rule. |
| 8 | "Question 7 of 11: Do posts promote a product of yours?" No / Yes | ok (No listed first here, Yes first in case 3: order varies, minor) |
| 9 | "One more than I said: 12 now. Question 8 of 12. What is your product's website address?" | ok |
| 10 | Product read from pilcrino.com (home, pricing, about); "Rule on file: posts teach first and name Pilcrino once, in a side note near the end." Then "Question 9 of 12: Will posts name competitors...?" No competitors / Yes | ok |
| 11 | Yes → "Name the competitors posts may compare you with." free text in the same turn, ghost suggestion offered | ok |
| 12 | Competitors Koala AI, Jasper; image project scaffolded with the site palette and font from the live site (theme.ts fonts Google Sans Code); test image opened | ok |
| 13 | Draft flag: "Posts stay marked as drafts until you approve them"; site live derived false ("still using the placeholder address") because the demo address counts as a template default; not asked. "Question 10 of 12: Where do posts go?" Astro / WordPress / Text to paste | ok per the new placeholder rule; case 4b's "asked" expectation does not apply when the address is the template demo. |
| 14 | "One more than I said: 13 now. Question 11 of 13: Your site's post format names the publish date and the cover image differently... Shall I?" Change the post format (recommended) / Stop here | ok (Astro schema shape question, counted) |
| 15 | schema edited; "GitHub: OK..." "Question 12 of 13: ... may it push those files to main later without asking each time?" No / Yes | ok |
| 16 | Summary: palette and Google Sans Code font from the repository, prefix https://astro-paper.pages.dev/posts/<post>/ with slash, schema note; Save this / Change something | ok (prefix /posts/ correct; top of the summary scrolled off) |
| 17 | Change something → tags "astro, content-workflow, theming, dependencies": blog.md holds exactly those four; summary re-shown | ok (Review Focus 5) |
| 18 | "Checks passed." "Question 13 of 13: Pilcrino's setup files are ready... four small changes to your site... Shall I commit them and push them to main on GitHub now?" Push now / Not yet | ok |
| 19 | Pushed. Recap again one prose paragraph ("took ~25 min", "Posts go live as PRs you merge") | finding G shape persists; also "PRs" |
| 20 | What next: Plan / Write / Research a competitor (Koala AI or Jasper) / Something else | ok, competitors-on menu correct |
| 21 | Change a setup answer → prefix /articles/: the wizard explains the prefix comes from the site's page structure and offers Move the site / Only change Pilcrino's record / Keep | ok (sensible guard; one em dash in the explanation) |
| 22 | Save → "Checks passed and I've pushed..." second commit e6cfda8 "Pilcrino setup: posts live under /articles/"; config route_prefix /articles/; What next again | ok |

Case 2 result: PASS. Counter 10 → 11 (author, several bylines) → 12 (product address) → 13 (Astro post format); 13 asked. Palette and font from the repository/site in the summary; tags changed verbatim (4 entries) before the commit; second commit after Change a setup answer. Site live derived false because the address is the template demo (placeholder rule), so the 4b "asked" expectation did not arise. New: L (0c reuse promise), M (tags "none yet" though posts carry tags), em dashes and "PRs" in narration, recap still prose (G).

## Case 4c: Eleventy passthrough media -> assets, quick path (2026-10-18)

Folder /private/tmp/pilcrino-setup-acceptance/case4c, repo lucky72o/pilcrino-acceptance-case4c (throwaway). `.eleventy.js` has addPassthroughCopy({ "media": "assets" }), posts in posts/ with permalink /posts/<slug>/. Expect image prefix /assets, assets_dir media.

| Step | What the wizard said | Finding |
|---|---|---|
| 1 | "Is this folder your blog, case4c? An Eleventy site called Tidewater Notes" | ok |
| 2-3 | path menu; "Question 1 of 10: What is your blog called?" Keep Tidewater Notes / Another | ok |
| 4 | "Question 2 of 10: What is your blog's web address?" free text, no default (none in the repo) | ok |
| 5 | no stand-in sentence for example.com this time (Q2 rule says one sentence); "Question 3 of 10: What is Tidewater Notes about?" | minor inconsistency |
| 6-8 | readers (ghost text), credibility, "One more than I said: 11 now. Question 6 of 11: What name goes on your posts?" | ok |
| 9-10 | product No, competitors No (menu); image project installed and rendered | ok |
| 11 | "Test image rendered; I've opened it on your screen. Next, where your posts go. Not online yet: the address is still the stand-in." (findings E and F fixed, exact wording) "Question 9 of 11: Where do posts go?" | ok |
| 12 | config: content_dir posts, assets_dir media, image_url_prefix /assets, route_prefix /posts/, platform eleventy (case 4c expectation met). "Question 10 of 11: ... push ... without asking?" | ok |
| 13-14 | Summary, Save this; "Question 11 of 11: ... Shall I commit them and push them to main on GitHub now?" Push now / Not yet | ok |
| 15 | Not yet → recap: one sentence with an em dash ("nothing's committed or pushed since you chose not yet — everything's saved at <folder>... rerun /pilcrino:blog-setup later to push it"); What next menu | finding G shape again |

Case 4c result: PASS. assets_dir media, image_url_prefix /assets, content_dir posts, route_prefix /posts/. 11 questions, counter consistent.

## Case 4: WordPress dry run, address with a path (2026-10-18)

Folder /private/tmp/pilcrino-setup-acceptance/case4 (README only), repo lucky72o/pilcrino-acceptance-case4 (throwaway). Address https://example.com/journal; /wp-json/ probe really returns 404. Expect probe URL https://example.com/journal/wp-json/ and a prefix beginning /journal/. Not run live (no test WordPress).

| Step | What the wizard said | Finding |
|---|---|---|
| 1 | "This folder is a GitHub repository for the Harbour Journal WordPress blog. Is this your blog's repository?" | ok |
| 2-3 | path menu; "Question 1 of 11. What is your blog called?" Keep Harbour Journal / Another | ok: T=11 from the start (WordPress username) |
| 4 | address https://example.com/journal: "example.com is a stand-in... not online yet"; "Question 3 of 11. What is Harbour Journal about?" | ok |
| 5 | "One more than I said: 12 now. Question 4 of 12. Posts on a WordPress site at https://example.com/journal usually have an address like .../journal/some-post. What comes between /journal/ and the post's name?" Nothing / blog / Another word | ok: prefix composes under /journal/ (Review Focus 1) |
| 6-8 | readers (ghost text), credibility, "One more than I said: 13 now. Question 7 of 13. What name goes on your posts?" | ok |
| 9-10 | product No, competitors No; image project installing | ok |
| 11 | "Test image rendered..." "Not online yet: the address is still the stand-in." "Question 10 of 13. Where do your posts go?" WordPress / Pasted into another platform | ok |
| 12 | WordPress: long narration ("merging the PR only commits the text to the repo... no /wp-json/... the count is actually 14, one more than previously stated"); "Question 11 of 14. Which address should Pilcrino use to reach your WordPress?" Keep the stand-in / Give the real address | FINDING K again: narration leaks PR, repo, /wp-json/; the "one more" line is mangled |
| 13 | "Question 12 of 14. What is your WordPress username...?" | ok |
| 14 | Application password instructions (wp-admin, Users, Profile...), "Have you got it copied?" free text | ok (asked as free text; a menu "Yes, I have it" / "Not yet, skip" would fit rule 10; minor) |
| 15 | password skipped; probe URL in the transcript: https://example.com/journal/wp-json/ (4 times). "Question 13 of 14 ... push ... without asking?" | ok: Review Focus 1 probe |
| 16 | Summary step: the wizard printed only "I've compiled the full setup summary for Harbour Journal — covering identity, audience, ... ready to save" and the Save menu; the transcript has no summary list at all. My typed "I don't see the summary" was taken as Save. | FINDING N (important): summary skipped before the save menu; rule 11 violated. Harden the Phase 6 text: the list is printed in the message, never described. |
| 17 | "Question 14 of 14. Shall I commit these files and push them to main on GitHub now?" Push now / Not yet | ok |
| 18 | Not yet → recap prose again ("blog isn't committed yet, setup took ~20 minutes, posts flow as GitHub PRs plus WordPress drafts..."); What next | finding G shape |

Case 4 result: PASS (dry, not run live). config: url https://example.com, route_prefix /journal/, adapter wordpress-rest, base_url https://example.com/journal, username ellen, site_live false; probe URL https://example.com/journal/wp-json/. Counter 11 → 12 (route prefix) → 13 (author) → 14 (WordPress address); 14 asked. Finding N: no summary printed.

## Case 6: detailed path on the case 1 folder from scratch (2026-10-18)

Folder /private/tmp/pilcrino-setup-acceptance/case1 reset to its Astro scaffold (blog-ops and tools removed, site edits reverted). Expect: announced total matches the questions asked.

| Step | What the wizard said | Finding |
|---|---|---|
| 1 | "Detailed setup it is: 54 questions..." "Question 1 of 54: What is your blog's name?" | ok (Astro total 54) |
| 2-3 | Q2 address keep; "Question 3 of 54: Which language..." English / Another | ok |
| 4-5 | Q4 about (my answer named the blog Clockfold Notes); "Question 5 of 55: You called the blog Clockfold Notes just now, but earlier we kept Astro Blog..." | my inconsistency; the wizard raised T by one for the clarification (sensible) |
| 6 | "Question 6 of 55: Use that suggestion for the blog's mission, or write your own?" | ok |
| 7-8 | Q7 point of view; tags stated as none yet, filled at planning (derive, both paths: correct); "Question 8 of 55: At the end of every post, where should readers be pointed?" free text with ghost suggestion | ok |
| 9 | cadence menu Weekly / Every two weeks / Monthly / Whenever | ok (Q9 of 55 assumed; header scrolled) |
| 10 | "Question 10 of 55: Who reads Clockfold Notes?" ghost text | ok: identity took 8 (+1 clarification), route prefix and slash not asked |
| 11 | "Question 11 of 55: Is there a second group of readers...?" No / Yes | ok |
| 12 | "Question 12 of 55: Use those three problems, in that order, or write your own list?" | ok |
| 13 | "Question 13 of 55: Use that suggestion for the language posts should use...?" | ok |
| 14 | language to avoid, Use the suggestion | ok |
| 15 | jargon translation, Use the suggestion / own / None yet | ok |
| 16 | "Question 16 of 55: Do your readers already know the niche's insider terms...?" | ok (audience 7 questions, 10-16) |
| 17 | "Question 17 of 51: Do you have 2 or 3 things you've written before...?" No, ask me / Yes | FINDING O: total went 55 → 51 with no sentence about it (the site-reading questions dropped for the placeholder address, presumably). The rule says a changed total is said once. |
| 18 | tone menu | ok |
| 19-20 | credibility; lexicon From my answers / own / None yet | ok |
| 21 | "Question 21 of 51: Give me 3 to 5 short stories... Reply none to skip" free text | ok |
| 22 | positioning order menu | ok |
| 23 | "Question 23 of 51: ... words or phrases you want banned?" No / Yes | ok |
| 24 | allowlist domains No / Yes | ok |
| 25 | "Question 25 of 51: How many people write for Clockfold Notes?" Just me / More than one | ok (voice block 17-24, 8 questions) |
| 26 | "Question 26 of 51: What name goes on your posts?" | ok |
| 27 | authors done (one author, no bio question seen: author block 2); Reddit question Yes / No | ok |
| 28 | "Question 28 of 51: Should research also search X?" No X / Yes | ok |
| 29 | "Question 29 of 51: Does Clockfold Notes promote a product of yours?" No / Yes | ok |
| 30 | "Question 30 of 51: Will posts name other tools or competitors...?" No / Yes | ok |
| 31 | "Question 31 of 51: repurpose...?" Yes / No | ok (modules 27-31, 5 questions) |
| 32 | "Question 32 of 51: Which kinds of images..." multi-select Remotion / AI / Screenshots, all three ticked | ok |
| 33 | "Question 33 of 51: Which kind should a post's cover image be by default?" | ok |
| 34 | "Question 34 of 51: Where in this repository should the diagram-drawing project live?" Keep tools/remotion / Another | ok |
| 35 | "Question 35 of 51: Which colours and fonts should images use?" My site's (in words, no hex) / Tell me | ok |
| 36 | "Question 36 of 51: What mood should images have?" menu | ok |
| 37 | watermark question (Q37 of 51) | ok |
| 38 | "Question 38 of 51: screenshot marks" Standard / Describe | ok |
| 39 | "Question 39 of 51: What shape should AI-generated pictures be?" | ok |
| 40 | "Question 40 of 51: Keep all seven cover layouts...?" | ok |
| 41 | image test rendered line exact; "One more than I said: 52 now. Question 41 of 52: Want me to make one test AI picture now?" | ok (conditional announced) |
| 42 | site live derived (placeholder): "This resolves two outstanding questions, bringing the total to 50." "Question 42 of 50: How should posts reach your site?" | ok: total change announced this time; "repo" in narration |
| 43 | "Question 43 of 50: Posts go in the folder src/content/blog... Keep that?" | ok (folder named: needed here) |
| 44 | "Question 44 of 50: Each post's images go in src/assets/blog/<post>... Keep that?" | ok |
| 45 | schema question ("Your site's post format has no place for tags or the author's name... Add them / Leave them out") with NO counter | FINDING P: the post-format question was counted in case 2 (Q11 of 13) and uncounted here; minor inconsistency |
| 46 | draft switch consent (uncounted action) Add / Leave out | ok |
| 47 | "Question 45 of 50: Does your site keep a list of authors in a file...?" No / Yes | ok |
| 48 | "Question 46 of 50: ... preview link comment?" No / Yes | ok |
| 49 | "Question 47 of 50: ... approve that plan yourself...?" | ok |
| 50 | pushing consent (Q48 of 50 presumably; header scrolled) | ok |
| 51 | "Question 49 of 50: Is there anything every post should always or never do...? reply none" | ok |
| 52 | Summary shown as a list (identity, readers, voice, images in words, where posts go, site changes, sources, plan approval, pushing, content plan); Save this / Change something | ok |
| 53 | "Question 50 of 50: Shall I commit these files and push them to main on GitHub now?" Push now / Not yet | ok: last question number equals the announced total |

Case 6 result: PASS. Totals announced 54 → 55 (name clarification, my inconsistency) → 51 (silent drop: finding O) → 52 (AI test picture) → 50 (site live and one more resolved, announced); the last counted question was 50 of 50. Site edits built. Findings O (silent total drop) and P (post-format question uncounted here, counted in case 2).

## Findings I to P and the fixes (2026-10-18, second round)

Fixed in the skill after the runs above (commit after f863fbe):

- G: the recap and the summary are bulleted lists printed in the message; a prose paragraph or "I've compiled the summary" is not allowed.
- I: the readers question offers its inferred default as a "Use the suggestion" menu, not ghost text.
- J: the authors.md heading template uses a colon, so the model stops rewriting an em dash.
- K and C: at most two sentences of owner words between questions; "PR", "repo", probe paths and dashes banned in owner text.
- L: 0c says nothing before the path is chosen; the reuse sentence is detailed-path only.
- M: tags are taken from the repository's own posts first, then the fetched site, then WordPress.
- N: the summary list must be printed above the Save menu (case 4 skipped it).
- O: a total that falls is announced like one that rises.
- P: the Astro post-format consents are actions, uncounted on both paths (as the spec says); case 2 counted one and that was the slip, not case 6.

Not fixed: case 2's "Question 2" stand-in sentence was skipped once in case 4c (minor, wording already in the rule); the product menu's option order varies (Yes/No vs No/Yes).

Throwaway repositories left for deletion by the owner (the signed-in token lacks the delete scope): lucky72o/pilcrino-acceptance-case1, -case2, -case3, -case4, -case4c. Scratch folders under /private/tmp/pilcrino-setup-acceptance/.
