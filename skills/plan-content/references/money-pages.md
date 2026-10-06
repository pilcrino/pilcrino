# Money pages

Pages a buyer reads just before choosing. They come first in a `new` batch.
Each rule carries its source in the Rob Hoffman bible (`docs/robhoffman/bible.md`
in the owner's notes), its date, and the skeptic's caveat. Nearly all of it is
Rob's own claim, made while selling an agency and a SaaS; none of it was
independently verified.

1. **Page types.** Every idea gets one `pageType` (bible 3.2, versions A and B,
   2026-09-12 and 2026-09-14; caveat: the lists drift between versions).
   - `alternatives`: "[competitor] alternatives".
   - `vs`: "[product] vs [competitor]", or "[rival] vs [rival]" with the product
     as the third option.
   - `review`: "[competitor] review".
   - `best-for`: "best [category] for [segment]".
   - `for-role`: "[category] for [role or use case]".
   - `export`: "how to export data from [competitor]".
   - `how-to`: any other how-to or informational post.
   - `other`: anything that fits none of these.

   An idea's `competitors` names the competitor or competitors the page is
   about, and nothing else. `alternatives`, `review`, `export`: the one
   competitor. `vs`: the vendors that are not this blog's product, so
   "[product] vs X" is just X and "[rival] vs [rival]" is both rivals.
   `best-for`, `for-role`, `how-to`, `other`: empty. Options listed inside a
   best-of, for-role or alternatives post are not gate names and never go in
   `competitors`. With `modules.competitors` on they are chosen only from
   competitors that have a profile, and go on the idea's `Mention:` line after
   the subjects. Every idea with a non-empty list gets the `Mention:` line
   and, with the module on, the profile gate (SKILL.md Step 8), whatever its
   slug.

2. **Candidates in a `new` batch**, in this order (bible 3.2, 2026-09-14; caveat:
   "5 to 20 pages drive 90%" has no data behind it). Rank the eligible
   competitors (Step 6) and choose up to six. Then one `alternatives` per
   chosen competitor; one `vs` for each of the top three only; one `best-for`
   per segment in `{profile_dir}/audience.md`; one `for-role` per role or use
   case in `product.md`. Fewer competitors qualify, fewer candidates.

3. **Caps, per run** (bible 3.3, 2026-09-13; caveat: "few pages optimized well"
   is a stance, not a measured result). At most six competitors are chosen. A
   competitor that already has an `alternatives`, `vs` or `review` post in the
   request's `posts` (terminal: the console's post list) is not chosen and
   takes no slot. `review` only when the SERP for "[competitor] review" has no
   strong page. Best-of posts list five to nine options, one per segment where
   possible (bible 5.4, 2026-09-12; caveat: assistants cite self-promotional
   lists less than third-party ones). With the module on, only profiled
   options count: fewer profiled, fewer options, and the report names the
   ones to profile.

4. **Specific over generic** (bible 3.1, 2026-08-26; caveat: the long-tail
   examples are Rob's, volume was not checked). Every idea names a segment,
   competitor, role, use case or platform in its slug or angle. "Best form
   builders" fails; "best form builders for agencies" passes. Fan-out variants
   still merge.

5. **A buying reason for how-to and informational ideas** (bible 3.1, 2026-09-12
   against 2026-09-14; caveat: Rob's own lists contradict each other on
   how-to). The angle names the money page the post feeds and links to. In
   Pilcrino's pick a how-to with no money page to feed is cut.

6. **Slow to rank, said in the angle** (bible 3.3, 2026-09-16 and 2026-08-26;
   caveat: timings are Rob's claims). A comparison or best-of page with high
   buying intent and low ease stays near the top, and its angle says it will
   be slow to rank on this domain. Rob keeps the target and changes the route.

7. **Do not drop for low volume alone** (bible 3.4, 2026-03-13; caveat: Rob
   sells an SEO service and the claim is untested). Keyword tools lag on new
   keywords. Low or missing volume lowers ease at most.

8. **One stats post per plan** (from `ai-citation.md`).

9. **Your idea.** The owner's text is the brief and wins. Rules 4 and 5 become
   preferences: keep the idea when they cannot be met and say so in the angle
   ("owner-directed; no search demand found"). Rules 2, 3 and 8 apply only when
   the text asks for comparison posts. Origin: backed by search evidence is
   `research`; kept on the owner's direction without evidence is `owner`. In
   Pilcrino's pick every idea is `research`.
