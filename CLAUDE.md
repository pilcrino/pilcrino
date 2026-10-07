# Pilcrino plugin

This folder is the source of the Pilcrino plugin for Claude Code (public, MIT).

- Every change bumps `version` in `.claude-plugin/plugin.json` and adds an entry at the top of the Changelog in `README.md`, in the same branch, unasked.
- Run `./tests/lint.sh` before opening a pull request; CI runs it too.
- Releases are tags (`vX.Y.Z`). The Pilcrino app pins one tag into its own `plugin/` folder, so a change only reaches the app after a tag and a re-pin there.
- If you are reading this inside the app repository, under `plugin/`, you are looking at that pinned copy: do not edit it. Make the change in https://github.com/pilcrino/pilcrino, tag it, then run `scripts/pin-plugin.sh <tag>` in the app.
