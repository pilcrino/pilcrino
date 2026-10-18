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
