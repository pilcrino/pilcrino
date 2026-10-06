<!-- Forum and X operators, buyer-stage modifiers and the persona, pattern and
     integration templates adapted from marketing-skills (customer-research,
     content-strategy, programmatic-seo), MIT License,
     Copyright (c) 2025 Corey Haines. -->

# Query bank

Fill the slots from the description: `<category>` (what buyers call the product
type), `<job>` (what they do with it), `<buyer>`, `<platform>` (what it plugs into),
`<competitor>`, `<fear>` (what the description or the owner says buyers worry about:
cost, quality, privacy, lock-in, speed, compliance), `<problem>` (the pain in the
buyer's words), `<persona>` and `<use case>` (a buyer role and one job it does),
`<type>` (a kind of output the product makes), `<X>` to `<Y>` (moving from one tool
or format to another), `<A>` `<B>` (two tools used together). Pick 16 to 24 queries,
at least two per bucket, in the buyer's words.

| Bucket | Templates | What it finds |
|---|---|---|
| Category | best `<category>` for `<buyer>`; `<category>` software `<year>`; `<category>` with `<key feature>` | who owns the head terms, which vendors run "alternatives" pages |
| Workflow | how to `<job>` with `<tool buyers already have>`; how to `<job>` on `<platform>`; `<job>` without `<thing the product removes>`; `<persona>` `<use case>`; `<type>` examples | how-to queries buyers run before they buy |
| Pain | `<competitor>` too expensive; `<category>` `<fear>`; `<category>` problems; is `<category output>` bad for `<thing it affects>` | objections and fears, in the searcher's words |
| Comparison | `<competitor>` alternatives; `<product>` vs `<competitor>`; `<rival>` vs `<rival>`; `<competitor>` review; best `<category>` for `<segment>`; `<category>` for `<role>`; how to export data from `<competitor>`; `<competitor>` pricing | who owns the comparison pages, what the complaints are |
| Adjacent | `<category>` for `<platform>`; one time purchase `<category>`; how often should `<buyer>` `<job>`; `<category>` vs agency or doing it yourself; `<X>` to `<Y>`; `<A>` `<B>` integration | long tail nobody claims |
| Buyer's AI question | the sentence a buyer would type into ChatGPT, run on Google: which `<category>` `<does X>`; `<category>` recommended for `<buyer>` | the fan-out queries AI answers use, and who gets cited |
| Forum and X | `site:reddit.com "<problem>" "recommend" OR "alternative"`; `site:reddit.com "<competitor>" "vs" OR "alternative" OR "switched"`; `"<problem>" "anyone know" OR "recommend"`; `"<category> is broken" OR "frustrated with <category>"` | threads and posts where buyers ask for help or compare tools in their own words |

Buyer-stage modifiers: awareness (how to, guide), consideration (best, vs, alternatives), decision (pricing, reviews), implementation (templates, examples, setup).

If a brand name has another meaning (a word, a company in another field), add its
domain or the category word: "tally.so pricing", "tally forms alternatives".

## Reading a Google result page

From the captured page text of `https://www.google.com/search?q=<query>&hl=en&gl=us`:

- Organic results appear as title, source, date, snippet. Take the top eight.
- "AI Overview" or "AI Mode" text near the top means an AI answer rendered; note
  its one-line gist. "People also ask" entries reading "An error has occurred" mean
  the panel exists but did not render: note "present, unread".
- "People also ask" questions end with "?". Copy verbatim.
- "People also search for" is the related-searches block. Copy verbatim.
- "Discussions and forums" lists Reddit and Quora threads with comment counts:
  these are the Step 5 candidates. Record the URL and count.
- Ignore "Sponsored results" and "Find related products".

## Per-query entry in the SERP notes

```markdown
## <query>
- Organic: <site: title (date)>, ... (top eight)
- AI answer: <none | present, unread | gist>
- PAA: <question> / <question>
- Related: <term>, <term>
- Forums: <url> (<n> comments), ...
- Owner: <vendor | listicle | agency | forum | individual | video>, freshness <dates>
- Gap: <none | what is missing or off-intent>
- Angle: <the one thing the product can say that nothing on the page says>
- Competitors seen: <names>
```
