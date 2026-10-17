---
name: blog-setup
description: Interactive, resumable setup that creates or updates a blog's blog-ops/ workspace, written for a blog owner who is not a developer. Starts with a preflight on a fresh Mac (Apple's git stub, Node 22.13+, the GitHub CLI and its sign-in, Chrome), finds the blog (a folder on this Mac, a GitHub repository it clones, or a new repository it creates with consent) and offers to reuse an earlier Pilcrino setup on the same Mac. Then offers two paths, quick setup (about ten questions, everything else derived from the site and the repository) or detailed setup (every question), one question at a time with a counter, plus a one-time sign-in to the Pilcrino browser; shows every derived value in a summary before saving, and writes blog-ops/config.yaml plus every profile/*.md doc the rest of this plugin consumes (blog.md, audience.md, voice.md, authors.md, product.md, image-style.md, competitors/methodology.md, site-conventions.md, custom-instructions.md). An optional research pass, offered when the blog already has live content, pre-fills audience, voice and image style from the live site with consent. Reads the site to fit it (Astro content schema and draft flag, Hugo theme cover key and uglyURLs, WordPress permalinks), stores a WordPress application password in the macOS keychain through a hidden prompt, scaffolds the Remotion image project when remotion is enabled, and probes the publish adapter's auth at most once per run. Ends by running scripts/validate-config.mjs (config-schema.md invariants 1 to 16), committing and pushing the setup files with consent, and ending with a What next menu (plan posts, write a post, research a competitor, change an answer). Always writes blog-ops/content-plan.md and the console block. Must be run before blog-post-workflow, whose Step 0 config preamble hard-stops without a valid blog-ops/config.yaml.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, AskUserQuestion, mcp__plugin_pilcrino_pilcrino-browser__tabs, mcp__plugin_pilcrino_pilcrino-browser__navigate, mcp__plugin_pilcrino_pilcrino-browser__capture, mcp__plugin_pilcrino_pilcrino-browser__screenshot, mcp__plugin_pilcrino_pilcrino-browser__wait, mcp__plugin_pilcrino_pilcrino-browser__login_status, mcp__plugin_pilcrino_pilcrino-browser__open_login, mcp__plugin_pilcrino_pilcrino-browser__close_login
---

# blog-setup

Builds the `blog-ops/` workspace that every other component in this plugin
reads: `blog-post-workflow`'s Step 0 config preamble, the personas, the
agents, `review-blog-post`, `humanize-text`, `suggest-images`,
`generate-images`, `repurpose-blog-post`, and `blog-retro` all consume the
files this wizard writes. Run this FIRST. It may be started from any folder:
Phase 0 finds the blog (a folder on this Mac, a GitHub repository it clones,
or a new repository it creates with consent) and continues inside it.

The authoritative contract for everything this skill produces is
`${CLAUDE_PLUGIN_ROOT}/skills/blog-post-workflow/references/config-schema.md`
(the full `config.yaml` schema, the example configs, validation invariants
1 to 16, and the path-variable table). If anything below and that file
disagree, that file wins; re-read it before making a judgment call this
skill doc doesn't cover explicitly.

## How to talk to the owner

The person answering is the blog's owner, usually not a developer, usually
on their first day with Claude Code. Every message they read follows these
rules; they override the wording of any example in this file.

1. **Plain words only.** The owner never sees internal vocabulary. Banned in
   anything printed to them: phase numbers ("Phase 3.5", "Phase 0"),
   "artifacts", "adapter" or "publish adapter", "assets_dir", "content_dir",
   "archetypes", "base branch", "staging-preview", "frontmatter", "schema",
   "invariant", "config block", "env var", "bootstrap", "resume run", raw
   config lines or keys (`apply_inbound_links_live: false`), and hex colour
   codes unless the owner asks for them. Say what a value means instead of
   quoting it: "images are uploaded to WordPress when the post is staged",
   not "`assets_dir: blog-ops/assets`". The phase headings below are for the
   model; each phase names itself to the owner by what it does:

   | Phase in this file | What the owner hears |
   |---|---|
   | Phase 0 | "Checking this Mac" and "Finding your blog" |
   | Phase 1 | "What your blog is about" and "Who reads it" |
   | Phase 1.5 | "Reading your live site" |
   | Phase 2 | "How your blog sounds" and "Who writes it" |
   | Phase 3 | "Research sources, your product, your competitors" |
   | Phase 3.5 | "Signing in to Pilcrino's browser" |
   | Phase 4 | "Images" |
   | Phase 5 | "Where your posts go" |
   | Phase 6 | "Final checks" |
   | Phase 7 | "The Pilcrino app (optional)" |

2. **One question per message.** A message ends with exactly one question.
   Never a numbered list of questions, never "also, ..." with a second one.
   When a question has a fixed set of answers, ask it with `AskUserQuestion`
   as a menu; when it needs free text, ask it in prose.
3. **Defaults are clicked, never a key press.** An empty Enter does nothing
   in Claude Code, so never write "press Enter for X" or "hit return".
   Offer the default as the first menu option (rule 10 below says how).
   Where a question stays free text, accept `default`, `keep`,
   `use the default`, `ok` and the like as the default.
4. **Never offer `/` or any slash-prefixed text as an answer.** Typing `/`
   opens Claude Code's command menu and restarts the skill. A URL path such
   as `/`, `/blog/` or `/posts/` is offered as a menu option or asked as
   "reply `root` for no prefix, or give the word, for example `blog`";
   the model adds the slashes.
5. **Suggest, never invent.** A suggested default comes from evidence (a
   file in the repo, the live site, an earlier answer, an earlier setup on
   this Mac) or is a plain convention. Never suggest a product claim, a
   price, a free trial, a sign-up page or a pricing page the owner has not
   mentioned; ask instead. Never derive a product claim from a personal
   story. Never use the Mac's git or GitHub identity as an example name for
   the owner or an author.
6. **Read back every rule you record.** When an answer becomes a standing
   rule (how the product is mentioned, which competitors exist, who may push
   to GitHub), repeat it in one sentence before moving on.
7. **Say what you did, not how.** "Saved your answers" rather than file
   paths and keys, except for the final summary, which names the folder.
8. **Nothing internal, ever.** On top of rule 1, never print to the owner:
   a hex code, a font stack, a count of checks or invariants ("Checks
   passed", never "14 pass" or "pass by vacuity"), a file name other than
   the final folder, or the word "app". The Pilcrino app is never
   mentioned during setup, on either path, at any step.
9. **Known answers are stated, not asked.** When evidence settles a value
   (the repository, the live site, an earlier answer), say it in one line
   with its source and move on: "Language: English, from your site."
10. **Defaults are clicked.** Every question that has a default is an
    `AskUserQuestion` menu with the default first, labelled with the value
    in owner words ("Keep `Trail Notes`" / "Another name"). A question
    stays free text only when it has no default or the default is a
    paragraph too long for a label; then the menu is "Use the suggestion"
    / "I'll type my own", and the suggestion is printed above it. Never
    write "reply `default` for X" to the owner.
11. **Every derived value is shown before it is saved.** A value setup
    took from evidence or from a convention appears in the summary before
    the commit (Phase 6), one line per topic in owner words, where the
    owner can change it. Nothing derived is saved unseen.

## What gets produced

```
<blog-repo>/
└── blog-ops/
    ├── config.yaml
    ├── profile/
    │   ├── blog.md
    │   ├── audience.md
    │   ├── voice.md
    │   ├── authors.md
    │   ├── image-style.md
    │   ├── product.md                  # only if modules.product: true
    │   ├── competitors/                # default location; configurable via
    │   │   └── methodology.md          #   competitors.profile_dir (only if modules.competitors: true)
    │   ├── site-conventions.md         # only if Phase 1.5 research ran (§Phase 1.5)
    │   ├── setup-notes.md              # Phase 3.5 sign-in outcome
    │   └── custom-instructions.md      # only if seeded in Phase 6; always optional
    └── reference/                      # only if Phase 1.5 research ran
        ├── site-research.md            # evidence log, cites every fetched URL
        └── image-samples/              # downloaded featured/in-post images
```

Plus, if `images.remotion` is enabled, a copied-and-personalized Remotion
project at `images.remotion.project_dir` (scaffolded from
`${CLAUDE_PLUGIN_ROOT}/scaffold/remotion-starter/`).

`blog-ops/templates/` (optional same-named overrides of this plugin's
`templates/*.md`) and `blog-ops/drafts/` are NOT created by this wizard;
they come into existence on demand (an override the blog owner adds later,
or the first `/pilcrino:blog-post-workflow new` run creating a slug directory).

## Path variables

Per config-schema.md §Path variables: `{ops_dir}` (`blog-ops`),
`{profile_dir}` (`blog-ops/profile`), and `{drafts_dir}` (`blog-ops/drafts`)
are FIXED conventions, never configurable, so this wizard can write profile
docs before `config.yaml` even exists. `{content_dir}`, `{assets_dir}`, and
`{remotion_dir}` are resolved from the answers gathered in Phase 4 and
Phase 5 below; use the literal values the user gave you once you have them,
the `{...}` notation here is just shorthand for "the path this variable
resolves to."

## Global rules (apply to every phase)

1. **One question at a time.** Never dump a numbered list of questions and
   ask the user to answer all of them in one message. Ask, wait for the
   reply, ask the next one. Offer a sensible default in most questions
   as the first menu option (§How to talk to the owner rule 10) so the
   interview moves fast for a user who's happy with conventions. Where an
   older line in this file still says "press enter" or "reply `default`",
   read it as "the default is the first menu option".
2. **Write artifacts immediately**, at the end of each phase, not batched
   at the very end of the whole wizard. A crash or an intentional stop
   after Phase 3 leaves Phases 1-3's files on disk, ready for a resumed run
   to pick up at Phase 4.
3. **Resumability.** Before starting a phase, check whether its artifact(s)
   already exist. If they do: read them, print a short summary (2-5
   lines), and ask: "Keep as-is, update, or start over for this phase?"
   - **Keep as-is** → skip straight to the next phase, no writes.
   - **Update** → re-run the interview pre-filled with the existing
     answers as defaults (a user hitting enter on every question
     reproduces what's already there); rewrite the artifact(s).
   - **Start over** → run the interview from scratch, ignoring the
     existing content, then overwrite.
4. **`config.yaml` is always rewritten whole.** Never append a YAML
   fragment to the end of the file. Each phase that touches `config.yaml`
   reads the current file (if any), merges its new/updated top-level
   key(s) into the in-memory structure, and writes the complete file back.
   This keeps the file valid YAML at every checkpoint, not just at the end.
5. **Never write a secret VALUE anywhere** — not in `config.yaml`, not in
   any profile doc, not in a status message, not in a tool result. Only
   where a secret lives: a macOS keychain service name
   (`app_password_keychain`) or an environment-variable NAME
   (`app_password_env`). Never ask the owner to paste a secret into the
   chat: Phase 5's WordPress step collects it through a hidden macOS
   dialog that stores it straight into the keychain, in one shell command,
   so the value never passes through a tool result.
6. **No placeholder tokens left behind.** Every doc this wizard writes must
   be fully filled from the interview; never leave a literal `<...>`
   template placeholder in a file presented as finished. If the user has
   no answer for an optional field, write "none yet" or omit the section
   per that section's own optionality rule (documented per phase below),
   never leave the angle-bracket placeholder in place.
7. **`blog-ops/` is fixed at the workspace repo root.** Never ask the user
   where to put it, never make it configurable. Every path this wizard
   writes into `config.yaml` or discusses with the user is relative to the
   repo root (the blog folder Phase 0 settled on; run every later command
   from there).
8. **Note the start time.** On a fresh run, write
   `{profile_dir}/setup-notes.md` with "Setup started <date and time>" as
   the first line (create the folder if needed); on a resumed run, append
   "Setup resumed <date and time>". The completion message reports how long
   setup took from this.
9. **List every path setup writes.** Each time setup creates or edits a
   file in the repository (`blog-ops/` docs, `config.yaml`,
   `.gitattributes`, `.gitignore`, the Remotion project, `.gitkeep` files,
   competitor profiles, a site file Phase 5 edits with consent), append its
   repo-relative path to the list in git's own folder, once:
   ```bash
   P="$(git -C "<blog folder>" rev-parse --absolute-git-dir)/pilcrino-setup-paths"
   grep -qxF -- "<path>" "$P" 2>/dev/null || printf '%s\n' "<path>" >> "$P"
   ```
   `--absolute-git-dir` prints a full path, so the list lands in the blog's
   own repository whatever folder the shell is in. Never build these paths
   with `git rev-parse --git-path`: it can print a relative path, which the
   shell resolves from its own folder. The same holds for every file setup
   keeps in git's own folder (`pilcrino-setup-before`, the commit index in
   Phase 6).
   Record exact files, never a folder. Where setup creates a folder
   (`blog-ops/profile/`, the Remotion project, a `.gitkeep` folder), record
   each file it writes in that folder, one line each. When a copy or a
   tool writes many files at once (the Remotion project), list them right
   after it finishes and record each one:
   `find "<folder>" -type f -not -path '*/node_modules/*' -not -path '*/out/*'`.
   Never record a path under `_scratch/`, `_setup-shots/`,
   `blog-ops/reference/image-samples/`, `node_modules/` or `out/`: those
   are temporary or built files and never go in a commit. Phase 6's commit
   holds exactly this list and nothing else.

   **Site files go in `setup-notes.md` too, but only once committed.** A
   site file is any file setup edits outside `blog-ops/` and the Remotion
   project (the Astro post format and the page filters in Phase 5, a Hugo
   config file if setup changes one, `.gitattributes`, `.gitignore`).
   While editing, record it in the paths list above only. The heading
   `## Site files edited by setup` in `{profile_dir}/setup-notes.md` is
   written by Phase 6 step 2, at the moment the commit is built and after
   the owner's include decisions: it lists only the site files that are in
   that commit, one repo path per line and nothing else on the line. A
   site file the owner withheld is never listed there. When the section
   already exists from an earlier run, Phase 6 rewrites it from the
   committed set rather than adding to it. Keep that heading the last
   section of the file: a later note (Global rule 8's resume line, Phase
   3.5's sign-in line) goes above it, never under it. The post workflow's
   Step 0 reads this section to know which site files belong to setup.
10. **Two paths and the counter.** On a fresh run, right after Phase 0d,
    ask once with `AskUserQuestion`:
    - "Quick setup (recommended)": about ten questions, everything else
      taken from your site and repository and shown to you before it is
      saved.
    - "Detailed setup": every question, about forty, one at a time, each
      with a default to click.

    Record the choice in `{profile_dir}/setup-notes.md` as `Path: quick`
    or `Path: detailed`. A resume run (0d found files) skips this menu:
    "update" on a phase runs that phase's detailed questions pre-filled
    with what is on file.

    **Dispositions.** Every question in the phases below carries a line
    `Quick path: <ask|derive|omit|action>. <rule>` right under it. On the
    quick path: `ask` is asked and counted; `derive` is written from the
    evidence the line names and shown in the summary; `omit` writes the
    default the line names and shows it in the summary; `action` is a
    consent or sign-in done as today, never counted. On the detailed path
    every question is asked unless its line says "both paths", in which
    case the derivation applies to both and the value is changed in the
    summary, not asked. A question without a disposition line is asked on
    the detailed path and derived or omitted on the quick path per the
    phase's own text; the implementer of this file keeps every question
    annotated.

    **The counter.** Every asked question starts with "Question N of T".
    T is fixed when the path is chosen, after Phase 0's platform
    detection. Quick path: T = 10 (name, address, about, readers,
    credibility, product yes/no, competitors, where posts go, pushing
    consent, the commit question), +1 for WordPress (username), +1 when
    the product answer is yes (its address, counted as it arises). A
    conditional question (route prefix, site live, author name, product
    identity fallback, image serving fallback) raises T by one when it
    arises, said aloud: "One more than I said: 11 now." Detailed path T
    per adapter and modules: see the table in Phase 6's "Counting the
    detailed path" (filled from the question lists below); when a yes
    adds a block, say the new total once ("Your product adds nine
    questions; 12 of 50 now").

## Phase 0: Preflight and finding the blog

Runs once, before Phase 1, on every invocation (resumed or fresh). To the
owner this is "Checking this Mac", then "Finding your blog". Open with one
sentence: "Before any questions, I'll check that this Mac has what Pilcrino
needs, then find your blog."

### 0a. Preflight: the tools, in this order

Run the checks in exactly this order. **Never run a bare `git`, `python3`,
`gcc` or `make` before check 1 has passed:** on a Mac without Apple's
Command Line Tools each of those is a stub that pops up Apple's install
dialog with no explanation. `xcode-select -p` is safe; so are `node`,
`gh`, `command -v`, `ls`, `find` and `curl`.

For every miss, the message has four parts and nothing else: what is
missing, in plain words; why Pilcrino needs it (one sentence); one route to
fix it (never a menu of package managers); and an offer to do it for you
where that is possible. Then wait. After the owner says it is done, re-run
the same check before moving on. A miss never ends setup: fix it, re-check,
continue.

1. **Apple's Command Line Tools (git).** `xcode-select -p >/dev/null 2>&1
   && echo ok || echo missing`.
   - Missing: "This Mac does not have Apple's command line tools yet. They
     include git, which Pilcrino uses to keep your posts in your GitHub
     repository. Installing them opens an Apple window: click Install, then
     Agree; it takes a few minutes and comes straight from Apple. Shall I
     start that install?" On yes, run `xcode-select --install` and say: "The
     Apple window should be on your screen now (it can hide behind other
     windows). Click Install and Agree, wait until it says the software was
     installed, then tell me." On the reply, re-run the check. Only after
     `ok` may any `git` command run.
2. **Node.js 22.13 or newer.** `command -v node >/dev/null 2>&1 && node
   --version || echo missing`. Parse the major and minor: 22.13 or newer
   passes; 24 is fine.
   - Missing or too old: "Pilcrino's browser, its diagram images and an
     Astro site all run on Node.js, which this Mac does not have (or has an
     old version of). I can download the official installer from nodejs.org
     and run it; macOS will ask for your Mac password in its own window,
     which I never see. Or you can download the macOS installer from
     https://nodejs.org yourself and double-click it. Which do you prefer?"
     On "do it": download the current LTS `.pkg` from nodejs.org's download
     page to a new empty folder under `$(mktemp -d)` with `curl -fsSL -o`,
     then run it through `osascript -e 'do shell script "installer -pkg
     <file> -target /" with administrator privileges'` (macOS shows its
     password dialog; the Bash call needs a long timeout). Re-check with
     `node --version`.
   - If Node was missing when this session started, Pilcrino's browser
     could not start with it, and an MCP server starts only with Claude
     Code. Say so now, once: "One more thing: because Node.js was missing
     when Claude Code started, Pilcrino's browser is not running in this
     session. The questions up to the sign-in step do not need it. Before
     that step I'll ask you to quit Claude Code and start it again in your
     blog's folder; every answer is saved as we go." Do that restart only
     if the first browser tool call in Phase 1.5 or Phase 3.5 actually
     fails (never pre-emptively), and give the exact three lines then: quit
     with `/exit`, in Terminal `cd <blog folder>` then `claude`, then
     `/pilcrino:blog-setup`.
   - A browser tool that answers "pilcrino-browser is installing its
     packages" is not a failure: right after a plugin update the browser
     installs its packages on first start, which takes a minute or two.
     Tell the owner once, wait a minute, and call it again; never ask for a
     restart or for any file to be deleted for this.
3. **GitHub CLI (`gh`).** `command -v gh >/dev/null 2>&1 && gh --version |
   head -1 || echo missing`.
   - Missing: "Pilcrino uses GitHub's command line tool to open each post
     as a pull request for you to review, and to sign in to GitHub from
     this Mac. It is not installed. I can download the official installer
     and run it (macOS asks for your Mac password in its own window), or
     you can get it from https://cli.github.com. Shall I install it?"
     On yes: if `command -v brew` succeeds, run `brew install gh`;
     otherwise download the latest macOS `.pkg` from
     `https://github.com/cli/cli/releases/latest` (the asset named
     `gh_<version>_macOS_universal.pkg`) with `curl -fsSL -o` into a new
     empty folder under `$(mktemp -d)` and run it through the same
     `osascript ... installer -pkg ... with administrator privileges`
     command as for Node; `installer` is not gated by Gatekeeper. If the
     owner installs it by double-clicking instead and macOS says the
     package is from an unidentified developer, tell them: right-click the
     file, choose Open, then Open again; or System Settings, Privacy &
     Security, "Open Anyway". Re-check with `gh --version`.
4. **GitHub sign-in.** `gh auth status >/dev/null 2>&1 && echo ok || echo
   signed-out`. Run this BEFORE any look at a repository: an
   unauthenticated check cannot tell a private repository from a wrong
   address, so never say "private or wrong link" before this passes.
   - Signed out: "Next, sign in to GitHub from this Mac. Type exactly this
     into Claude Code, with the exclamation mark first:
     `! gh auth login -h github.com -p https -w`
     It prints a one-time code (also copied to your clipboard) and a web
     address, https://github.com/login/device. It asks no questions and
     does not open the browser for you: open that address in Chrome, sign
     in to GitHub if asked, paste the code, click Continue, then Authorize.
     Tell me when it says you are signed in." Claude Code picks the
     finished command up by itself; either way, re-run `gh auth status` and
     report the account in one line: "Signed in to GitHub as <login>."
   - Then: "Shall I let git use this GitHub sign-in too? Without it, the
     pull and push steps later ask for a username and password that GitHub
     no longer accepts." On yes, run `gh auth setup-git`. On no, continue
     and expect to repeat the offer at the first push.
5. **Google Chrome.** `[ -d "/Applications/Google Chrome.app" ] || [ -d
   "$HOME/Applications/Google Chrome.app" ] && echo ok || echo missing`.
   - Missing: "Pilcrino researches in its own copy of Google Chrome, which
     this Mac does not have. Install it from https://www.google.com/chrome
     when you can; the questions up to the sign-in step do not need it."
     Continue; Phase 3.5 re-checks.

When everything passes, say so in one line ("This Mac has everything
Pilcrino needs: git, Node.js <version>, the GitHub tool signed in as
<login>, and Chrome.") and move on.

### 0b. Finding the blog

The goal is one folder on this Mac that is a git repository with a GitHub
remote: Pilcrino keeps its files in `blog-ops/` there, and every post is a
pull request against it. Decide where the session is first:

- If the current folder is inside a git repository that is not the home
  folder and holds either `blog-ops/` or a site (`astro.config.*`,
  `hugo.toml`/`config.toml`, `package.json`, `_config.yml`, `content/`),
  ask once: "Is this folder your blog, <folder name>?" Yes: that is the
  blog folder; skip to 0c. No: ask the menu below.
- If the current folder is the home folder, or not a git repository, or a
  repository that is clearly something else: never run `git init` here and
  never offer to. Ask the menu below.

Ask with `AskUserQuestion`: "Where is your blog's website right now?"

1. **"In a folder on this Mac."** Ask for the folder (a path, or "it's in
   my home folder called X"). Check it exists and is a git repository
   (`git -C <folder> rev-parse --is-inside-work-tree`) with a GitHub
   remote (`git -C <folder> remote get-url origin`). A folder that is a
   repository without a remote: say so and offer to create the GitHub
   repository for it as in answer 3 (`gh repo create <name> --private
   --source <folder> --push`, after consent). That folder is the blog
   folder.
2. **"On GitHub, but not on this Mac."** Ask for the GitHub address or
   `owner/name`. Check it with `gh repo view <owner/name> --json
   name,viewerPermission`: a failure after sign-in means the signed-in
   account cannot see it; say "Your GitHub account <login> cannot see that
   repository. Ask whoever set it up to add <login> as a collaborator with
   write access, then tell me." Permission below write: same message. Then
   clone it: "I'll download it to `~/<name>` (reply `default`) or give me
   another folder." The default folder is named after the repository or
   the blog, never `my-blog`. Run `gh repo clone <owner/name> <folder>`.
   State what it holds in one sentence from its files ("a Hugo site with
   the Ananke theme, no posts yet"; "an Astro site"; "empty").
3. **"Nowhere yet, or it is on WordPress / Webflow / another platform
   that hosts it for me."** First the one-sentence reason, then a question:
   "Pilcrino still needs a GitHub repository for this blog: every post is
   reviewed there as a pull request before it goes anywhere, and the
   repository keeps your posts and Pilcrino's settings. Do you already have
   one for this blog, maybe one someone made for you?" Yes: continue as
   answer 2. No: "Shall I create a private GitHub repository called
   `<blog-slug>` under your account <login> and download it to
   `~/<blog-slug>`? Reply `default`, or give another name." Derive the
   name from the blog's name (ask for the name first if it is not known
   yet; it is reused as Phase 1's first answer). On consent run `gh repo
   create <name> --private --clone` from the home folder, which creates the
   repository and the local folder in one step. Never create a local-only
   repository (`git init` without a remote): no pull request could ever be
   opened from it.

Whichever answer: from here on every command runs from the blog folder
(`cd <blog folder> && ...` at the top of each Bash call, or `git -C`).
There is no restart. Say: "I'll continue in `<folder>` for the rest of
setup. Next time, start Claude Code there: in Terminal, `cd <folder>` then
`claude`."

**Put the folder on its main branch, before setup writes anything.** Setup
commits its files to the repository's main branch (the base branch every
post's pull request goes against), so the folder must be on that branch
before the first file is written (Global rule 8's `setup-notes.md` in 0d is
the first). In the blog folder, in this order:

1. **Record what the owner already changed.** Save the status as it is
   now, before setup writes anything, in git's own folder (never committed):
   ```bash
   B="$(git -C "<blog folder>" rev-parse --absolute-git-dir)/pilcrino-setup-before"
   [ -f "$B" ] || git -C "<blog folder>" status --porcelain > "$B"
   ```
   A resumed run keeps the file an earlier run saved. If it lists
   anything, mention it once ("You have unsaved changes in <files>; I'll
   leave them alone and they stay out of setup's commit. If setup has to
   write into one of them, I'll show you that file before saving it") and
   leave them alone, staged or not: Phase 6 builds its commit without
   touching what the owner staged.
2. **Find the base branch.** `gh repo view --json defaultBranchRef -q
   .defaultBranchRef.name` (an empty repository has none: `main`). This is
   `git.base_branch` in Phase 5.
3. **Switch to it.** `git -C "<blog folder>" branch --show-current`. Already
   on it: nothing to do. On another branch: when step 1 listed changes,
   say so first and ask before switching: "You are on the branch
   `<current>` with changes you have not saved in git yet. Setup needs to
   work on `<base>`. Switching keeps your changes in the folder as they
   are; shall I switch? (Or stop here, and you save or move them first.)"
   No → stop setup here and say how to resume. Yes, or nothing listed:
   `git switch <base>` when the branch exists locally; otherwise
   `git fetch origin <base>` then `git switch -c <base> --track
   origin/<base>`. An empty repository has no commit yet: check
   `git symbolic-ref --short HEAD` names `<base>`, else run `git
   symbolic-ref HEAD refs/heads/<base>`; the setup commit creates it. A
   failed switch (a change that would be overwritten): say which file in
   plain words, and stop until the owner has dealt with it.
4. **Bring it up to date.** When `origin/<base>` exists, `git pull
   --ff-only origin <base>`; if that fails, say so in one line and
   continue (the push at the end will tell).

Say in one line: "Setup works on `<base>`, your repository's main branch."

### 0c. Earlier Pilcrino setups on this Mac

Look for other blogs set up with Pilcrino, so the owner is not asked
thirty questions twice:

```bash
find ~ -maxdepth 3 -type d -name blog-ops -not -path '*/node_modules/*' -not -path '*/.worktrees/*' 2>/dev/null
cat ~/.pilcrino/console/blogs.json 2>/dev/null
```

Drop the current blog folder from the list. If anything remains, read each
one's `blog-ops/profile/blog.md` (name, niche) and say: "You already set up
Pilcrino for <blog name> in `<folder>`. Where an answer carries over (who
reads it, how it sounds, who writes it, your product, competitors, image
style) I'll show you that blog's answer and you can keep or change it.
What must be new: this blog's address, where posts go, and whether it has
posts already." Remember the list; each phase's resume check below offers
the reuse. When the two blogs turn out to cover the same niche, say once:
"Two blogs chasing the same searches compete with each other in Google;
fine if one replaces the other, worth a thought if both stay live."

Nothing found: say nothing about it.

### 0d. Resume detection

`Glob: blog-ops/config.yaml` and `Glob: blog-ops/profile/*.md` in the blog
folder.

- Neither exists → fresh run: write the start time (Global rule 8) and
  proceed to Phase 1.
- Either exists → this is a resume/update run. Read what's there, work out
  which phases already have their files (config.yaml keys present; which
  profile docs exist), append the resume time (Global rule 8), and tell
  the owner in their words: "I found an earlier setup for this blog here.
  I'll go through each part (what the blog is about, how it sounds, your
  sources and product, images, where posts go) and for each one you can
  keep what is there, change it, or start it over." Then proceed to Phase
  1 (each phase's own resumability check per Global rule 3 handles the
  skip-vs-update decision).

### 0e. Choose the path

On a fresh run, ask the two-path menu from Global rule 10 now, record the
choice, state the counter total ("About 10 questions. Everything else I
take from your site and repository and show you before saving." for the
quick path), and proceed to Phase 1.

## Phase 1: Identity & niche

**Goal:** establish who this blog is and who it's for. Writes
`{profile_dir}/blog.md`, `{profile_dir}/audience.md`, and starts
`blog-ops/config.yaml` with the `blog:` block.

**Resume check:** `{profile_dir}/blog.md` and `{profile_dir}/audience.md`.
**Reuse from another blog (Phase 0c):** the identity questions are always
asked (a different blog has a different name, address and niche); the
audience questions are offered as "Use <other blog>'s readers for this
blog? reuse as is / change / start fresh" when the niche is the same.

Open with the owner's name for this part: "First, what your blog is
about."

### Interview: blog identity

Ask one at a time:

1. Blog name (e.g. "Trail Notes"). Offer what the repository already says
   as the default: `title` in `hugo.toml`, `site`/title in the Astro
   config, the WordPress site title from `/wp-json` (`name`), or the name
   given in Phase 0.
2. Blog URL (e.g. `https://trailnotes.example`). Offer `baseURL` /
   `site` from the same files when present. A `.example` or placeholder
   address: say in one sentence that it is a stand-in and where to change
   it later; keep going.
3. Language code (default `en`)
4. Niche/topic: what is this blog about, in one or two sentences?
5. Mission: why does this blog exist? What transformation does a reader
   get from following it?
6. Point of view: what does this blog believe about its niche that's
   distinct or contrarian? (This is what keeps posts from reading as
   generic SEO filler.)
7. Content pillars: 3-5 recurring topic buckets this blog returns to
8. Tag taxonomy: the fixed list of tags posts draw from (2-4 tags per post
   come from this list — both Astro frontmatter templates read it from
   `{profile_dir}/blog.md`)
9. Primary CTA target + hook: what should every post's closing CTA point
   to (newsletter signup, product trial, app download, etc.), and what's
   the one-line hook for it (e.g. "Subscribe for weekly trail reports")?
   **No invented default here**: never suggest a free trial, a sign-up
   page or a URL path the owner has not mentioned (a waitlist-only product
   has no `/signup`). Ask what exists; draft the hook from their answer and
   read it back.
10. Publish cadence: how often does this blog publish? (Informational,
    not consumed by any downstream check, but useful context for anyone
    reading this doc later.)
11. Route prefix: the URL path prefix this blog's posts are served under
    (default `/blog/`; `/` for a root-routed blog with no prefix). This
    drives every internal link, canonical URL, and inbound-link ownership
    grep the rest of the plugin emits, so get it right up front. Ask it in
    owner words and never offer `/` as a thing to type (§How to talk to
    the owner rule 4): "Posts on your site have an address like
    `https://<domain>/blog/some-post`. What comes between the domain and
    the post? Reply `default` for `blog`, `root` for nothing, or the word
    your site uses." Offer evidence as the default when there is any: a
    Hugo site with `content/posts/` serves `/posts/`; WordPress with the
    "Post name" permalink setting serves posts right after the domain
    (`root`); Phase 5 reads the real WordPress setting from the site and
    corrects this if needed. Write the value with both slashes.
12. Trailing slash: do (or will) this blog's post URLs end with a trailing
    slash (e.g. `/blog/my-post/`) or not (`/blog/my-post`)? **Read it
    before asking it.** Evidence beats a question for a non-technical
    owner:
    - Astro: do not ask. Phase 5 step 2a reads `trailingSlash` and
      `build.format` from the Astro config. Write the default here as a
      placeholder.
    - Hugo: do not ask. Read `uglyURLs` from `hugo.toml` (or
      `config.toml`/`hugo.yaml`): `uglyURLs = true` means no trailing
      slash (`false`); absent or `false` means `true`. State what you
      found in one line.
    - WordPress: do not ask. Phase 5 reads a published post's link and the
      permalink setting from the site and sets this; write the default
      `true` here as a placeholder (WordPress permalinks end in `/` unless
      a custom structure drops it).
    - Everything else, brand-new with no live posts, or the owner has
      already said Phase 1.5's research offer (the very next thing this
      wizard asks) will be declined: ask, as a menu ("Yes, with a slash" /
      "No, without"), default yes. Webflow and most hosted CMS platforms
      serve pages without one; say so when the platform is known.
    - Existing blog with a real chance the research offer is accepted:
      don't ask; write the default as a provisional placeholder and let
      Phase 1.5(a) detect the convention from the fetched post URLs,
      presenting it for the SAME single confirmation as its other pre-fills
      (§Phase 1.5(f)).
    Whichever path sets it, Phase 5's adapter site inspection remains the
    final cross-check: if the live site's actual convention disagrees with
    whatever value is on file, that step flags it loudly and corrects
    `blog.trailing_slash` to match reality rather than leaving the mismatch
    silent.

Write `{profile_dir}/blog.md`:

```markdown
# <Blog name>

## Niche

<answer 4>

## Mission

<answer 5>

## Point of view

<answer 6>

## Content pillars

- <pillar 1>
- <pillar 2>
- ...

## Tag taxonomy

- <tag 1>
- <tag 2>
- ...

## Primary CTA

**Target:** <link or destination from answer 9>
**Hook:** <one-line hook from answer 9>

## Publish cadence

<answer 10>
```

### Interview: audience

Owner's name for this part: "Who reads it." When Phase 0c found another
blog with the same niche, offer its `audience.md` first as a menu ("Reuse
as is" / "Reuse and change some answers" / "Start fresh"); "reuse as is"
copies the file and skips the questions.

Ask one at a time:

1. Primary audience: who reads this blog (role, context, what brought them
   here)?
2. Secondary audience, if any (skip if there's only one clear audience)
3. Top pain points this audience has, in priority order (this order
   matters, `{profile_dir}/voice.md` and the writer persona use it to
   decide what to lead with)
4. Language to use: words/phrasing that resonate with this audience
5. Language to avoid: jargon, marketing-speak, or tone that turns this
   audience off
6. Niche jargon that needs translating for this audience (terms an
   insider would know but this blog's typical reader might not) — this
   extends `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`
   §Insider-jargon translation with this blog's own niche's terms
7. Insider posture: does this audience already know the niche jargon (an
   expert/insider readership), or does every post need to translate it on
   first use? (Default: translate on first use.)

Write `{profile_dir}/audience.md`:

```markdown
# Audience

## Primary audience

<answer 1>

## Secondary audience

<answer 2, or "None — this blog writes for a single audience.">

## Pain points (priority order)

1. <highest priority>
2. <next>
...

## Language to use

- <phrase/word pattern 1>
- ...

## Language to avoid

- <phrase/word pattern 1>
- ...

## Niche jargon translation

| Insider term | Reader-facing translation |
|---|---|
| <term> | <plain-language explanation> |

## Reading posture

<answer 7 — "insider audience, jargon OK" or "translate niche jargon on first use">
```

### Write config.yaml (blog: block)

Read the existing `blog-ops/config.yaml` if present (resume case), merge in:

```yaml
blog:
  name: "<answer 1>"
  url: <answer 2>
  language: <answer 3>
  route_prefix: <answer 11, default /blog/>
  trailing_slash: <answer 12, default true>
```

Write the full file (Global rule 4). If this is a fresh run, the file now
contains only the `blog:` block; later phases add the rest. When Q12's gate
above deferred `trailing_slash` (existing blog, research offer still
pending), the value written here is the provisional default — Phase 1.5(a),
if it runs, re-merges and rewrites this same `blog:` block once the real
value is confirmed (Global rule 4), so this is never a second permanent
answer, just a placeholder.

## Phase 1.5: Existing-blog research (optional)

**Goal:** when the blog already has live content, gather concrete evidence
from the site itself — fetched pages, extracted palette/typography, sampled
images, and (once Phase 5 has chosen and verified the publish adapter) its
recorded conventions — and use that evidence to pre-fill the audience, voice,
and image-style questions the rest of the wizard would otherwise ask cold.
This phase is entirely consent-gated: a brand-new blog has nothing to
research, and even an existing one may decline.

**Offer.** Ask: "Does <blog name> already have posts live at <answer 2 from
Phase 1>, or is this a brand-new blog with nothing published yet?"

**Record the answer durably, before branching on it.** Read the
`{profile_dir}/blog.md` Phase 1 already wrote, insert `existing_blog:
<true|false>` as its own line directly under the `# <Blog name>` heading,
and write the file back. Do this for BOTH branches below, not just "already
exists" — `blog.md` is the durable spot precisely because it always
exists, unlike `blog-ops/reference/site-research.md`, which never gets
written at all in the brand-new case or the decline sub-case just below.
This is the field the Phase 5 resume check and Phase 6's site-conventions
advisory check read, instead of proxying the answer off `site-research.md`'s
mere presence — a proxy that misses an existing blog that goes on to
decline research.

- **Brand-new** (`existing_blog: false`) → skip this whole phase, no
  further question, go straight to Phase 2.
- **Already exists** (`existing_blog: true`) → ask consent separately: "I
  can research the live site now — fetch a few pages, sample images, and
  (later, once your publish adapter is set up) detect its conventions — to
  pre-fill your audience, voice, and image-style docs from real evidence
  instead of a blank interview. Want me to run that before Phase 2?" Decline
  → skip to Phase 2, same as a brand-new blog (no `blog-ops/reference/` is
  created, and `{profile_dir}/site-conventions.md` stays unwritten — per
  config-schema.md it's recommended, not required, for a non-WordPress
  adapter or a blog that declined this offer). Before moving on, firm up
  Phase 1 Q12's provisional `blog.trailing_slash` now — ask the user
  directly (research detection will never run for this blog); update
  `config.yaml` with the confirmed value.

**Resume check:** `blog-ops/reference/site-research.md`. If it exists,
summarize what's on file (URLs fetched, images sampled, whether the
adapter site-inspection sub-step below already completed) and apply Global
rule 3 (keep as-is / update — re-fetch everything, useful after a redesign —
/ start over).

### (a) Discover and fetch

Ask for the blog's homepage URL if it differs from `<answer 2>`. Discover
5-10 recent post URLs by trying, in order, until one yields results (don't
require all three): the site's feed (`<url>/feed/`, `<url>/rss.xml`,
`<url>/atom.xml`), its sitemap (`<url>/sitemap.xml` or
`<url>/sitemap_index.xml`), or, if it looks like WordPress, its REST API
(`<url>/wp-json/wp/v2/posts?per_page=10`, no auth needed for published
posts). `WebFetch` the homepage, the About page (if discoverable from the
homepage's nav or at `/about`), and the discovered post URLs. Log every
fetched URL plus a 1-2 sentence takeaway into
`blog-ops/reference/site-research.md` as you go (Global rule 2: write
immediately, don't batch until the end of the phase).

**Also detect `trailing_slash` from these same URLs.** Look at whichever of
the discovered post URLs are real permalinks (not feed/sitemap/REST API
endpoints) and note whether they end in `/` (e.g. `/blog/my-post/`) or not
(`/blog/my-post`). This is real evidence Phase 1's Q12 couldn't have had —
fold it into the SAME single pre-fill confirmation as (b)-(d)'s evidence in
(f) below, never a separate ask. Phase 5's adapter site inspection later
cross-checks this against the live site's actual permalink format and flags
any disagreement.

### (b) Palette and typography from page source

From the homepage's source, look for CSS custom properties (`--color-*`,
`--font-*`, etc.) in inline `<style>` blocks or linked stylesheets, and note
the declared font-family stack(s). Record extracted hex values and font
stacks into `site-research.md` — this is what pre-fills Phase 4's palette
question below.

### (c) Screenshots from the Pilcrino browser

Screenshots use the Pilcrino browser: `tabs open <live post URL>`, `wait`
2000, `screenshot` with `mode: full` to `{profile_dir}/_setup-shots/<n>.png`,
`Read` the PNG, `tabs close`. Delete `{profile_dir}/_setup-shots/` when
Phase 1.5 ends. If `tabs open` fails (Chrome not found), write the note
'Pilcrino browser could not start, no screenshots' to `site-research.md`
and continue. If the tool itself is unavailable because Node.js was
installed during this session (Phase 0a check 2), skip the screenshots,
write the same note, and continue; the restart happens before Phase 3.5.

Resolve the repo root once with Bash (`git rev-parse --show-toplevel`) and
reuse it: `screenshot`'s `outFile` must be an absolute path. Take the
homepage and one representative post (`<n>` = `1`, `2`):

```
mcp__plugin_pilcrino_pilcrino-browser__tabs        { "action": "open", "url": "<homepage or post URL>" }   -> tabId
mcp__plugin_pilcrino_pilcrino-browser__wait        { "tabId": <tabId>, "ms": 2000 }
mcp__plugin_pilcrino_pilcrino-browser__screenshot  { "tabId": <tabId>, "outFile": "<repo root>/{profile_dir}/_setup-shots/<n>.png", "mode": "full" }
Read                               each path in the returned `paths`
mcp__plugin_pilcrino_pilcrino-browser__tabs        { "action": "close", "tabId": <tabId> }
```

The PNGs are for visual reference only and do not outlive this phase, so
record what they show (layout, hero treatment, image style) in
`site-research.md`; Phase 4 reads those notes, not the files.

### (d) Image sampling

From the fetched pages, download 5-10 images — prioritize each recent
post's featured/hero image, plus a few in-post images — into
`blog-ops/reference/image-samples/`. Characterize the SET as a whole (not
image-by-image) in `site-research.md`: photography vs. illustration vs.
diagram, overall tone (bright/muted/technical/playful), whether images
typically carry text overlays. This characterization is the evidence Phase
4 cites when drafting `image-style.md`'s mood-word answer.

### (e) Adapter site inspection — deferred

The active publish adapter's `## Site inspection (setup-time)` procedure
(`${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` or
`astro-git-pr.md`) is what actually writes `{profile_dir}/site-conventions.md`
— but it needs the publish adapter CHOSEN, and for `wordpress-rest`
specifically, its application-password credential already VERIFIED, and
neither exists yet at this point in the wizard (Phase 5 is where both
happen). **Do not attempt this sub-step here.** Note in `site-research.md`:
"Site-conventions inspection deferred to immediately after Phase 5's
adapter setup." Phase 5 carries this forward explicitly — see that phase's
own "Site conventions" section, which runs the deferred procedure the
moment the adapter is known (and, for WordPress, the moment its one-shot
auth probe succeeds) and writes/confirms `site-conventions.md` at that
point instead.

### (f) Pre-fill downstream phases

Using ONLY (a)-(d)'s evidence (never (e), which hasn't run yet):

- **Audience (Phase 1, already written above).** Draft a proposed addition
  to `audience.md` from the About/homepage copy and the fetched posts'
  framing (language patterns, implied pain points) and present it as a
  diff: "Based on the site research, here's what I'd add to your
  audience.md: `<draft>`. Keep, edit, or skip?" Only write if confirmed —
  never silently overwrite the answers already on file from Phase 1's own
  interview.
- **`trailing_slash` (Phase 1, `blog:` block, already written above).**
  (a)'s URL-based detection is the real evidence Q12's gate (§Phase 1) may
  have deferred. Present the detected value alongside (b)-(d)'s evidence in
  this SAME confirmation pass: "Based on the fetched post URLs, this blog's
  posts <do/don't> end in a trailing slash — update `blog.trailing_slash`
  to match?" Confirmed → re-merge and rewrite `config.yaml`'s `blog:` block
  (Global rule 4) with the real value. Never a separate ask from the rest
  of this pre-fill batch.
- **Voice (Phase 2, next).** The posts fetched in (a) count as the
  "existing posts" Phase 2's writing-sample path asks the user to supply.
  When Phase 2 runs, it checks for `site-research.md` first and, if
  present, uses those already-fetched posts as its samples instead of
  asking the user for paths/URLs again (see that phase's own note).
  Extends, never replaces, the existing writing-sample synthesis and
  confirmation step.
- **Image style (Phase 4, later).** The palette hexes from (b) and the
  characterization from (d) become the DEFAULTS Phase 4 offers for its
  palette and mood-word questions, instead of the scaffold's generic
  defaults — the user still confirms or overrides every value (see that
  phase's own note).

Every pre-filled doc or diff produced here is presented for explicit
confirmation, exactly like every other phase in this wizard (Global rule
3) — this phase introduces no silent-accept exception.

**Artifacts:** `blog-ops/reference/site-research.md` (evidence log, cites
every fetched URL) and `blog-ops/reference/image-samples/` (downloaded
images). The (c) screenshots are deleted when this phase ends.
`{profile_dir}/site-conventions.md` is NOT written by this phase — see (e)
above; it's written later, by Phase 5.

## Phase 2: Voice & authors

**Goal:** capture this blog's personality and who writes it. Writes
`{profile_dir}/voice.md` and `{profile_dir}/authors.md`.

**Resume check:** `{profile_dir}/voice.md` and `{profile_dir}/authors.md`.
**Reuse from another blog (Phase 0c):** offer that blog's voice and
authors first as one menu ("Reuse both as is" / "Reuse and change some
answers" / "Start fresh"), since the same company usually sounds the same
and has the same writers.

Owner's name for this part: "How your blog sounds", then "Who writes it."

### Writing-sample path (offer first)

**Check for Phase 1.5 evidence first.** If `blog-ops/reference/site-research.md`
exists, the posts it fetched already ARE the 2-3+ existing-post samples this
path needs — use those directly (re-read them from the URLs cited in
`site-research.md`, or re-`WebFetch` if the content wasn't retained) instead
of asking the question below. Otherwise, ask it fresh:

Before interviewing from scratch, ask: "Do you have 2-3 existing posts I
can read to learn your voice from evidence? (local file paths, or URLs I
can fetch)"

- **Local paths** → `Read` each file.
- **URLs** → `WebFetch` each one.
- If the user has none, or fewer than 2 usable samples, skip straight to
  the direct interview below.

For each sample, note (with a short quoted excerpt as evidence for each):
sentence-length pattern (short-vs-long mix), first-person usage, how
personal anecdotes get woven in, formality level, recurring phrases or
openers, humor, how technical the vocabulary runs, paragraph length.

Synthesize these into a **draft** `voice.md` (structure below) and present
it to the user: "Here's the voice profile I derived from your samples,
with the evidence for each trait. Confirm, edit, or tell me what's off."
Iterate until confirmed, then still ask the direct-interview questions
below for anything the samples didn't reveal (credibility message,
anecdote bank, additional forbidden phrases, additional allowlist domains
— these are rarely visible from 2-3 posts alone).

### Interview: voice

Ask one at a time (skip any already answered by the writing-sample pass):

1. Tone in 3-5 adjectives (e.g. "direct, funny, no-nonsense")
2. Credibility message: the one-line authority statement that opens every
   post's expertise-statement sentence (e.g. "After testing 50 pairs of
   trail shoes over 200 miles, here's what held up.")
3. Lexicon: words or phrases this blog uses often, signature phrasing
4. Personal-anecdote bank: 3-5 short personal stories or experiences an
   author can draw on across posts. Say "I'll only use what you tell me; I
   won't invent stories." **A story is never a product claim.** Record each
   story as told. When a story seems to imply something about the owner's
   product ("I lost a week of hours when a tracker's sync failed" does not
   mean their product syncs reliably), do not turn it into a feature or a
   lead point; the product interview in Phase 3 asks about features
   directly, and only the owner's answers there count.
5. Positioning: what value proposition should posts lead with, and in
   what priority order (most relevant if `modules.product` will be on,
   but useful for any blog with an opinion to push). Suggest only points
   the owner has already stated as facts about the product or the blog,
   never ones derived from a story in answer 4; when the product module
   will be on, say that the detailed product questions come later and
   keep this to the order of emphasis.
6. Additional forbidden phrases: any phrases, beyond the generic AI-tell
   list in `${CLAUDE_PLUGIN_ROOT}/standards/writing-standards.md`, this
   blog specifically wants banned
7. Additional allowlist domains: any extra reputable domains (beyond
   `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Authoritative-site
   allowlist) this blog wants permitted to cite even when they show up in
   the target keyword's top-10 SERP

Write `{profile_dir}/voice.md` — the section names below are exact; other
components grep for them by these literal headings:

```markdown
# Voice

## Tone

<answer 1>

## Credibility message

<answer 2>

## Lexicon

- <word/phrase 1>
- ...

## Personal-anecdote bank

- <anecdote 1>
- <anecdote 2>
- ...

## Positioning

<answer 5>

## Additional forbidden phrases

- <phrase 1>
- <phrase 2>
(or: "None beyond the generic list in writing-standards.md.")

## Additional allowlist domains

- <domain 1>
- <domain 2>
(or: "None beyond the generic allowlist in blog-craft.md.")
```

The two "Additional ..." headings must read EXACTLY `## Additional
forbidden phrases` and `## Additional allowlist domains` — the
`review-blog-post`, `humanize-text`, and `repurpose-blog-post` skills grep
for these literal section names.

### Interview: authors

1. How many authors/voices write for this blog? (1 = single voice; more
   than 1 = multiple named voices, plus optionally a co-signed "we" voice)
2. For each author: name, a short slug (lowercase, e.g. `alex`), a 1-2
   sentence bio, area of expertise, voice notes (how this author's tone
   differs from the blog's general voice — sentence-length habits,
   reading-level default, any jargon they're allowed to keep), byline
   format, sign-off pattern (for co-signed content). Offer the name the
   owner has already used in this interview (the credibility message, the
   niche answer) as the default. **Never use the Mac's git or GitHub
   identity** (`git config user.name`, the `gh` login's display name) as an
   example or default: it is often not the owner. With no name yet, ask
   plainly ("What name goes on your posts?") with no example.
3. If more than 1 author: ask when to use "we" (co-signed) vs. a specific
   author's voice — write this into a Selection rubric.

Write `{profile_dir}/authors.md`:

```markdown
# Authors

## <slug 1> — <Display Name>

**Bio:** <bio>
**Expertise:** <expertise>
**Voice notes:** <tone, sentence-length defaults, reading level, jargon rules>
**Byline:** <how this author's name appears in frontmatter/body>
**Sign-off:** <sign-off pattern, or "none, byline only" for single-voice posts>

## <slug 2> — <Display Name>

...
```

If more than one author, additionally append:

```markdown
## Co-signed voice (we)

<how the "we" voice differs from any single author's solo voice — typically
less personal, more newsroom-tone> Sign-off: <co-signed sign-off pattern,
e.g. "<Author 1> and <Author 2>, Co-founders of <blog name>">

## Selection rubric

<heuristics for choosing author_voice per post, e.g.:>

| Post shape | author_voice |
|---|---|
| Technical deep-dive | <slug> |
| Beginner-friendly how-to | <slug> |
| Product-wide announcement | we |

## Slug-to-site-key map

| author_voice slug | Site display key |
|---|---|
| <slug 1> | <Display Name> |
| <slug 2> | <Display Name> |
```

The `## Selection rubric` heading is exact — it's what the editor persona
and `templates/brief.md` point to as "select per `{profile_dir}/authors.md`
§Selection rubric." Only write it (and Co-signed voice, and the
slug-to-site-key map) when there's more than one author; a single-author
blog's `authors.md` is just the one `## <slug> — <Display Name>` block, no
rubric needed (matches personas/editor.md: "single-author blogs: skip this
step, `author_voice` is fixed").

## Phase 3: Modules

**Goal:** decide which optional pipeline modules are on, write the
`modules:` block in `config.yaml`, and (module-gated)
`{profile_dir}/product.md` and `{competitors_dir}/methodology.md`.

**Resume check:** read `modules:` from `config.yaml` if present, plus
`competitors.profile_dir` (if set, resolve `{competitors_dir}` from it
instead of the default) and `{profile_dir}/product.md` /
`{competitors_dir}/methodology.md` existence.

**Downgrade case.** If a resumed run flips `modules.product` or
`modules.competitors` from `true` to `false`, leave the corresponding doc
(`product.md` / `{competitors_dir}`) on disk — invariant 5 only requires the
doc to exist when the module is ON, it doesn't require the doc's absence
when the module is off, and nothing reads a module-gated doc while its
module is off. Tell the user it's still there in case they flip the
module back on later, and offer to delete it if they'd rather clean up;
only delete on an explicit yes.

### Interview: modules

Owner's name for this part: "Research sources, your product, your
competitors." **Reuse from another blog (Phase 0c):** offer that blog's
module settings, `product.md` and competitor files first as one menu
("Reuse all as is" / "Reuse and change some answers" / "Start fresh");
when a copied competitor profile is older than 14 days or will be soon,
say the date it stops being usable.

Ask one at a time, in plain language (no internal jargon — a blog owner
shouldn't need this doc open to answer):

1. "Should this blog's research stage search Reddit for the target
   keyword? You'd sign in to Reddit once, in Pilcrino's own browser
   window, a few questions from now." (`modules.reddit_research`)
2. "Should this blog's research stage also search X (Twitter)? It is
   noisier than Reddit and needs an X account you sign in with once."
   (`modules.x_research`)
3. "Does this blog promote its own product?" (`modules.product`). If yes,
   run the product interview below.
4. "Will posts reference or compare named competitors?"
   (`modules.competitors`). If yes, ask (4a) and seed the competitor
   methodology below.
4a. If (4) is yes: "Where should competitor profiles live: the default
    location inside this blog's own workspace (`blog-ops/profile/competitors`),
    or an existing directory this blog already shares with other
    tooling?" Default → write nothing (`competitors.profile_dir` stays
    unset, `{competitors_dir}` resolves to the default). Existing
    directory → ask for its repo-relative path and write
    `competitors.profile_dir: <path>` to `config.yaml`.
5. "Enable the repurpose skill (turns a published post into an X thread,
   an X short take, a LinkedIn post, and a newsletter)?"
   (`modules.repurpose`)

Merge into `config.yaml`:

```yaml
modules:
  reddit_research: <bool>
  x_research: <bool>
  product: <bool>
  competitors: <bool>
  repurpose: <bool>

competitors:
  profile_dir: <answer 4a>   # OPTIONAL; write this block only when
                             #   answer 4a is a non-default path; omit
                             #   the whole `competitors:` block otherwise
```

### If `modules.product` is on: product interview

1. Product name
2. What the product does, in 1-3 sentences
3. Core features: a list, each with a 1-line description (this becomes
   the feature list `templates/plan.md` draws its "feature emphasis" label
   from)
4. Differentiators: what's genuinely unique vs. alternatives
5. Unique-in-category differentiators specifically worth surfacing in a
   transactional comparison post (optional — skip if none stand out;
   when present, the editor persona checks every comparison-post outline
   surfaces these)
6. First-party data availability: what can this product's own usage data
   support citing in a post? For each claim, classify its availability:
   `derivable` (data is ready to cite now), `needs_scan` (the data exists
   but needs a query/audit before it's citable), or `hypothetical` (not
   yet verified — brainstorming only, writers must never cite this in a
   published post)
7. Positioning recommendations: where in a post the product should appear,
   and in what order relative to educational content. Ask this as a menu
   in plain words, with the product's name in each option and no jargon
   ("positioning", "CTA", "transactional"):
   - "Teach first; name <product> once, in a side note near the end"
   - "Teach first; name <product> where it fits, at most once or twice,
     and give it a fair row in every comparison table, never ranked first
     by default"
   - "Mention <product> wherever it fits, including the opening"
   - "Something else" (free text)
   Then read the chosen rule back in one sentence ("So: posts teach first,
   mention <product> at most twice, and in comparisons it gets a fair row
   without being ranked first.") and write that sentence into
   `product.md` §Positioning recommendations. The post workflow shows this
   rule at every intake, so it must read well on its own.
8. Existing posts: title + URL + which feature each covers (skip / write
   "none yet" for a blog with no posts yet)
9. Pricing page: "Does <product> have a public pricing page? Give me its
   address, or reply `none`." **No invented default**: never assume one
   exists or that none does, never propose a URL. Posts never state
   specific prices; they link to this page instead, per
   `${CLAUDE_PLUGIN_ROOT}/standards/blog-craft.md` §Own-product pricing
   claims. With `none`, write "No public pricing page yet. Posts never
   state a price; they point to <Primary CTA target from blog.md>
   instead." Record the answer in the same section.

Write `{profile_dir}/product.md`:

```markdown
# Product

## Identity

<answer 1> — <answer 2>

## Features

- **<feature>:** <description>
- ...

## Differentiators

- <differentiator 1>
- ...

## Unique-in-category differentiators (for use in transactional comparison posts)

- <differentiator 1>
(omit this whole section if answer 5 was empty)

## First-party data availability

| Claim | Availability | Context |
|---|---|---|
| <claim> | derivable \| needs_scan \| hypothetical | <one sentence> |

## Positioning recommendations

<the rule read back in answer 7, one sentence, then any detail the owner added>

## Existing posts

| Title | URL | Feature covered |
|---|---|---|
| <title> | <url> | <feature> |
(or: "None yet. This is a new blog.")

## Pricing page

<answer 9: the URL, or "No public pricing page yet. Posts never state a price; they point to <CTA target> instead.">
```

**Features and differentiators come from the owner only.** Every line under
Features, Differentiators and Unique-in-category is something the owner
stated about the product in this interview. A capability implied by a
story in `voice.md`'s anecdote bank, a guess from the product's category
("time trackers usually sync"), or an "obvious" benefit is never written
here; when such a candidate comes up, ask "Does <product> actually do
<X>?" and write it only on a yes. Before writing the file, read the
feature list back in full and ask for corrections.

### If `modules.competitors` is on: the competitor list, then methodology.md

Explain to the owner, in plain language, before anything else: "Before a
post can name a competitor, Pilcrino needs a fact sheet on them (their
pricing, features and how they describe themselves) that is no more than
14 days old, so that comparisons are checked facts rather than memory.
Pilcrino researches those fact sheets itself, in its own browser; each
takes about two and a half minutes."

**Ask which competitors the owner knows (one question):** "Which
competitors should posts be able to name? Give me their names, and their
website addresses if you know them. Reply `none` if you'd rather decide
post by post." For each name, note the name and, when given, the site; a
missing site is found by the research skill later, not guessed now. Read
the list back.

**Then offer to profile them, as a menu with two timings:**
- "Research them now, right after the browser sign-in step (about 2.5
  minutes each, <N> competitors, roughly <N × 2.5> minutes)."
- "Research each one the first time a post names it; Pilcrino offers it
  then."
Record the choice. On "now", Phase 3.5 ends by running
`${CLAUDE_PLUGIN_ROOT}/skills/research-competitor/SKILL.md` in this
session once per competitor, in the order given, after the sign-in check
passes (that skill needs the Pilcrino browser signed in to Google). The
profiles land in `{competitors_dir}/` and are committed with the rest of
the setup files in Phase 6, so they reach the base branch where the post
workflow reads them. On "at the first post", nothing more happens now; the
post workflow's intake offers it.

No further interview: the methodology doc is a fixed contract, not
per-blog content, plus the index of competitors below. If
`{competitors_dir}/methodology.md` already exists (the external-dir case
from question 4a, an existing corpus shared with non-blog tooling), leave
its text as-is and only add the missing rows to its "Competitors currently
profiled" table (apply Global rule 3 to anything beyond that) instead of
silently overwriting a corpus this blog doesn't own alone. Otherwise,
create the directory and write `{competitors_dir}/methodology.md`:

```markdown
# Competitor profile methodology

Every competitor this blog mentions by name needs a synthesized profile at
`{competitors_dir}/<slug>.md`. `blog-post-workflow` validates a
named competitor has a matching profile at intake (Stage 0) and re-checks
its freshness defensively at Stage 1.5c before research analysis runs.

## The 14-day freshness contract

Every profile carries a `**Last verified:**` date. A profile older than 14
days is stale: the workflow hard-halts and asks a human to refresh it
before the post can proceed. To refresh a profile, re-visit the
competitor's own pricing/features pages, update every section below with
current information, and set `**Last verified:**` to today's date.

## Competitors currently profiled

One row per competitor this blog may name. `research-competitor` adds or
updates a row when it writes a profile; a row with "not profiled yet" is a
competitor the owner named at setup whose profile does not exist yet.

| Competitor | Slug | Site | Last verified | Status |
|---|---|---|---|---|
| <name from the owner> | <slug> | <site or "unknown"> | | not profiled yet |
(or a single line: "None named yet.")

## Profile shape

Create each profile at `{competitors_dir}/<slug>.md` following this
exact shape (the H1, `**Slug:**` line, and `**Last verified:**` line are
load-bearing — the workflow matches a named competitor against the H1 or
the slug line, and reads the verified date, from just the first ~10 lines). The Site line is what the console's Refresh reads.

```markdown
# <Competitor Name>

**Slug:** <slug>
**Site:** <https://competitor.example/>
**Last verified:** <YYYY-MM-DD>

## TL;DR

<one-paragraph summary: what this competitor is, who it's for>

## Audience/positioning

<who this competitor targets, how they position themselves>

## Pricing

| Tier name | Monthly price | Annual price | Limits / quotas | Key features bundled |
|---|---|---|---|---|
| <tier> | <$X/mo> | <$Y/yr> | <limits> | <features> |

**Free tier?** <yes/no, terms>
**Trial?** <yes/no, length>

## Features

### Core

- <feature 1>

### Differentiators they actively market

- <differentiator 1, in the competitor's own framing/wording>

### Notable absences

- <something they don't offer that's worth knowing>

## Integrations and platforms

- <integration 1>

## Self-reported metrics

- <metric, with source>

## Recent product direction signals

- <signal, e.g. a changelog entry, a roadmap post>

## Headline value prop

"<verbatim quote from their marketing copy>"
```

If `modules.product` is also on, append an "Overlap with our product"
section per profile, capability-by-capability, facts only, no editorializing
("better"/"worse").
```

Note that the template block above is embedded verbatim inside
`methodology.md` (per `personas/editor.md`'s pointer: "Add a profile per
`{competitors_dir}/methodology.md` (template at the bottom of that
file)") — write it as shown, a nested fenced block is fine in the final
file. **This is the one sanctioned exception to Global rule 6** ("no
leftover `<...>` placeholders"): the angle-bracket tokens inside this
nested block are a template FOR future profiles, not unfilled content of
`methodology.md` itself. Phase 6's "no leftover placeholders" check
excludes this nested block explicitly (see that section).

## Phase 3.5: Sign in to the Pilcrino browser

Pilcrino researches in its own Chrome window, the Pilcrino browser. Google and Reddit block a browser that has never signed in, so this one-time step opens the window and checks each site when you say you are done. Owner's name for this part: "Signing in to Pilcrino's browser."

**Always check first, then skip what is signed in.** Call `mcp__plugin_pilcrino_pilcrino-browser__login_status` with the needed sites before anything else, on every run (an earlier setup on this Mac, or a resumed one, has often done this already). Every site `signed_in`: say "Pilcrino's browser is already signed in to <sites>; nothing to do here", record it (step 6) and move to Phase 4. Otherwise continue with only the sites that are not `signed_in`.

If that first call fails because the browser tool is unavailable and Node.js was installed during this session (Phase 0a check 2), this is the one restart: "Pilcrino's browser needs a fresh start of Claude Code now that Node.js is installed. Type `/exit`, then in Terminal: `cd <blog folder>` and `claude`, then `/pilcrino:blog-setup`. Everything so far is saved; setup will offer to keep each part and come straight here." Stop and wait. If Chrome itself is missing (Phase 0a check 5), say so again with the download address and offer to skip this step; research will park later until it is done.

1. Sites needed: `google` always; `reddit` when `modules.reddit_research`; `x` when `modules.x_research`; `linkedin` when `social.linkedin` is configured.
2. Call `mcp__plugin_pilcrino_pilcrino-browser__open_login` with the sites that are not signed in. It quits the Pilcrino browser and opens the sign-in pages in a Chrome window on the Pilcrino profile without remote control (Google refuses to sign in a browser under remote control). Tell the owner, in this order and in these words or close to them:
   "A second Chrome has just opened: that is Pilcrino's own copy of Chrome, separate from the Chrome you normally use. It has one tab per site: <sites>. You can tell it apart because it has only those tabs and no bookmarks or history of yours; it may sit behind your other windows. Sign in to each tab with your own accounts (Reddit and Google sometimes show a 'verify you are human' check first; that is normal, pass it). Then tell me you are done and I'll close that window for you so the sign-ins are kept. Don't close it yourself: closing it the usual way can quit the wrong Chrome."
   Then wait for the owner's reply. Do not poll and do not sleep.
3. When the owner says done, call `mcp__plugin_pilcrino_pilcrino-browser__close_login` (no arguments). It quits the sign-in Chrome gracefully so the sign-ins persist and returns `{ "closed": true|false, "detail": "<one line>" }`. On `closed: true`, go on to the check. On `closed: false`, read `detail`; tell the owner in plain words what it says and, as the fallback only, how to quit it by hand: "Click once inside Pilcrino's Chrome window (the one with only the <sites> tabs), then press Cmd+Q. That quits only that copy of Chrome; your own Chrome keeps running. Closing the window with the red button is not enough. Tell me when it is gone." Then call `close_login` once more on the reply before checking.
   Then call `mcp__plugin_pilcrino_pilcrino-browser__login_status` once with the same sites and report each site's state in one line per site. It restarts the Pilcrino browser with remote control. If it fails with `signin_window_open`, the sign-in window is still running: run `close_login` again and, if it still reports `closed: false`, give the Cmd+Q fallback above and check again on the reply.
4. A site still `signed_out`: ask "Sign in to <site> and tell me when you are done, or skip <site> for now?" On "done", repeat from step 2 for that site only (the sign-in window must be reopened: `login_status` restarted the browser under remote control). Skipping is allowed; research for that source parks later with a card until the owner signs in, and setup says so in one sentence.
5. `blocked`: "<site> is showing a 'verify you are human' or unusual-traffic check in Pilcrino's Chrome window. That is the site being careful with a browser it has not seen before. Open that window, pass the check, then tell me and I'll look again." `error`: "The Pilcrino browser could not reach <site>. Check the connection and tell me when to check again." Offer a check again or a skip.
6. Record the outcome in `blog-ops/profile/setup-notes.md` as "Pilcrino browser: signed in to <sites> on <date>" (and "skipped <sites>" when any were).
7. If Phase 3 recorded "research the competitors now", run `${CLAUDE_PLUGIN_ROOT}/skills/research-competitor/SKILL.md` once per named competitor here, in this session, after saying "Now the competitor fact sheets: <names>, about 2.5 minutes each." Each run writes `{competitors_dir}/<slug>.md` and its row in `methodology.md`'s index; report each in one line when done. They are committed in Phase 6 with everything else, never pushed separately here.

```
mcp__plugin_pilcrino_pilcrino-browser__login_status  { "sites": ["google", "reddit"] }   -> { "google": "signed_in", "reddit": "signed_out" }
mcp__plugin_pilcrino_pilcrino-browser__open_login    { "sites": ["reddit"] }
mcp__plugin_pilcrino_pilcrino-browser__close_login   {}                                  -> { "closed": true, "detail": "..." }
```

## Phase 4: Images

**Goal:** decide which image strategies this blog uses, write the
`images:` block in `config.yaml` and `{profile_dir}/image-style.md`, and
(if `remotion` is enabled) scaffold + personalize the Remotion project.

**Resume check:** `images:` in `config.yaml`, `{profile_dir}/image-style.md`,
and (if remotion was previously enabled) `images.remotion.project_dir`.
**Reuse from another blog (Phase 0c):** offer that blog's image choices and
style as one menu ("Reuse as is" / "Reuse and change some answers" /
"Start fresh"); "reuse as is" still scaffolds a fresh Remotion project in
this repository and test-renders it.

Owner's name for this part: "Images." Ask in the owner's words, as the
examples below do: "diagram images drawn by code", "AI-generated
pictures", "screenshots you take"; never "strategy", "adapter", "slot",
"archetype" or a hex code unless the owner asks for one.

### Interview: images: block

1. "Which kinds of images should posts have? Any of: diagrams and cover
   images drawn by code (Remotion; needs Node.js, which this Mac has),
   AI-generated pictures (needs the `codex` command signed in to ChatGPT;
   <installed / not installed on this Mac>), screenshots you take yourself
   when a post needs one." Ask it as a multi-select menu. → `images.enabled`
   (`remotion`, `ai-prompt`, `screenshot`), must be non-empty (invariant 1).
2. "Which of those should be the default for a post's featured image?" —
   if only one strategy was enabled, skip this question and set
   `images.featured_default` to it. If more than one, offer "let the
   planner pick per-post" as a valid answer (in which case OMIT
   `images.featured_default` from config entirely, per config-schema.md's
   comment: "Omitted → planner picks from enabled").
   **Validate immediately** (Global rule, enforced at entry): if the
   user's answer is not a member of `images.enabled` from question 1,
   reject it and re-ask; don't defer this check to Phase 6.
3. If `remotion` ∈ enabled: "Where should the Remotion project live in
   this repo?" (default `tools/remotion`) → `images.remotion.project_dir`.

Merge into `config.yaml`:

```yaml
images:
  enabled: [<list>]
  featured_default: <value>   # omit key entirely if the planner should pick
  remotion:                    # omit whole block if remotion not enabled
    project_dir: <path>
```

### Interview: image-style.md

**Check for Phase 1.5 evidence first.** If `blog-ops/reference/site-research.md`
exists, use its extracted palette hexes (§(b)) and image characterization
(§(d)) as the DEFAULTS offered below instead of the scaffold's generic
defaults — still ask every question, still let the user override any
subset; the evidence just changes the starting point, it never gets
silently accepted.

1. Palette: 8 hex colors — `background`, `surface`, `border`, `text`,
   `muted`, `primary`, `accent`, `warn`. Offer the scaffold's defaults
   (`#FAFAFA`, `#FFFFFF`, `#E5E7EB`, `#1F2937`, `#6B7280`, `#2563EB`,
   `#0E9F8E`, `#E11D48`) as the starting point — or, if Phase 1.5 extracted
   hexes from the live site's CSS, or the site's stylesheet in the repo
   declares colours, offer those instead; let the user override any subset
   either way. Ask it in colour words, not codes: "Images use a light
   off-white background, dark grey text, a blue main colour and a teal
   highlight (that is the standard set / that is what your site's
   stylesheet uses). Keep these, or tell me your brand colours?" Show the
   codes only when asked or when the owner gives their own.
2. Fonts: sans-serif stack and monospace stack. Defaults:
   `Inter, ui-sans-serif, sans-serif` and `ui-monospace, monospace`, or
   the site's own fonts when the repo or Phase 1.5 names them. Say now,
   once, that a webfont the site loads from its own files is usually not
   installed on this Mac, so the test image will show a standard system
   font in its place; that is expected and the posts' own pages are not
   affected.
3. Mood words: 3-5 adjectives describing the visual mood (e.g. "clean,
   confident, technical") — pre-fill from Phase 1.5's image-set
   characterization if it ran.
4. Watermark text (default: the blog's domain, e.g. `trailnotes.example`)
   and opacity (default `0.55`)
5. Annotation conventions for screenshot markup: accent color (default:
   reuse the `accent` palette token), stroke width (default `3px`),
   corner radius (default `6px`)
6. Aspect-ratio default for `ai-prompt` images (default `3:2`,
   matching the Remotion canvas so a mixed featured/in-post set stays
   visually consistent)
7. Featured-image variation archetypes (to the owner: "cover image
   layouts"): offer the default list below (mirrors the built-in list in
   `${CLAUDE_PLUGIN_ROOT}/skills/suggest-images/SKILL.md` §Featured-slot
   archetype) and let the user drop, rename, or add layouts. Explain the
   mechanism in one line: "Pilcrino rotates these layouts so covers stay
   on-brand but don't all look the same" (the image-planner never repeats
   the archetype of the previous 2 posts, tracked in
   `{ops_dir}/featured-log/`, one entry file per post). Defaults, each with
   a three-word description for the owner: `object-metaphor` (one object
   standing for the idea), `split-contrast` (before and after, side by
   side), `diagram-lite` (a tiny diagram), `big-number` (one large figure),
   `pattern-break` (a pattern with one odd element), `scene-vignette` (a
   small scene), `negative-space` (mostly empty, one element). Keep at
   least 4 (fewer starves the rotation). Default answer: keep all seven.

Write `{profile_dir}/image-style.md`:

```markdown
# Image style

## Palette

| Token | Hex |
|---|---|
| background | <hex> |
| surface | <hex> |
| border | <hex> |
| text | <hex> |
| muted | <hex> |
| primary | <hex> |
| accent | <hex> |
| warn | <hex> |

## Fonts

**Sans:** <font stack>
**Mono:** <font stack>

## Mood

<mood words>

## Watermark

**Text:** <watermark text>
**Opacity:** <opacity>

## Annotation conventions

**Accent color:** <hex, or "palette.accent">
**Stroke width:** <e.g. 3px>
**Corner radius:** <e.g. 6px>

## Aspect ratio defaults

<e.g. "3:2 for featured and most in-post images; adjust per-slot when a chart genuinely needs a different ratio.">

## Featured-image variation

Composition archetypes for featured images. The image-planner rotates these
across posts (never repeating the archetype used in the previous 2 posts,
tracked in `{ops_dir}/featured-log/`). Palette, fonts, watermark, and the
title band never vary; only the composition does.

- <archetype-slug>: <one-line description>
- <archetype-slug>: <one-line description>
<...one line per archetype the user kept in the interview...>
```

### If `remotion` is enabled: scaffold + personalize + test-render

1. Resolve `REMOTION_DIR` = `images.remotion.project_dir` from the answer
   above.
2. If `REMOTION_DIR` already has a `package.json` (resume case): summarize
   what's there, ask keep/reinstall per Global rule 3. Otherwise:
   ```bash
   mkdir -p "$(dirname "<REMOTION_DIR>")"
   cp -R "${CLAUDE_PLUGIN_ROOT}/scaffold/remotion-starter/" "<REMOTION_DIR>"
   ```
3. **Rewrite ONLY `<REMOTION_DIR>/src/theme.ts`** from the `image-style.md`
   values gathered above. Keep `CANVAS`, `TITLE_TOP`, and `SAFE_MARGIN`
   exactly as the scaffold defines them (`{ width: 1800, height: 1200 }`,
   `110`, `120`) — those are canvas/layout constants, not personalization
   inputs, and this wizard never touches them. Rewrite `palette`, `fonts`,
   and `watermark` to the interview answers:
   ```ts
   export const palette = {
     background: "<hex>", surface: "<hex>", border: "<hex>",
     text: "<hex>", muted: "<hex>",
     primary: "<hex>", accent: "<hex>", warn: "<hex>",
   };
   export const fonts = { sans: "<stack>", mono: "<stack>" };
   export const watermark = { text: "<text>", opacity: <opacity> };
   ```
   Never touch any other file in the project (`Root.tsx`, `BlogWatermark.tsx`,
   `SampleDiagram.tsx`, `package.json`, etc.) — the theme-token indirection
   is exactly what lets this rewrite be safe.
4. **Union-merge the composition registry.** `<REMOTION_DIR>/src/Root.tsx` is
   append-only: every post registers one uniquely-named composition in it, so
   two concurrent post branches only ever both add distinct lines. Without a
   `merge=union` attribute git calls that a conflict, and the console's
   auto-resolver (`console/src/merge-resolve.ts` `resolveConflictOnBranch`)
   CANNOT settle it: that function activates the driver by copying the BASE
   branch's `.gitattributes`, so a repo without one has no driver, and every
   such PR parks for a human. Ensure the repo-root `.gitattributes` carries the
   line, creating the file when absent and appending when it exists (never
   rewriting rules already there):
   ```bash
   ATTR="<REMOTION_DIR>/src/Root.tsx merge=union"
   grep -qxF "$ATTR" .gitattributes 2>/dev/null || printf '%s\n' "$ATTR" >> .gitattributes
   ```
   `<REMOTION_DIR>` here is the path RELATIVE to the repo root, matching how
   `.gitattributes` patterns are resolved. Commit the file with the rest of the
   scaffold.

   **Scope it to generated registries only.** Never add a prose path (anything
   under `{content_dir}`) to this file: union-merging two edits to the same
   paragraph keeps both sides and silently publishes a mangled sentence.
5. `npm install`, from inside `REMOTION_DIR`. Make sure the repo-root
   `.gitignore` lists `<REMOTION_DIR>/node_modules/` and
   `<REMOTION_DIR>/out/` (append the two lines when missing), so the
   installed packages and test renders never reach the commit.
6. Test-render the sample composition:
   ```bash
   cd "<REMOTION_DIR>" && npx remotion still SampleDiagram --output=out/preview-sample-v1.png
   ```
7. `Read` the rendered PNG yourself, then **open it for the owner before
   asking anything**: `open "<REMOTION_DIR>/out/preview-sample-v1.png"`
   (macOS opens it in Preview). Then ask, giving the path too: "I've opened
   the test image on your screen (it is also at
   `<REMOTION_DIR>/out/preview-sample-v1.png`). It uses your colours and
   watermark. <If a webfont is not installed: 'The text is in a standard
   system font because <font> is not installed on this Mac; that is
   expected and does not affect your posts.'> Does it look right, or should
   a colour change?" Never recommend "looks right" on the owner's behalf.
   If not right, go back to the image-style.md interview, adjust, rewrite
   `theme.ts`, re-render and open it again. The test render is not
   committed (`out/` is ignored, step 5).

### If `ai-prompt` is enabled: check codex + offer a test generation

1. Check the codex CLI is available: `command -v codex && echo found || echo missing`.
2. If missing: tell the user `ai-prompt` slots need the `codex` CLI on PATH
   with a working codex/ChatGPT login, and that this is fine to fix later —
   a missing codex degrades cleanly at run time (the slot is recorded
   `failed` and its `Prompt:` block stays a pasteable manual fallback; it
   never breaks the pipeline). Warn, don't block the wizard, and don't add
   a config invariant for it.
3. If found: offer "Want me to fire one test generation to confirm codex
   imagegen works?" If yes, run `${CLAUDE_PLUGIN_ROOT}/skills/generate-image-codex/SKILL.md`
   with a minimal throwaway prompt (e.g. "a simple flat-vector test image,
   a single blue circle on a white background, no text") and an explicit
   output path (its optional caller input) under a temp dir
   (`$(mktemp -d)/codex-test.png`) — the explicit path bypasses all
   `{assets_dir}` resolution, so no blog asset folder is touched. `Read`
   the result, `open` it so the owner sees it, give the path, then remove
   the temp dir after the owner has answered.

## Phase 5: Publishing

**Goal:** pick and configure the publish adapter, write the `publish:` and
`git:` blocks, verify adapter auth, and check the GitHub precondition.

**Resume check:** `publish:` and `git:` in `config.yaml`. If present, apply
Global rule 3 — but the "short summary" that rule calls for must surface
two things a bare "`publish:`/`git:` present" check would hide, so "keep
as-is" is an informed choice rather than a guess:

- **The last WP auth probe's outcome, if one was recorded.** The auth-probe
  step below leaves a crash-note in `blog-ops/reference/site-research.md`
  precisely so a later resumed run can report this (see that step's own
  note, a few paragraphs down). No recorded outcome (non-`wordpress-rest`
  adapter, or no probe has run yet this workspace) → omit this line.
- **Whether `{profile_dir}/site-conventions.md` exists, when it's
  REQUIRED.** Per config-schema.md, that file is required when
  `publish.adapter: wordpress-rest` AND `{profile_dir}/blog.md` records
  `existing_blog: true` (the durable flag Phase 1.5's Offer step wrote —
  read THAT, not whether `blog-ops/reference/site-research.md` exists: an
  existing blog that declined Phase 1.5's research offer has
  `existing_blog: true` with no `site-research.md` ever written, and still
  owes this file); recommended otherwise. Check both conditions and report
  a mismatch explicitly rather than staying silent.

Phrase it like: "publish config exists (auth probe: FAILED on last run;
site-conventions.md: MISSING — required for this adapter): keep as-is /
update / start over."

**Even on "keep as-is":** Global rule 3's "keep as-is → skip straight to the
next phase, no writes" applies only to the interview questions above — it
never skips a pending REQUIRED sub-flow. If `{profile_dir}/site-conventions.md`
is missing and required per the check above, the auth probe (if it hasn't
yet recorded `auth OK`) and the "Site conventions" sub-flow below still run
this pass, even when the user picks "keep as-is" for the `publish:`/`git:`
interview itself. Only once `site-conventions.md` exists (or the check
above finds it genuinely isn't required) does "keep as-is" mean "nothing
left to do in Phase 5."

Owner's name for this part: "Where your posts go." The word "adapter" is
never said to the owner; the three adapters are described by what happens
to a post.

### Interview: how the site goes live (every adapter)

Ask this first, before the adapter, as a menu: "Is your blog online now,
and does it update itself when the GitHub repository changes (hosts such as
Netlify, Vercel, Cloudflare Pages and GitHub Pages do that)?"

- "Yes, it is online and rebuilds from GitHub" → `publish.site_live: true`.
- "No, it is not online yet" → `publish.site_live: false`.
- "I don't know" → `publish.site_live: false`; say: "I'll treat it as not
  live for now. Once it is, run this setup again and change the answer."

For a WordPress or a hosted CMS (Webflow, Ghost(Pro)) blog the rebuild part
does not apply: ask only "Is the site online now?" and write the answer.
Say what the value changes, in one sentence that fits how posts reach this
site (the adapter is confirmed next; use the detected one, and say the
sentence again if the owner picks another):
- Astro, or a markdown site the repository builds (Hugo, Next.js,
  Eleventy): live → "When you merge a post's pull
  request, your site rebuilds and publishes it"; not live → "Merging files
  the post in the repository; nothing is published until the site is
  online."
- WordPress: "Approving a post leaves it as a draft in your WordPress;
  you click Publish in WordPress. Merging the pull request only files the
  text in the repository." (The same sentence, live or not.)
- A platform you paste into (Jekyll, Webflow, Ghost, Squarespace, another
  hosted CMS): "You paste each post into <Platform> before you approve it; merging
  the pull request only files it in the repository." (The same sentence,
  live or not.)
Never tell a WordPress or paste-platform owner that merging publishes.
Then, when the site is built by Hugo, Astro, Jekyll or another generator,
add: "Pilcrino does not need to build your site on this Mac, so <Hugo/Astro> does not
need to be installed here" (do not report a missing `hugo` binary as a
problem).

### Interview: adapter choice

1. Detect first, then confirm. Read the repo root (and `site_dir` when a
   subfolder holds the site): `astro.config.*` or an `astro` dependency in
   `package.json` → `astro-git-pr`; `hugo.toml`/`config.toml` with Hugo
   keys, `_config.yml` (Jekyll), a `next` dependency, `.eleventy.js` →
   `markdown` with that platform; a WordPress address from Phase 1
   (`/wp-json` answers) or the owner said WordPress → `wordpress-rest`;
   Webflow, Squarespace, Ghost or another hosted CMS → `markdown` with
   `generic` (or `ghost`). Then confirm as a menu with the detected choice
   first, each option in owner words:
   - Astro: "Your site runs on Astro, so each post lands in it as a file
     through a GitHub pull request; merging publishes it (when the site is
     live)."
   - WordPress: "Posts are uploaded to your WordPress site as drafts for
     you to publish, and the text is also kept in this repository."
   - Markdown, repo platform: "Your site runs on <Hugo/...>, so each post
     lands in this repository as a file through a pull request; merging
     publishes it when the site rebuilds from GitHub."
   - Markdown, paste platform: "Each post becomes text plus images that you
     paste into <Platform> before you approve it; the repository keeps a
     copy."
   → `publish.adapter`.

### If `astro-git-pr`

2. "Is this repo the Astro site itself, or does the site live in a
   subdirectory (a monorepo)?" Read it, don't ask: `astro.config.*` at the
   repo root → root, omit `publish.astro.site_dir`; found in a
   subdirectory → that path (the directory holding `package.json` and
   `astro.config.mjs`) → `publish.astro.site_dir`; state it in one line.
   Every other path key stays repo-relative.
2a. **Page style and trailing slash (read, don't ask).** Read the Astro
   config in `<site_dir>` (default the repo root): `astro.config.mjs`,
   `.ts` or `.cjs`. Find `build.format` and `trailingSlash`, and state what
   you found in one line. Astro builds each page either as a folder
   (`<route>/index.html`, the default `build.format: 'directory'`) or as a
   single file (`<route>.html`, `build.format: 'file'`). The console's
   verification handles both, so nothing is written for the style itself.
   It decides `blog.trailing_slash`:
   - `trailingSlash: 'never'`, or `build.format: 'file'` with
     `trailingSlash` unset → `false`
   - `trailingSlash: 'always'`, or `build.format` unset or `'directory'`
     with `trailingSlash` unset → `true` (hosts serve a folder-style page
     at its slashed URL)
   - `trailingSlash: 'ignore'` → the config does not settle it; keep the
     value on file.
   If the derived value differs from `blog.trailing_slash` in
   `config.yaml`, show both values and the Astro config line, and write the
   derived one once the user confirms (rewrite the whole file, Global rule
   4). If they already agree, record nothing new and move on.
3. `content_dir` (default `src/content/blog`; read where the blog
   collection's entries live, `src/content/<name>/`, and offer that). To
   the owner: "Posts go in the folder `<path>`, where your existing posts
   are. Reply `default` or give another folder."
4. `assets_dir` (default `src/assets/blog`). To the owner: "Images go in
   `<path>`."
5. Frontmatter template: read the content collection schema before asking
   anything. Find it in `src/content.config.ts` or `src/content/config.ts`
   (the `defineCollection({ schema: z.object({...}) })` for the blog
   collection) and list its top-level keys.
   - Keys `pubDate` and `heroImage` (the official Astro blog template, and
     most plain content-collection sites) →
     `adapters/publish/frontmatter/astro-content.md` (the FAQ schema is
     the site layout's job; this template leaves a marker comment for it).
   - Keys `date`, `excerpt`, `cover` and a `head` array (a Starlight-style
     site) → `adapters/publish/frontmatter/astro-starlight.md` (supports a
     `head[]` JSON-LD FAQ schema injection).
   - Neither shape: ask once, as a menu ("Starlight" / "plain content
     collections"), with what you read as context.
   → `publish.astro.frontmatter_template`.
5a. **Accepted keys → `publish.astro.frontmatter_keys`.** From the same
   schema, write the list of keys the chosen template defines that the
   schema accepts, always including the template's required keys (`title`,
   the description key, the date key, the cover key; config-schema.md
   §Fitting the site's frontmatter) and never the draft key (`draft`: step
   6 decides it, and the list never holds it). Example: the official
   template's schema is `title, description, pubDate, updatedDate,
   heroImage` → `frontmatter_keys: [title, description, pubDate,
   heroImage]`. The template's field names and types are fixed; compare
   each against the schema:

   | Template | Cover | Tags | Byline |
   |---|---|---|---|
   | `astro-content.md` | `heroImage`, one path | `tags`, a list of strings | `author`, one string |
   | `astro-starlight.md` | `cover`, a group with `image` and `alt` | `tags`, a list of strings | `authors`, a list of strings |

   **The cover field, when the schema lacks it.** The template always
   writes a cover, and a site whose schema has no field for it drops it
   (or fails the build), so this is settled before anything is written.
   Say: "Your site's post format has no place for a cover image, so every
   post's cover would be thrown away. I can add one optional field for it
   to the site's post format in the setup commit. Add it?" Add → edit the
   schema file, adding only that field, matching the file's style, and show
   the lines you added:
   - `astro-content.md`: `heroImage: image().optional()`. The `image()`
     helper needs the function form of the schema: when the file has
     `schema: z.object({...})`, change it to `schema: ({ image }) =>
     z.object({...})`; when it already takes a parameter object, add
     `image` to it.
   - `astro-starlight.md`: `cover: z.object({ image: image(), alt:
     z.string().optional() }).optional()`, in the same function form; on a
     Starlight site whose schema is `docsSchema({ extend: ... })`, it goes
     inside the `extend` object, as Starlight's docs on extending the
     schema show (`extend: ({ image }) => z.object({...})`).
   Leave out → do not write this template choice. Say: "Without that
   field your site would drop every post's cover, so I can't set up posts
   this way. You can pick the other post format, if your site has a place
   for its cover, or stop here and come back after a change to the site;
   your answers so far are saved." Then ask the step 5 menu again, or stop
   Phase 5. Never write a `frontmatter_keys` list holding a key the schema
   would drop.

   **Tags and byline.** For each of the template's tags and byline fields
   (the table above) that the schema lacks, say so in plain words and ask
   once, naming only what is missing: "Your site's post format has no
   place for <tags / the author's name / either>, so the site would drop
   them. I can add <it / them> as optional fields to the site's post
   format in the setup commit, or leave them out of posts. Which do you
   prefer?" Add → edit the schema file, adding only the missing fields,
   with the selected template's names and types, inside the collection's
   `z.object({...})` and matching the file's style; never add a field the
   schema already has, and show the lines you added:
   - `astro-content.md`: `tags: z.array(z.string()).optional()`,
     `author: z.string().optional()`.
   - `astro-starlight.md`: `tags: z.array(z.string()).optional()`,
     `authors: z.array(z.string()).optional()`.
   Then include those keys in the list. Leave out → the list omits them. A
   field the schema has under the template's name but with another type
   (for example `author` as a list where the template writes one string):
   leave the schema alone, leave the key out of the list, and say why in
   one sentence.

   **Check every schema edit.** After any edit in this step or step 6,
   read the schema file again and confirm that every key in the list is a
   field there with the type the template writes (the table above), and
   that no field appears twice. Then, only when the site's packages are
   already installed (`<site_dir>/node_modules` exists; never install
   them for this), run a check from `<site_dir>`: `npx --no-install astro
   check` when `node_modules/@astrojs/check` exists, else `npm run build`
   (a long timeout; leave the build output alone, it is not staged). A
   failure that names the schema file: fix your edit and run the check
   once more; any other failure: say in one line that the site's own check
   failed for a reason outside setup's change. No packages installed: say
   "The first post's pull request preview is the check that your site
   accepts the new fields." Record each edited schema file under Global
   rule 9.
   When the schema accepts every key of the template, still write the
   full list.
6. **Draft switch → `publish.astro.draft_mechanism`.** Check two things:
   `draft` in the schema, and a filter on it where the site lists posts
   (`grep -rn "draft" src/pages src/components src/layouts`: a
   `.filter(... !post.data.draft ...)` or equivalent on the blog index, the
   post route and the RSS page). Both present → `"draft: true"` and say
   "Your site has a draft switch; Pilcrino keeps each post marked as a
   draft until you approve it." Either missing → say what it means, in
   plain words: "Your site has no draft switch: anything merged into the
   repository is built and shown<, and your site is live>. Pilcrino
   normally marks a post as a draft until you approve it, so it can never
   go live by accident. I can add that switch to the site in the setup
   commit: one line in the post format and a filter on the pages that list
   posts (the blog index, the post pages and the RSS feed). Or leave it
   out, in which case a merged post is live at once. Add it?" Add → edit
   the schema (`draft: z.boolean().optional()`) and add
   `.filter((post) => !post.data.draft)` to each `getCollection(...)` call
   on those pages (keep the file's style; show every changed line; record
   each file under Global rule 9; step 5a's check covers it), then
   `"draft: true"`. Leave out → `draft_mechanism: none`, and say once more:
   "Noted: a merged post is live at once." Never write `"draft: true"` for
   a site that would build the post anyway.
7. "Does this site keep a list of authors in a file, so the name on a
   post maps to a photo and bio? If so, which file?" Check first for an
   authors map in `astro.config.mjs` or `src/content/authors/`; offer what
   you found, default no. If yes → repo-relative path →
   `publish.astro.authors_map_check`. If no, omit the key.
8. "When a pull request is opened on your repository, does something post
   a comment with a preview link (Netlify, Vercel and Cloudflare do this
   when connected)? If so, paste the first line of one such comment."
   Default no. The HTML comment marker it upserts (e.g.
   `<!-- blog-preview -->`) → `publish.astro.preview_comment_marker`; if
   none, omit the key.

Verify the directories exist on disk:
```bash
[ -d "<content_dir>" ] && [ -d "<assets_dir>" ] && echo "both exist" || echo "missing"
```
- If missing and this doesn't otherwise look like an Astro project
  (no `astro.config.mjs` / no `package.json` with an `astro` dependency in
  `<site_dir>`, defaulting to the repo root), tell the user this needs an
  Astro site scaffolded first (e.g. `npm create astro@latest`), and pause
  Phase 5 until they confirm it's ready; don't fabricate directories into a
  non-Astro repo.
- If missing but this IS an Astro project (just these specific
  directories aren't created yet), offer to `mkdir -p` them.

### If `wordpress-rest`

2. `content_dir` — where the canonical finalized markdown lives in THIS
   repo (WordPress is not the source of truth) (default `content/blog`)
3. `assets_dir` — local store for generated images pre-upload. **Default
   `blog-ops/assets`** (per the brief; distinct from the Astro default,
   since a WordPress blog's repo has no existing site-asset convention to
   match). Items 2 and 3 are one menu to the owner: "Pilcrino keeps a
   copy of each post's text and images in this repository and uploads the
   images to WordPress's media library when it stages the post. Use the
   standard folders (`content/blog` and `blog-ops/assets`), or choose
   others?" Default: standard.
4. `frontmatter_template` — state, don't ask: fixed at
   `adapters/publish/frontmatter/wordpress.md` for this adapter (unlike
   Astro, there's no Starlight-vs-content-collections choice to interview
   for). Write no `frontmatter_keys` (absent means every key of the
   template; WordPress takes them all).
5. `base_url`: default the blog URL from Phase 1. Check it answers:
   `curl -sf "<base_url>/wp-json/" | head -c 200` must return JSON with the
   site's `name`; if not, say "That address does not answer as a WordPress
   site (the `/wp-json/` page is missing or blocked). Check the address, or
   ask your host whether the REST API is turned off." and ask again.
6. `username`: "What is your WordPress username, the one you sign in to
   wp-admin with? Pilcrino uploads drafts as this user." Never ask for the
   normal password.
7. **The application password, stored in the Mac's keychain.** Say first,
   in these words or close to them: "WordPress lets you create a separate
   password just for tools like Pilcrino, called an application password.
   In wp-admin go to Users, Profile (or Users, your name), scroll to
   Application Passwords, type a name such as Pilcrino, click Add New
   Application Password, and copy the password it shows (it is shown once;
   the spaces in it are fine). If that section is missing, your host or a
   security plugin has turned it off; ask them to enable application
   passwords for your user. Don't paste it here. When you have it copied,
   tell me: a small window will open on your Mac asking you to paste it,
   and it goes straight into your Mac's keychain, where Pilcrino reads it
   from. I never see it and it is not written to any file."
   On "ready", run exactly this, in one Bash call with a timeout of at
   least 300000 ms (the owner needs time to paste), where `<service>` is
   `pilcrino-wp-<blog slug>` (the blog's name lowercased, every run of
   characters other than letters and digits replaced by one hyphen,
   trimmed; derived, never asked) and `<user>` is answer 6:
   ```bash
   PW=$(osascript -e 'text returned of (display dialog "Paste the WordPress application password for <blog name>" default answer "" with hidden answer)') \
     && [ -n "$PW" ] \
     && security add-generic-password -U -s "<service>" -a "<user>" -w "$PW" \
     && echo stored || echo "not stored"
   ```
   The dialog hides what is typed; `-U` updates an item that already
   exists; a cancelled dialog makes `osascript` exit non-zero, so nothing
   is stored and the output is `not stored`. The variable is never echoed,
   logged or written anywhere else; the command's only output is one of
   the two words. On `stored`: write `app_password_keychain: <service>`
   (and no `app_password_env`) and tell the owner in one sentence where it
   lives and why: "Stored in your Mac's keychain under the name
   `<service>`, so Pilcrino can log in to WordPress from this Mac without
   the password ever appearing in a file or in this chat." On `not stored`
   (cancelled, or empty): ask "The window was closed without a password.
   Try again, or keep the password in a settings file on this Mac
   instead?" Try again → the same command once more. Settings file → the
   environment-variable route: derive the name `<BLOG_SLUG_UPPER>_WP_APP_PASSWORD`
   (never ask the owner to name a variable), write `app_password_env:
   <name>` (and no `app_password_keychain`), back up `~/.zshrc` to
   `~/.zshrc.bak-pilcrino`, append a comment line and
   `export <name>="PASTE-PASSWORD-HERE"`, run `open -e ~/.zshrc` to open it
   in TextEdit, and say: "I opened a small settings file your Mac's
   terminal reads at start. On its last line, select the text
   PASTE-PASSWORD-HERE (all of it, not the quote marks) and paste your
   password over it, save with Cmd+S, close TextEdit, then tell me." On
   the reply check that the placeholder is gone (`grep -c
   PASTE-PASSWORD-HERE ~/.zshrc`), never print the line. Then say why a
   restart is needed, in these words or close to them: "Your Mac's
   terminal reads that file only when a new Terminal window opens, and
   Claude Code keeps the settings it started with. Before your first post,
   quit Claude Code, open a new Terminal window, and start Claude Code
   again in `<blog folder>`; otherwise the post can't log in to WordPress.
   I'll check the password now in a way that reads the file." (The
   wizard's own Bash calls do not see the new line either: the probe below
   runs in a shell that reads `~/.zshrc`.) Say also that the Pilcrino app,
   if used later, needs the same value in its own settings.
8. `default_status` — state, don't ask: this is always `draft` in v1; the
   adapter never publishes past draft, the human clicks Publish in WP
   admin. To the owner: "Pilcrino uploads each post as a WordPress draft;
   you click Publish yourself."
9. `apply_inbound_links_live` — state, don't ask: always written as
   `false`. Do not quote the key to the owner; say: "Pilcrino will not edit
   your already-published posts (to add links to new ones) unless you turn
   that on later."

**Write the `publish:` block now** (whole-file rewrite, Global rule 4, the
merge shown under "git: block" below; the `git:` block is detected rather
than asked, so detect it now too), because the probe reads the password
source from `blog-ops/config.yaml`.

Run the auth probe from
`${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` §Staging step 2,
**AT MOST ONCE this run — never retried, never polled** (the same rule that
section states for the real workflow's staging probe applies here
identically). The password comes from
`${CLAUDE_PLUGIN_ROOT}/adapters/publish/scripts/wp-secret.sh`, which reads
whichever source the config names; never inline it, never `cat` the
keychain or the shell file:
```bash
cd "<blog folder>" || exit 1
WP_USER="<username>"
WP_BASE="<base_url>"
WP_APP_PASSWORD="$("${CLAUDE_PLUGIN_ROOT}/adapters/publish/scripts/wp-secret.sh")" || exit 1
curl -sf -u "$WP_USER:$WP_APP_PASSWORD" "$WP_BASE/wp-json/wp/v2/users/me" >/dev/null \
  && echo "auth OK" || echo "auth FAILED"
```
For the environment-variable route the value lives in `~/.zshrc`, which
this shell has not read, and which zsh reads only in an interactive shell
(`zsh -lc` is not one). Run the same probe through `zsh -lic`, so the new
export is read; the password still only passes from `wp-secret.sh` to
`curl` inside that shell and is never printed:
```bash
cd "<blog folder>" || exit 1
PLUGIN="${CLAUDE_PLUGIN_ROOT}" WP_USER="<username>" WP_BASE="<base_url>" zsh -lic '
  WP_APP_PASSWORD="$("$PLUGIN/adapters/publish/scripts/wp-secret.sh")" || exit 1
  curl -sf -u "$WP_USER:$WP_APP_PASSWORD" "$WP_BASE/wp-json/wp/v2/users/me" >/dev/null \
    && echo "auth OK" || echo "auth FAILED"' </dev/null
```
The settings read under **Permalinks** below binds the password the same
way on this route. If `wp-secret.sh` itself fails, its one stderr line says why (no
keychain item, variable unset): report that line in plain words and treat
it as `auth FAILED` without running `curl`.

**Permalinks (read, don't ask).** Right after the probe, two reads:
`curl -sf "$WP_BASE/wp-json/wp/v2/posts?per_page=1&_fields=link"` (no
auth; a published post's real address) and, when the probe said `auth
OK`, `curl -sf -u "$WP_USER:$WP_APP_PASSWORD"
"$WP_BASE/wp-json/wp/v2/settings"` for `permalink_structure` (bind the
password at the top of that Bash block again, per the adapter's rule).
Write `publish.wordpress.permalink_structure: <value>` (from the settings
call; or inferred from the post link when the settings call was not
possible: `/<slug>/` → `/%postname%/`, `/YYYY/MM/DD/<slug>/` →
`/%year%/%monthnum%/%day%/%postname%/`, `/blog/<slug>/` →
`/blog/%postname%/`; no published post and no settings → omit the key).
Then correct Phase 1's guesses from it, with one sentence to the owner:
`blog.route_prefix` is the fixed path before `%postname%` (`/` for
`/%postname%/`, `/blog/` for `/blog/%postname%/`, `/` for a date-based
structure, whose dates vary per post) and `blog.trailing_slash` is whether
the structure ends in `/`. A date-based structure (any `%year%`,
`%monthnum%` or `%day%`): say "Your site puts the date in every post's
address (`/2026/02/17/hello-world/`). That works, but addresses without
dates rank and share better and never go stale. I recommend changing it
in wp-admin under Settings, Permalinks to 'Post name', before the first
post; WordPress redirects the old addresses. Pilcrino uses whatever
address WordPress gives each post either way." Record what you read; the
post workflow prints the real address WordPress returns, never one built
from this value.
**Crash-note (both outcomes, when `blog-ops/reference/site-research.md`
exists):** append a line to that file recording today's outcome — e.g.
"WordPress auth probe: OK on `<today's date>`." or "WordPress auth probe:
FAILED on `<today's date>`; site-conventions.md not written this run."
This is what the Resume check above reads back on a later run so "keep
as-is" is an informed choice instead of a guess. No `site-research.md`
(Phase 1.5 never ran, or was declined) → nothing to append to; skip this
note, matching the "recommended, not required" case in the Resume check
above.

- **`auth OK`** → report it, continue to the `git:` block below (and, if
  Phase 1.5's research ran, straight into the deferred site inspection
  right after it).
- **`auth FAILED`** → stop credential probing and site inspection for
  this run; continue the wizard; Phase 6 repeats the warning. Do NOT
  re-run the curl command, do not attempt any second check "just to be
  sure", and skip the authenticated settings read under Permalinks and
  the deferred site inspection. Report the lockout guidance
  verbatim, quoting `wordpress-rest.md` §Staging step 2's own lockout
  sentence word for word, with exactly one adapted clause (**bolded**
  below — the source is written for the real per-post workflow's staging
  probe, whose bare "re-run once" has no object in that context; the
  wizard needs to name what's being re-run, so this is the one insertion
  allowed):

  "on a 401/403, do not retry — a failed WordPress login may have already
  tripped the host's or a security plugin's login-attempt limiter, keyed to
  your IP and username. Retrying immediately only extends the lockout. Tell
  the human to wait it out or clear the limiter in the site's security
  dashboard, then re-run **this wizard** once, by hand, when ready." (Source
  clause, for comparison: "...then re-run once, by hand, when ready.")
  To the owner, put it this way first, then the quoted guidance: "The
  WordPress login did not work. I won't try again right away: hosts lock
  an account after a few failed logins. Check in wp-admin that the
  application password is still listed for <user>, wait a few minutes,
  then run setup again and I'll ask for it once more." A wrong password
  in the keychain is replaced by running the same hidden-dialog command
  (`-U` overwrites); never ask the owner to type it in the chat.

  A failed probe doesn't block FINISHING the rest of the wizard (Phase 6
  re-states the failure, it never re-probes) — the user may fix credentials
  and re-run later — but flag it loudly: this exact command is what the
  real workflow's one-shot staging probe runs for real, on the first post,
  so a failure here is a strong signal to fix it before attempting one. A
  failed probe also means the deferred site inspection below cannot run
  this pass (it reuses this same credential, never a fresh probe of its
  own) — `{profile_dir}/site-conventions.md` stays unwritten until a later
  run's probe succeeds (see the crash-note above and the Resume check at
  the top of this phase, which is how that later run finds out). Then
  continue with the `git:` block below.

### If `markdown`

2. `content_dir` (default `posts`; for Hugo the existing posts folder,
   `content/posts` or `content/blog`, whichever exists): the folder in this
   repo where each post lands as `<slug>.md`. To the owner: "Posts go in
   the folder `<path>`."
3. `assets_dir` (default `posts/images`; Hugo `static/images`, Next.js
   `public/images`): each post's images land in `<assets_dir>/<slug>/`.
4. "Which platform reads these files?" Detect it from the repo as in the
   adapter choice above and confirm in one line rather than asking a menu
   of seven; ask the menu only when nothing in the repo says.
   → `publish.markdown.platform`, one of:
   - `astro`: `title`, `description`, `pubDate`, `tags`, `author`, `heroImage` (an Astro content collection)
   - `hugo`: `title`, `description`, `date`, `tags`, `author`, `cover`
   - `jekyll`: `layout: post`, `title`, `description`, `date`, `tags`, `author`, `image`; you rename each file to `YYYY-MM-DD-<slug>.md` in `_posts`
   - `ghost`: `title`, `excerpt`, `published_at`, `tags`, `authors`, `feature_image`, Ghost's own field names
   - `nextjs`: `title`, `description`, `date`, `tags`, `author`, `image`
   - `eleventy`: the same keys as `nextjs`
   - `generic`: the same keys, for any other platform (Webflow, a page builder)
   To the owner, name only the human fields: "Each post carries a title,
   a short description, the date, tags, the author and a cover image."
4a. **Fit the theme (Hugo).** Read `theme` from `hugo.toml` (or
   `config.toml`, `hugo.yaml`; a `[module] imports` path counts too) and
   look at how that theme names the cover image: the theme's archetype
   (`themes/<theme>/archetypes/default.md`, or `archetypes/` at the repo
   root), its single-post layout (`grep -rn "Params\.\|\.Param " themes/<theme>/layouts/_default/single.html
   themes/<theme>/layouts/posts/single.html` for the image key), and any
   existing post under `content/`. Ananke reads `featured_image`; a theme
   that reads `cover` or `image` as a plain path uses that key. Write
   `publish.markdown.cover_key: <key>` when it differs from `cover`, and
   tell the owner in one sentence: "Your theme, <theme>, shows a post's
   cover from a field called `<key>`, so that is where Pilcrino puts it."
   A theme whose cover is nested (PaperMod's `cover.image` with `alt` and
   `caption`): say "Your theme expects the cover as a group of fields,
   which Pilcrino does not fill in this version; the cover image is saved
   with the post, and the theme shows it once you add it to the post by
   hand" and keep the default key. No theme found in the repo (an empty
   Hugo site): ask the owner to paste the first lines (the part between
   the `---` or `+++` markers) of one existing post, or keep the default
   and say the first post's page is the check.
   Then `publish.markdown.frontmatter_keys`: the template's keys minus the
   draft key (`draft` for Hugo, `published` for Jekyll: the list never
   holds it, `draft_key` decides it; config-schema.md invariant 16), with
   `cover` replaced by `cover_key` when set, dropping `tags` and `author`
   only when neither the theme's layouts nor its archetype nor an existing
   post uses them (Ananke uses `tags`; its author comes from site config,
   so a missing `author` is harmless and may stay). When in doubt keep the
   key: Hugo ignores unknown fields without error. Always include `title`,
   `description`, `date` and the cover key (invariant 16). Draft: Hugo
   honours `draft: true` on its own; write no `draft_key`, and say "Pilcrino
   keeps each post marked as a draft until you approve it; Hugo leaves
   drafts out of the site." `uglyURLs` was read in Phase 1; confirm
   `blog.trailing_slash` matches it and correct silently if Phase 1 ran
   before the repo was known.
4b. **Fit the schema (markdown with platform `astro`).** Run the
   `astro-git-pr` branch's steps 5a and 6 against this repo's content
   collection and write `publish.markdown.frontmatter_keys` and, when the
   owner declines the draft switch, `publish.markdown.draft_key: none`,
   with the same owner-facing wording. The template is
   `markdown-astro.md`, whose fields match `astro-content.md`'s row in
   step 5a's table (`heroImage`, `tags`, `author`), except the cover's
   type: it depends on step 5 below, so a missing cover field is settled
   after step 5. With an `image_url_prefix` the cover is a web address
   and the field to add is `heroImage: z.string().optional()`; with
   relative images it is `heroImage: image().optional()` in the function
   form, as in step 5a. Declined → as in step 5a: do not write this
   platform choice, explain, and let the owner pick again or stop. The
   list never holds the draft key (`draft`).
4c. **Other platforms.** `jekyll` honours `published: false` and
   `nextjs`/`eleventy`/`generic`/`ghost` have no draft flag: for the
   repo-built ones, say once "Your site has no draft switch, so a merged
   post is live once the site rebuilds; the pull request is where you
   check it before that." For paste platforms, say nothing about drafts.
   Write no `frontmatter_keys` (absent means every key of the template;
   any list setup does write for a markdown platform is built the same
   way as Hugo's: the template's keys minus the draft key).
5. Repo platforms only (`astro`, `hugo`, `nextjs`, `eleventy`; skip for
   `jekyll`, `ghost`, `generic`): "How does your site serve a post's
   images?" → `publish.markdown.image_url_prefix`. Offer two answers, the
   platform's usual layout first as the default:
   - the usual layout for the platform:
     - `hugo`: files under `static/images/<slug>/`, served at `/images`
     - `nextjs`: files under `public/images/<slug>/`, served at `/images`
     - `eleventy`: a folder the site's config passes to
       `addPassthroughCopy` (for example `images`), served at its URL
       (for example `/images`)
     - `astro`: relative paths, as `astro-content.md` (the content
       collection resolves them at build); the other answer for astro is
       files under `public/images/<slug>/`, served at `/images`
   - "relative, my site copies the folder next to the post".

   When the answer is a prefix: normalize it first, in three steps: (a) trim
   surrounding whitespace, (b) drop one trailing `/`, (c) require that the
   result is either a site path (a single leading `/`, then at least one
   character that is not `/`, no whitespace anywhere, so `/images`) or an
   absolute URL (`http://` or `https://`, then a host, then an optional
   path with no whitespace, so `https://cdn.example.com/images`); if it is
   neither (for example `//cdn.example/images`, `/image folder` or
   `https:///x`), say so, name those two shapes, and ask again, and write
   nothing until it is one of them. `/images/` and
   ` /images ` both become `/images`. Then write `image_url_prefix:
   <normalized prefix>` (for
   example `/images`), and when `assets_dir` (item 3) is not the folder
   that prefix serves, suggest changing it to that folder (for example
   `static/images` for Hugo, `public/images` for Next.js). When the answer
   is relative: write no `image_url_prefix`. Either way, say: "Pilcrino
   does not inspect your site, so the first post's page on the site is the
   check: open it after the merge and confirm the images load." Platform
   `astro` with no cover field in the schema: settle it now, as step 4b
   says, before writing anything for this platform.
6. `frontmatter_template`: state, don't ask:
   `adapters/publish/frontmatter/markdown-<platform>.md`.

Then say in one line what the merge does for their platform, using the
`publish.site_live` answer. Repo platforms (`astro`, `hugo`, `nextjs`,
`eleventy`), live: "Merging a post's pull request publishes it, once your
site rebuilds and as long as it serves images the way you just chose";
not live: "Merging files the post in the repository; it appears once the
site is online and builds from GitHub." Paste platforms (`jekyll`, `ghost`,
`generic`): "Before you approve each post, you paste it into <Platform>:
Pilcrino hands you the post text ready to paste and opens the folder with
its images, and lists the fields (title, description, date, tags, cover)
one by one. Merging then files the post in this repository." Mention
"or download the post's zip from the Pilcrino app" ONLY when this blog is
registered with the app (`~/.pilcrino/console/blogs.json` lists this
folder, or Phase 7 has already added a `console:` block); otherwise the
app has not been introduced and the sentence confuses.

Verify the directories exist on disk:
```bash
[ -d "<content_dir>" ] && [ -d "<assets_dir>" ] && echo "both exist" || echo "missing"
```
If missing, offer to `mkdir -p` them; this adapter needs no site project in
the repo.

### git: block (every adapter)

Detect, don't ask:

10. `git.branch_prefix`: `blog/`. State it in one line ("Each post gets its
    own branch named `blog/<post>`") and move on; change it only if the
    owner objects.
11. `git.base_branch`: the base branch Phase 0b found and switched to
    (the repository's default branch from `gh repo view --json
    defaultBranchRef -q .defaultBranchRef.name`; an empty repository:
    `main`). State it ("Pull requests go against `<branch>`, your
    repository's main branch").

Merge into `config.yaml`:

```yaml
publish:
  adapter: <astro-git-pr | wordpress-rest | markdown>
  site_live: <true | false>         # the "how does the site go live" answer
  astro:            # only if adapter = astro-git-pr
    content_dir: <path>
    site_dir: <path>                # omit if the repo root IS the Astro site
    assets_dir: <path>
    frontmatter_template: <path>
    draft_mechanism: "<line>"       # or the literal none when the owner declined the draft switch
    frontmatter_keys: [<keys>]      # the schema's accepted keys, step 5a
    authors_map_check: <path>       # omit if not set
    preview_comment_marker: "<marker>"   # omit if not set
  wordpress:        # only if adapter = wordpress-rest
    content_dir: <path>
    assets_dir: <path>
    frontmatter_template: adapters/publish/frontmatter/wordpress.md
    base_url: <url>
    username: <username>
    app_password_keychain: pilcrino-wp-<blog slug>   # the keychain route (default)
    # app_password_env: <NAME>                       # the settings-file route instead; never both
    permalink_structure: <value>    # as read from the site; omit when unknown
    default_status: draft
    apply_inbound_links_live: false
  markdown:         # only if adapter = markdown
    content_dir: <path>
    assets_dir: <path>
    image_url_prefix: <prefix>      # omit when images are relative
    platform: <astro | hugo | jekyll | ghost | nextjs | eleventy | generic>
    frontmatter_template: adapters/publish/frontmatter/markdown-<platform>.md
    cover_key: <key>                # omit when the template's own key fits (hugo Ananke: featured_image)
    frontmatter_keys: [<keys>]      # omit when every template key is accepted
    draft_key: none                 # only when the site has no draft switch and the owner declined one

git:
  branch_prefix: <prefix>
  base_branch: <branch>
```

(`review.plan_approval` and `git.push_without_asking` are added in Phase 6.)

### Site conventions (deferred from Phase 1.5)

If `blog-ops/reference/site-research.md` exists (Phase 1.5's existing-blog
research ran and the user consented to it earlier in this session), run
the now-resolved adapter's `## Site inspection (setup-time)` procedure —
`${CLAUDE_PLUGIN_ROOT}/adapters/publish/wordpress-rest.md` or
`astro-git-pr.md`, whichever matches `publish.adapter` above — now, at
exactly this point. This IS Phase 1.5(e), deferred to here per that
phase's own note, because it needed the adapter chosen (just happened,
above) and, for `wordpress-rest`, its credential already verified (the
probe above, a few paragraphs up):

- **`wordpress-rest`:** only run this if the probe above reported
  `auth OK`. It reuses that SAME credential — never a fresh probe of its
  own, per that section's own auth-reuse rule. If the probe failed, skip
  this step entirely this run (see the note at the end of the auth-probe
  section above).
- **`astro-git-pr`:** no credential dependency at all — run this
  immediately, regardless of the directory-verification outcome above
  (it only reads files already in the repo).
- **`markdown`:** no inspection procedure (the adapter never reads the
  site): skip this section. `site-conventions.md` stays unwritten and is
  never required for this adapter.

Either branch writes `{profile_dir}/site-conventions.md` (shape:
`${CLAUDE_PLUGIN_ROOT}/templates/site-conventions.md`) and presents it to
the user for confirmation before treating it as final, per that adapter
section's own last step — never silently accepted, same as every other
pre-filled doc in this wizard.

**Cross-check `blog.trailing_slash`.** Both adapters' inspection procedures
read the site's actual permalink format and compare it against
`blog.trailing_slash` (set by Phase 1's Q12 directly, when its gate was
open, or already corrected once by Phase 1.5(a)'s own pre-fill confirmation
otherwise — either way, usually already correct by this point, but this
cross-check is the final safety net regardless of which path set it). If
they disagree, flag it loudly to the user instead of silently picking
one — per each adapter's own note — then, once the user confirms which one
is actually right, correct `blog.trailing_slash` in `config.yaml`
(re-merge and rewrite the whole file, Global rule 4) to match the real
site.

If `blog-ops/reference/site-research.md` does NOT exist (a brand-new blog,
or the user declined Phase 1.5's offer), skip this section entirely —
`site-conventions.md` stays unwritten. Per config-schema.md, that file is
required only when `publish.adapter: wordpress-rest` AND the blog already
existed at setup; recommended otherwise. A brand-new blog correctly has
nothing to inspect yet.

**Resume:** if `{profile_dir}/site-conventions.md` already exists, apply
Global rule 3 (keep as-is / update by re-running the adapter's inspection
procedure / start over) instead of blindly re-running it.

### Check the GitHub precondition

Per config-schema.md §GitHub precondition (this is unconditional for
every adapter, because the shared git staging shell runs underneath all of them):

```bash
ORIGIN=$(git remote get-url origin 2>/dev/null)
gh auth status
if [ -n "$ORIGIN" ] && gh repo view "$ORIGIN" --json name >/dev/null 2>&1; then
  echo "GitHub precondition: ok (PR publish path available)"
else
  echo "GitHub precondition: FAILED"
fi
```

**A failure here is a SETUP FAILURE, not a mode.** There is no local publish
path any more: the PR path is the only publish path, so an unreachable
`origin` means every post this blog attempts would hard-stop at the
workflow's Step 0 config preamble. Report the failing command's output and
stop this phase — the operator fixes the remote (or authenticates `gh`) and
re-runs setup. Do not write a "mode" anywhere; there is nothing to record.

On success, report in one sentence what it buys: every post opens a GitHub
PR and a background monitor watches for review comments.

## Phase 6: Validation & handoff

**Goal:** confirm the workspace is complete and correct, fix anything
that isn't, then hand off.

This phase always runs in full on every invocation (no skip option — it's
cheap and it's the whole point of the wizard). Owner's name for this part:
"Final checks."

### Run the validator (invariants 1 to 16)

Run the plugin's validator from the blog folder:

```bash
cd "<blog folder>" && node "${CLAUDE_PLUGIN_ROOT}/skills/blog-setup/scripts/validate-config.mjs"
```

It first installs the Pilcrino browser's packages if they are missing (so a
fresh Mac needs no YAML library of its own; never improvise a `pip` or
`npm install` for this), then reads `blog-ops/config.yaml` and the profile
docs, checks config-schema.md's invariants 1 to 16 and prints one
plain-words line per check and a last line, `All N checks pass` or the
failing checks, exiting 1 on failure. Never hand-check the invariants or
write a parser of your own; never show the owner a stack trace. Show the
owner the last line, and for each failing check its plain-words line.

The table below documents what the script checks, for the model reading
this file; the owner sees the script's lines, not this table.

| # | Invariant | Result |
|---|---|---|
| 1 | YAML parses; `blog.name`, `blog.url`, `modules`, non-empty `images.enabled`, `publish.adapter` present | ✅/❌ |
| 2 | `images.featured_default` (if set) ∈ `images.enabled` | ✅/❌ |
| 3 | `remotion` ∈ `images.enabled` → `images.remotion.project_dir` set AND exists on disk | ✅/❌ |
| 4 | `publish.adapter` ∈ {astro-git-pr, wordpress-rest, markdown} and its config block present with required keys | ✅/❌ |
| 5 | Module-conditional profile docs exist iff module on (`product.md`, `competitors/methodology.md`) | ✅/❌ |
| 6 | Required profile docs always present: `blog.md`, `voice.md`, `authors.md`, `audience.md`, `image-style.md` | ✅/❌ |
| 7 | `blog.route_prefix` present, starts and ends with `/` | ✅/❌ |
| 8 | `browser.executable`, if present, is an absolute path | ✅/❌ |
| 9 | `blog.trailing_slash` present and a boolean | ✅/❌ |
| 10 | `console.publish_policy: auto` → `publish.adapter` is `astro-git-pr` (`wordpress-rest` and `markdown` are gated only) (N/A, ✅ by vacuity, if no `console:` block yet) | ✅/❌ |
| 11 | Documented optional keys carry their documented types: a `console:` block, if present, contains only documented keys with documented types; a `review:` block, if present, holds only `plan_approval` as `ask` or `auto`; `publish.site_live` and `git.push_without_asking`, if present, are booleans; `publish.astro.draft_mechanism` is a non-empty string (`none` allowed); `publish.markdown.draft_key`, if present, is the template's draft key or `none`; `publish.markdown.cover_key`, if present, is one top-level key (no dot); `publish.wordpress.permalink_structure` and `app_password_keychain`, if present, are non-empty strings | ✅/❌ |
| 12 | `competitors.profile_dir`, if set, is a repo-relative path that exists on disk when `modules.competitors` is true (N/A, ✅ by vacuity, if unset — the default applies) | ✅/❌ |
| 13 | `social.linkedin`, if present, has a non-empty string `company_id` (N/A, ✅ by vacuity, if `social.linkedin` is absent — this phase doesn't offer a wizard step for it, add it by hand) | ✅/❌ |
| 14 | `remotion` ∈ `images.enabled` → repo-root `.gitattributes` marks `<images.remotion.project_dir>/src/Root.tsx` as `merge=union` (N/A, ✅ by vacuity, if `remotion` is not enabled) | ✅/❌ |
| 15 | `publish.adapter: wordpress-rest` → exactly one of `publish.wordpress.app_password_env` (a valid variable name) and `publish.wordpress.app_password_keychain` (a non-empty service name) is set; both or neither fails (N/A for the other adapters). A syntax check only: whether the item or variable exists was probed in Phase 5 | ✅/❌ |
| 16 | `publish.<adapter>.frontmatter_keys`, if present, is a non-empty list of non-empty strings that includes every required key of the configured template (`title`, the description key, the date key, the cover key, which is `publish.markdown.cover_key` when set; `layout` too for jekyll; no cover key for wordpress) | ✅/❌ |

For each failing check: identify which earlier phase owns the gap, jump
back into that phase's interview (pre-filled with whatever's already
known), fix it, rewrite the artifact, then re-run the validator. Continue
until it prints `All N checks pass`. Invariants 10-11's `console` part is
normally vacuous here since Phase 7 (which writes the `console:` block)
runs after this phase; Phase 7 re-runs the validator once that block
exists. This wizard has no interview step for `social.linkedin` (invariant
13); the operator adds that block to `config.yaml` by hand per
`config-schema.md` §Schema.

### Supplementary checks (beyond the 16 numbered invariants)

- **No leftover placeholders.** `Grep` every file under `{profile_dir}/`
  (plus `{competitors_dir}/methodology.md` too, when `competitors.profile_dir`
  points outside `{profile_dir}/` and so isn't already covered by that
  sweep) for a literal `<` immediately followed by a word character and `>`
  later on the same line (a leftover template token), EXCLUDING
  `{competitors_dir}/methodology.md`'s nested "Profile shape"
  fenced block (Phase 3) — that block's angle brackets are a template for
  future per-competitor profiles, not unfilled wizard output; the rest of
  `methodology.md` (everything outside that one fenced block) is still
  subject to this check. Any other hit → that doc wasn't fully filled in;
  go back to the owning phase and fill it.
- **Adapter auth re-confirmed.** Re-state the Phase 5 auth probe result
  (WordPress: the `users/me` check that read the password through
  `wp-secret.sh`; Astro and markdown: `gh auth status` + `gh repo view`),
  in owner words ("WordPress login: OK" / "GitHub: OK, as <login>"). If
  either failed, remind the user it needs fixing before the first real
  post, but don't block handoff on it (the config preamble will catch it
  again at workflow-run time). Never re-run the WordPress probe here.
- **Git repo status + the GitHub precondition result**, re-stated from Phase 5, one line.
- **Site conventions, recommended-doc check (not a numbered invariant).**
  Per config-schema.md, `{profile_dir}/site-conventions.md` is REQUIRED
  when `publish.adapter: wordpress-rest` AND this blog already existed at
  setup — read that condition off `{profile_dir}/blog.md`'s
  `existing_blog: true` line (Phase 1.5's Offer step), never off whether
  `blog-ops/reference/site-research.md` happens to exist: an existing blog
  that declined Phase 1.5's research offer still has `existing_blog: true`
  and still owes this file, with no `site-research.md` on disk to proxy the
  check off of. If that combination holds and the file is still missing (Phase
  1.5 was declined, or its research ran without a successful auth probe by
  the time Phase 5's deferred inspection needed one), tell the user this
  doc is missing and recommend running the wizard again once credentials
  work, or answering "yes, research it" if Phase 1.5 was declined — but
  don't block handoff on it; this is advisory, not one of the ✅/❌ rows
  above.

### Two standing decisions (every blog)

Ask these two, one per message, as menus, and merge the answers into
`config.yaml` (whole-file rewrite, Global rule 4). Read each back in one
sentence.

1. **Plan approval → `review.plan_approval`.** "Before each post is
   written, Pilcrino makes a plan (the title, the angle, the sections, which
   competitors and product mentions it includes) and its own reviewer checks
   it. Do you want to read and approve that plan yourself before the
   writing starts, or let the reviewer's approval be enough?"
   - "I approve each plan myself" (default) → `ask`. Read back: "You'll
     see a short summary of each plan and say ok or ask for changes."
   - "The reviewer's approval is enough" → `auto`. Read back: "Posts go
     from plan to draft without waiting for you; you still review the
     finished post."
   Say once that the Pilcrino app, if used, has its own approval screens
   and ignores this setting.
2. **Pushing Pilcrino's own files → `git.push_without_asking`.** "Pilcrino
   keeps its files on your repository's main branch: these setup files,
   competitor fact sheets, and the content plan. Besides the setup commit
   we're about to make, may it push those files to main later without
   asking each time? This never includes a post: a post is always a pull
   request that you merge, on GitHub or by telling Pilcrino "merge it"
   after you approve it."
   - "Yes, push them without asking" → `true`.
   - "No, ask me each time" (default) → `false`.
   Read back the choice in one sentence.

```yaml
review:
  plan_approval: <ask | auto>

git:
  branch_prefix: <as before>
  base_branch: <as before>
  push_without_asking: <true | false>
```

### Custom instructions (optional)

Ask, as this phase's last question, regardless of invariant results:
"Want to seed a `custom-instructions.md` for this blog? Standing
instructions every stage of `blog-post-workflow` honors from here on —
tone tweaks, hard bans, platform quirks — ranked below your own live
instructions in any given conversation, but above this plugin's
personas/standards defaults." To the owner: "Is there anything every post
should always or never do (a phrase to avoid, a rule about your product,
something about your platform)? Give it to me in your own words, or reply
`none`."

- **Yes** → collect the content (free-text, multi-line is fine — this is
  the one profile doc with no fixed template shape). Write
  `{profile_dir}/custom-instructions.md` with exactly what the user gave
  you, verbatim, under a `# Custom instructions` heading if they didn't
  already provide their own structure. No placeholder tokens to fill in
  (Global rule 6 doesn't apply here — there's no template to leave gaps
  in).
- **No, or left blank** → skip. This doc is always optional per
  config-schema.md's registered-doc list — no file is written, and no
  invariant above depends on its presence.

**Resume:** if `{profile_dir}/custom-instructions.md` already exists, read
it, show a short summary, and apply Global rule 3 (keep as-is / update /
start over) instead of asking from scratch.

### Commit and push the setup files (with consent)

Every post's pull request is opened against the base branch, and the post
workflow's Step 0 reads `blog-ops/` from there, so the setup files must
reach it. Do this now, after the validator passes and the two decisions are
recorded, in this order:

1. **Git identity.** `git -C "<blog folder>" config user.name` and
   `user.email`. When either is empty, do not ask the owner for an email:
   take the name and login from `gh api user -q '.name, .login, .id'` and
   set, for this repository only (`git config user.name "<name or login>"`,
   `git config user.email "<id>+<login>@users.noreply.github.com"`), then
   say in one sentence: "Commits will show as <name>, through your GitHub
   account, with GitHub's private address." Set the author name to the
   owner's own name from `authors.md` only if they ask.
2. **What goes in.** The commit holds only the paths setup created or
   edited, from Global rule 9's list: never `git add -A`, `git add .` or a
   folder that held the owner's files, and never anything the owner staged
   before setup. Find the two lists by full path:
   ```bash
   cd "<blog folder>" || exit 1
   G="$(git rev-parse --absolute-git-dir)"
   P="$G/pilcrino-setup-paths"; B="$G/pilcrino-setup-before"
   ```
   Build the commit list from `$P`: drop each path under `_scratch/`,
   `_setup-shots/`, `blog-ops/reference/image-samples/`, `node_modules/`
   or `out/` (at any depth), and each path that no longer exists and was
   never committed. A line in `$P` that is a folder (an older run may have
   recorded one) is not added as a folder: replace it with the files
   setup wrote in it, listed as Global rule 9 does, and the same drops
   apply. Then check
   each remaining path against `$B` (it lists the path, or a folder the
   path is in, as changed before setup started):
   - **A file setup cannot go without** (`blog-ops/config.yaml`, or a
     profile doc under `blog-ops/profile/`): never leave it out silently.
     Show the owner its whole change, `git diff HEAD -- <path>` (for a
     file git has never seen, the file itself), and ask: "`<path>` had
     your own unsaved edits before setup started, and setup then wrote its
     settings into it. The change below holds both: setup's values and
     your earlier edit. Setup's files don't work on GitHub without this
     one, so I'd like to save it as it is now. Include it?" Yes: keep it
     in the list. No: build no commit, keep both lists, and say "Setup's
     files are saved in this folder but not committed, because setup
     can't go out without `<path>`. When your edit there is ready, run
     `/pilcrino:blog-setup` again and I'll pick up at this step." Then go
     to the Handoff as "not committed yet".
   - **Any other file** (a site file setup edited that also held an owner
     change): leave it out of the list and name it in step 3.

   **Write the site files section now**, from the final list: rewrite the
   `## Site files edited by setup` section of `{profile_dir}/setup-notes.md`
   so it holds exactly the site files (Global rule 9's meaning) that are on
   the commit list, replacing whatever an earlier run wrote there. A site
   file left out above is not in it. No site file on the list: remove the
   section. `setup-notes.md` is itself on the list, so the commit carries
   this section.

   Build the commit in a separate index, so the owner's own staging is
   never read or changed, and do not move the branch yet:
   ```bash
   cd "<blog folder>" || exit 1
   G="$(git rev-parse --absolute-git-dir)"; I="$G/pilcrino-setup-index"
   rm -f "$I"
   if git rev-parse -q --verify HEAD >/dev/null; then
     GIT_INDEX_FILE="$I" git read-tree HEAD; PARENT="-p HEAD"
   else
     GIT_INDEX_FILE="$I" git read-tree --empty; PARENT=""
   fi
   GIT_INDEX_FILE="$I" git add -- "<file 1>" "<file 2>" ...   # each file in the list, by name, never a folder
   if [ -n "$PARENT" ]; then
     NEW="$(GIT_INDEX_FILE="$I" git diff-index --cached --name-only HEAD)"
   else
     NEW="$(GIT_INDEX_FILE="$I" git ls-files --stage | cut -f2)"
   fi
   BAD="$(printf '%s\n' "$NEW" | grep -E '(^|/)(_scratch|_setup-shots|node_modules|out)/|^blog-ops/reference/image-samples/')"
   if [ -n "$BAD" ]; then
     rm -f "$I"; echo "STOP: temporary files in the commit:"; echo "$BAD"; exit 1
   fi
   T="$(GIT_INDEX_FILE="$I" git write-tree)"
   C="$(git commit-tree "$T" $PARENT -m "Set up Pilcrino for <blog name>")"
   rm -f "$I"; echo "$C"
   if [ -n "$PARENT" ]; then echo "parent: $(git rev-parse HEAD)"; else echo "root commit"; fi
   git show --stat --format='%h %s' "$C"
   ```
   The check before `write-tree` looks at every path the commit adds or
   changes (in an empty repository, every path `git ls-files --stage`
   shows in the separate index): none may sit under `_scratch/`,
   `_setup-shots/`, `blog-ops/reference/image-samples/`, `node_modules/`
   or `out/`. Paths HEAD already held are the owner's and are not
   checked. On STOP, build nothing further: drop those paths from the
   list and build again. Note the commit id and its parent (or "root
   commit") it prints (shell variables do not carry over to the next
   command). Every file `git show --stat` names must be on the commit
   list; anything else means the build went wrong: build nothing further
   and say so.
3. **Ask once, from that output.** Show the files `git show --stat` listed,
   in owner words (grouped: settings and profile in `blog-ops/`, the image
   tool project, each site file setup changed), name in a separate line
   any site file left out because it also holds the owner's own unsaved
   change ("Left out, because it also has your own unsaved edits:
   `<path>`. Setup's change there stays in this folder, not on GitHub,
   until you save it yourself."), and ask, as a menu:
   "Pilcrino's setup files are ready: the settings and profile in
   `blog-ops/`, <the image tool project>, <the two small changes to your
   site: a draft switch and optional tags>. Shall I commit them and push
   them to `<base branch>` on GitHub now? If your site rebuilds from
   GitHub, this push starts a build; no post is affected. Options: push
   now (recommended) / commit here only, push later / not yet."
   Right before committing (either answer that commits), re-check the
   branch:
   ```bash
   cd "<blog folder>" || exit 1
   if git rev-parse -q --verify HEAD >/dev/null; then
     [ "$(git branch --show-current)" = "<base branch>" ] &&
     [ "$(git rev-parse HEAD)" = "$(git rev-parse <commit>^)" ] && echo OK || echo MOVED
   else
     [ "$(git symbolic-ref HEAD)" = "refs/heads/<base branch>" ] &&
     ! git rev-parse -q --verify <commit>^ >/dev/null && echo OK-ROOT || echo MOVED
   fi
   ```
   When HEAD exists, the branch must be `<base branch>` and HEAD must
   still be the commit's parent (the parent check runs only then). In an
   empty repository (HEAD does not exist yet), HEAD must still point to
   `refs/heads/<base branch>` and the built commit must have no parent
   (`git rev-parse <commit>^` is expected to fail). Another branch: do
   not commit; say "Your folder is on the branch `<name>`, not `<base
   branch>`; setup's files belong on `<base branch>`", and switch back as
   Phase 0b step 3 does (asking first). MOVED for any other reason (a new
   commit landed, or the empty repository got its first commit): build
   the commit again from step 2 before going on.
   To commit, move the branch to the built commit and bring the owner's
   index up to date for those paths only (their other staged changes stay
   as they were). Run only the `update-ref` line that matches the check:
   ```bash
   cd "<blog folder>" || exit 1
   git update-ref refs/heads/<base branch> <commit> <parent>   # after OK
   git update-ref refs/heads/<base branch> <commit> ""         # after OK-ROOT: "" means the branch must not exist yet
   git reset -q -- "<file 1>" "<file 2>" ...                     # the same list
   ```
   - **Push now**: then `git push -u origin <base branch>`, which pushes
     that commit (an empty repository: the first push creates the
     branch). On a push rejected for authentication, offer `gh auth
     setup-git` again (Phase 0a check 4) and retry once. Then confirm
     GitHub has this very commit, not just files of the same name from an
     earlier run:
     ```bash
     cd "<blog folder>" || exit 1
     git fetch origin <base branch> &&
     git merge-base --is-ancestor <commit> origin/<base branch> && echo HAS-COMMIT || echo NO-COMMIT
     git ls-tree -r --name-only origin/<base branch> -- blog-ops/config.yaml blog-ops/profile/
     ```
     Both must hold: HAS-COMMIT, and the listing shows `config.yaml` and
     every profile doc setup wrote. Only then say "Pushed. <If live:> Your
     site is rebuilding; nothing on it changes visibly, the new files are
     settings only." Otherwise say "The push to GitHub didn't go
     through", show git's output from the push and the check, name any
     missing file in plain words, and never report setup as pushed. The
     commit is still saved in this folder.
   - **Commit only**: commit, say the first post will ask to push before it
     can open a pull request.
   - **Not yet**: do not move the branch (the built commit is simply left
     unused); say the same, and that nothing is lost.
   After a commit, empty the paths list (`: > "$P"`) and keep `$B` for
   Phase 7; on "not yet" keep both, so the next run commits the same
   files.
   Run this before Phase 7 so the `console:` block, when added there, gets
   its own small commit under the same consent (push it too when the owner
   chose "push now" and `git.push_without_asking` or a one-line question
   allows it).

### Handoff

Once the validator passes and the files are committed (or the owner chose
otherwise), do NOT print the completion message yet: first run Phase 7
(offer the optional autopilot console). Phase 7 is where the terminal
"Setup complete" message is printed, on BOTH its branches (accept or
decline), so the optional console phase is always offered BEFORE the flow
declares itself done. Proceed to Phase 7 now.

## Phase 7 — Console & content plan (optional)

Owner's name for this part: "The Pilcrino app (optional)." Offer, don't
push: "Pilcrino can also run as an app: it writes posts in the background
on a schedule and gives you a browser dashboard to approve them. Do you
want this blog ready for it? You can add this any time later." Default:
not now.

If yes:
1. Scaffold `blog-ops/content-plan.md` from `${CLAUDE_PLUGIN_ROOT}/templates/content-plan.md`
   (skip if present). It is an empty table; posts are added with
   `/pilcrino:plan-content` (standalone until the app connects this blog,
   then the app imports the file once and owns the list). If the blog has an
   existing editorial-calendar file, do not copy its rows into this file;
   tell the owner to add those posts with `/pilcrino:plan-content`.
2. Add the `console:` block from references/config-schema.md defaults to
   `blog-ops/config.yaml` (skip if already present). **Write it via the
   whole-file rewrite mechanism (Global rule 4), NOT an append.** Write
   `publish_policy: gated` for every adapter and say its one sentence to
   the owner: "The app will never publish a post on its own: every post
   waits for your approval in the dashboard" (for `astro-git-pr` add: "you
   can switch the app to merge approved Astro posts by itself later, from
   its settings"). For `wordpress-rest` and `markdown` blogs `gated` is the
   only valid value (invariant 10: WordPress go-live is manual, and every
   markdown post waits for the owner's approval).
3. Say where the app is: "The Pilcrino app is at https://pilcrino.com. Once
   installed, connect this folder from its dashboard; it imports
   `blog-ops/content-plan.md` into its post list on connect."
4. Re-run the validator (`validate-config.mjs`, invariants 1 to 16, with
   invariants 10 and 11's console part no longer vacuous since the
   `console:` block now exists).
5. Commit `blog-ops/content-plan.md` and the config change under the
   consent given in Phase 6 (push too when the owner chose "push now"),
   exactly as Phase 6 steps 2 and 3 do: the two lists by full path
   (`git -C "<blog folder>" rev-parse --absolute-git-dir`), the commit
   built in its own index from those two paths only (Global rule 9 listed
   them again after Phase 6 emptied the list), `blog-ops/config.yaml`
   shown and asked about when it held the owner's own unsaved change
   before setup, `git show --stat` of the built commit shown before
   anything moves, the same branch checks, then `git update-ref`, `git
   reset -q --` for the two paths, `git push origin <base branch>`, and
   the same two checks before saying it was pushed: after `git fetch
   origin <base branch>`, `git merge-base --is-ancestor <commit>
   origin/<base branch>` must succeed for this new commit, and
   `origin/<base branch>` must hold `blog-ops/config.yaml`. When either
   fails, say "The push to GitHub didn't go through", show git's output,
   and do not report it as pushed.
6. Then print the terminal completion message (below).

**Resume:** if `blog-ops/content-plan.md` and/or `config.yaml`'s `console:`
block already exist, summarize what's on file and apply Global rule 3 (keep
as-is / update / start over) instead of re-offering from scratch.

**If no:** skip the console scaffolding entirely, no files written. This phase
can be run again later — nothing else in the wizard depends on it. Then print
the terminal completion message (below).

### Completion (printed at the end of Phase 7, both branches)

Whether the operator accepted or declined the console, close the wizard
with a short recap in owner words and then the exact last line. When the
setup files were committed, first delete the two lists (Phase 0b's and Global rule 9's) in
git's own folder: `rm -f "$(git -C "<blog folder>" rev-parse
--absolute-git-dir)"/pilcrino-setup-{paths,before}`; when they were not,
keep them for the next run. The recap,
at most eight lines, in this order:

1. Where the blog lives: "`<folder>`, pushed to <owner/repo> on GitHub"
   (or "committed, not pushed yet" / "not committed yet"). Say "pushed"
   only when Phase 6's check found `blog-ops/config.yaml` and the profile
   docs on `origin/<base branch>`; a setup commit that left one of them out
   is "not committed yet", with the file named.
2. What setup took: from the start time in `setup-notes.md` to now,
   rounded to five minutes, with the wait for sign-ins excluded if it was
   long ("about 50 minutes, plus the time you spent signing in").
3. How a post reaches readers, one sentence from the `publish.site_live`
   and adapter answers ("Each post is a pull request on GitHub; merging it
   publishes once your site rebuilds" / "...uploads as a WordPress draft
   that you publish" / "...you paste into <Platform> before approving").
4. Competitors: "Fact sheets ready for <names>" or "Pilcrino will offer to
   research <names> the first time a post names them."
5. Anything the owner must still do, only if real (a placeholder domain to
   replace, a date-based permalink setting to change, a skipped sign-in,
   a declined draft switch meaning merged posts are live at once, and for
   a WordPress password kept in the settings file: "Before your first
   post: quit Claude Code, open a new Terminal window, and start Claude
   Code again in `<folder>`, so it can read your WordPress password"). Never
   a git task, never a file to edit by hand.
6. If the app was set up: "The Pilcrino app is at https://pilcrino.com;
   connect this folder from its dashboard."

Then print exactly:

```
Setup complete. Run `/pilcrino:blog-post-workflow new` to write your first post, or `/pilcrino:plan-content` to plan a batch of posts first (about 30 minutes, unattended).
```
