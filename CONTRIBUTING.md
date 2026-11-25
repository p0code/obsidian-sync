# Contributing

This is the Obsidian shared-memory plugin for [p0code](https://github.com/p0code/p0code): it syncs a
shared agent memory folder through Obsidian Sync and tells every agent turn where that folder is.

Contributions are welcome — issues and small, focused PRs. I'm one busy person, so reviews and
replies can take a while. Please be patient and don't ping repeatedly; a single bump after a couple
of weeks is fine.

## Setup

This repo is mounted as the `plugins/obsidian-shared-memory` submodule of p0code and builds inside
that workspace (it imports `@t3tools/plugin-api` and `@t3tools/shared`):

```sh
git clone --recurse-submodules https://github.com/p0code/p0code
cd p0code
pnpm install
pnpm --filter @t3tools/plugin-obsidian-shared-memory typecheck
pnpm --filter @t3tools/plugin-obsidian-shared-memory test
```

## What makes a PR easy to land

- One thing per PR, with tests for behaviour changes.
- Conventional-commit-ish messages (`fix: ...`, `feat: ...`, `docs: ...`).
- No drive-by refactors or reformatting.
- Don't commit vault data, credentials or anything from a real Obsidian account.

## License

MIT. By contributing you agree that your work is released under the MIT license. See
[LICENSE](LICENSE).
