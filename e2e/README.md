# E2E Testing (Playwright + Electron)

This folder contains end-to-end tests for the desktop app, running against local mock API services.

## Prerequisites

1. Install dependencies:

```bash
npm install
npm run e2e:setup
```

2. Build the renderer once (Electron loads `dist/index.html`):

```bash
npm run build
```

## Run tests

```bash
npm run e2e
```

For headed mode:

```bash
npm run e2e:headed
```

## What is included

- `playwright.config.mjs`: Playwright test configuration.
- `global-setup.mjs` / `global-teardown.mjs`: starts and stops mock services on `localhost:1880` and `localhost:8000`.
	- setup temporarily rewrites `app.config.json` hosts to isolated E2E ports (`127.0.0.1:31880` import, `127.0.0.1:38000` upload)
	- teardown restores the original `app.config.json`
- `mock-server.mjs`: fixture-driven import/upload API stubs.
- `specs/electron.smoke.spec.mjs`: inspection import smoke flow.
- `specs/electron.followup.spec.mjs`: follow-up findings import flow.
- `specs/electron.upload.spec.mjs`: inspection upload success + non-OK flow.
- `specs/helpers/electron-app.mjs`: shared launch and journey helpers.
- `fixtures/*`: deterministic API payloads for import and follow-up scenarios.

## Scenarios

### 1) Inspection smoke journey (`electron.smoke.spec.mjs`)

1. app launch in Electron
2. opening import modal
3. inspection import (`0224`, `VIG`)
4. checklist table render
5. workspace selection update

### 2) Follow-up journey (`electron.followup.spec.mjs`)

1. switch to follow-up mode
2. import findings (`MDSD`, `VIG`)
3. verify follow-up table render

### 3) Upload journey (`electron.upload.spec.mjs`)

1. import inspection
2. finalize inspection
3. upload payload in `ok` mode
4. upload payload in `fail` mode
5. verify upload endpoint hit count through mock stats

## Mock server controls

The E2E mock server exposes deterministic control endpoints:

- `GET http://127.0.0.1:31880/__e2e__/upload-mode?value=ok|fail`
- `GET http://127.0.0.1:38000/__e2e__/stats`

These are used by tests to verify upload success and non-OK behavior without changing app config.

## GitLab CI strategy

The repository includes two CI jobs:

1. `e2e:smoke`: runs smoke + follow-up scenarios on merge requests and `develop`.
2. `e2e:full`: runs all E2E specs on the default branch.

Both jobs publish Playwright artifacts (`playwright-report`, `test-results`) on success and failure.
