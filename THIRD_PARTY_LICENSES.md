# Third-party licenses

This repository is licensed under Apache License 2.0 for original project code and documentation.

Runtime dependencies used by this project are provided by third parties and remain under their respective licenses and terms. This is a desktop Electron application — there is no `docker-compose.yml`/container image to track here.

## npm dependencies (production, scanned with `license-checker --production`)

98 resolved packages. License breakdown: **86 MIT, 3 Apache-2.0, 2 BSD-3-Clause, 2 ISC, 1 BSD-2-Clause, 1 (MIT AND Zlib), 1 MIT\*, 1 0BSD**, plus one dual-licensed package below. **No unconditional copyleft dependencies found.**

- **`jszip@3.10.1` — `(MIT OR GPL-3.0-or-later)`.** Dual-licensed; this project uses it under the **MIT** option, so no GPL obligations attach. Worth a one-line note in this repo's own license notices if that choice is ever formalized.
- `pako@1.0.11` — `(MIT AND Zlib)`, both permissive.
- `electron@37.4.0` (devDependency, bundled into the packaged app) — **MIT**.

Regenerate the full list with: `npx license-checker --production --csv` (or `--summary` for just the counts). Re-run after any `package.json` dependency change, and especially before packaging a release (`electron-builder` itself and its bundled Chromium/Node runtime carry their own — permissive — licenses not re-scanned here; see [electron.build](https://www.electronjs.org/docs/latest/tutorial/licensing) for what that covers).

## How to maintain this file

1. Add new third-party libraries when introduced.
2. Record version numbers used in this repository.
3. Link to the canonical license source where possible.
4. Preserve required attribution and notice text when redistributing.

## Important note

This file is an operational tracking document, not legal advice.
For commercial redistribution or productization, perform a legal review of all third-party license obligations.
