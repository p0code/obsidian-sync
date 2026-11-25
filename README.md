# Obsidian shared memory (p0code plugin)

An off-by-default [p0code](https://github.com/p0code/p0code) server plugin. It syncs a shared agent memory folder through Obsidian Sync with [Obsidian Headless](https://obsidian.md) (`ob`, Node 22+), and adds a short block to every agent turn naming that folder and the shared agent identity, so agents on all your machines read and add to the same notes.

Turn it on under **Settings → Plugins**, sign in to Obsidian, then pick a vault.

This repository ([p0code/obsidian-sync](https://github.com/p0code/obsidian-sync)) is mounted as the `plugins/obsidian-shared-memory` git submodule of p0code and built inside that workspace, where it imports `@t3tools/plugin-api`, `@t3tools/contracts` and `@t3tools/shared`. Develop it from a p0code checkout:

```sh
git clone --recurse-submodules https://github.com/p0code/p0code
cd p0code && pnpm install
pnpm --filter @t3tools/plugin-obsidian-shared-memory typecheck
```
