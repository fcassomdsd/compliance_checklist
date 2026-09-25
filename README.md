# Compliance Checklist App

[![CI](https://github.com/fcassomdsd/compliance_checklist/actions/workflows/ci.yml/badge.svg)](https://github.com/fcassomdsd/compliance_checklist/actions/workflows/ci.yml)

**The Cross-Platform Desktop Solution for Field Compliance Inspections.**

Maximize efficiency and ensure data integrity for your operational safety inspectors with a dedicated, offline-capable desktop application. Built with **Electron**, **Vue 3**, and a **Node.js** backend.

---

## 🚀 Features

- 🖥️ **Desktop First:** Cross-platform application (Windows, Linux, macOS) powered by Electron.
- ✅ **Guaranteed Data Integrity:** Real-time **JSON schema validation** using **Ajv** ensures all checklists meet regulatory standards before saving.
- 💾 **Robust State Management:** Modular, reactive state handling for checklists, evidence, findings, and sessions via **Pinia**.
- 📄 **PDF Report Generation:** Produces structured findings reports using **PDFKit**.
- 📦 **ZIP Export:** Packages inspection payloads (checklist + evidence) into ZIP archives via **JSZip** for upload.
- 🪵 **Structured Auditing:** Integrated **Winston** logging for comprehensive and structured application and inspection activity logs.
- 🔔 **Non-Intrusive Feedback:** User notifications and confirmations delivered via **Vue-Toastification**.
- ⚙️ **Node.js Integration:** Seamless file system and native OS functionality access via the Node.js backend.

---

## 🏗 Architecture

The checklist app is an offline-first Electron application that interacts with backend services before and after field work:

```
┌─────────────────────┐      ┌──────────────────┐      ┌────────────────┐
│ compliance_checklist│      │    Node-RED      │      │   AtroCRM /    │
│    (Electron app)   │──────│   (port 1880)    │──────│   AtroCore      │
│                     │      │  middleware       │      │                 │
│  • Import checklist │      │  • /checklist     │      │  • Inspection   │
│  • Fill responses   │      │  • /findings/open │      │  • Specialties  │
│  • Collect evidence │      │  • /specialties   │      │  • Locations    │
│  • Generate PDF     │      │  • /location      │      │  • Protocol Qs  │
│  • Export ZIP       │      │  • /importCanonical│    │  • Inspectors   │
└─────────┬───────────┘      │  • /inspectionPlan│      └────────────────┘
          │                  │  • /inspectionRpt │
          │ upload           └────────┬─────────┘
          ▼                           │ Alfresco
┌─────────────────────┐              │ imports
│  compliance_import  │              ▼
│    (port 8000)      │      ┌────────────────┐
│                     │      │    Alfresco    │
│  • /inspection-imp  │      │   (port 8080)  │
│  • /followup-import │      │   Document     │
└─────────────────────┘      │   Store        │
                             └────────────────┘
```

- **Node-RED** decouples the app from AtroCRM and Alfresco — all data queries go through it
- **compliance_import** receives finalized ZIP payloads and uploads to Alfresco
- The app stores workspaces locally under `~/Documents/Current_inspection/` for full offline capability
- API health is polled every 30 seconds; the app degrades gracefully to fallback data when offline

---

## 🧭 Project Structure

The project follows a modular approach for clear separation of concerns:

| Directory              | Purpose                                                                                                                             |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `/src/components`      | Reusable Vue components (e.g., `ChecklistTable`, `ChecklistRow`).                                                                   |
| `/src/stores`          | Pinia modules for application state (e.g., `checklistStore`, `evidenceStore`, `sessionStore`, `followUpStore`, `audioStore`).       |
| `/src/utils`           | Utility modules: `fileServices.js` (file I/O, workspace management), `checklist.js`, `findings.js`, `session.js`, `followUpSession.js`. |
| `/electron`            | Electron main process (`main.mjs`), preload script (`preload.cjs`), IPC handlers (`ipc/`), and backend utilities (`utils/`).        |
| `/electron/__tests__`  | Unit tests for Electron-side modules (file operations, security, IPC, PDF generation).                                              |
| `/src/__tests__`       | Unit tests for Vue components, Pinia stores, and renderer-side utilities.                                                           |
| `/e2e`                 | End-to-end Playwright tests with fixture-driven mock API stubs. See [e2e/README.md](e2e/README.md).                                 |
| `/logs`                | Directory where Winston saves structured application and inspection logs.                                                           |
| `app.config.json`      | Runtime configuration file — API endpoints, timeouts, and fallback data. See [Configuration](#%EF%B8%8F-configuration) below.       |

---

## 🛠️ Getting Started

### Prerequisites

- Node.js **18+**
- npm

### Installation

```bash
# Clone the repository
git clone https://gitlab.com/safety-app2/compliance_checklist.git
cd compliance_checklist

# Install dependencies
npm install
```

### Running in Development

```bash
# Start Vite dev server (renderer only)
npm run dev
```

> **Note:** To run the full Electron app in development, start Vite first, then launch Electron with `npm start`.

### Running Tests

```bash
# Run all unit and integration tests (Vitest)
npm test

# Run tests with the interactive Vitest UI
npm run test:ui

# Generate a coverage report
npm run test:coverage
```

### End-to-End Tests (Playwright)

E2E tests run against the built app with a local mock API. See [e2e/README.md](e2e/README.md) for full details.

```bash
# One-time setup: install Playwright browsers
npm run e2e:setup

# Build the renderer (required before each E2E run)
npm run build

# Run E2E tests (headless)
npm run e2e

# Run E2E tests in headed mode
npm run e2e:headed
```

### Building for Distribution

```bash
# Build the Vue renderer bundle
npm run build

# Package a portable Windows executable (x64)
npm run build:win-portable

# Package a macOS DMG (universal)
npm run build:mac-portable
```

Output is placed in `dist-portable/`. The `productName` is **Aviation Safety Oversight Checklist** as defined in `electron-builder.config.js`.

**Version identity:** the artifact version comes from `package.json` (`version: "1.0.0a"`), which electron-builder stamps into the packaged bundle filename and metadata. The `app.name`/`app.version` keys in `app.config.json` are display-only runtime values (shown in the UI), not the artifact version — do not read the packaged version from them. Releases themselves are CalVer-dated tags (see CONTRIBUTING.md, "Versioning and releases"); the `x.y.z` labels in the historical CHANGELOG headings (`1.2.0-alpha`, `1.0.0a candidate`, …) predate that scheme and are not the current package version.

---

## 🌐 Whole-Platform Demo Quickstart

First time running this platform? See the root-level
[`GETTING_STARTED_FOR_ADOPTERS.md`](../GETTING_STARTED_FOR_ADOPTERS.md) for hardware
requirements, timing expectations, and what the demo dataset actually is before diving in.

This app is offline-first and falls back to bundled data, so it runs without a
backend — but to see uploads land in Alfresco and travel through the full
finding-closure workflow, bring up the platform first. The canonical
clean-clone-to-demonstrable sequence lives in the `atrocore-docker` repository:
§7 of `../atrocore-docker/docs/COMPLIANCE_INTEGRATION_RUNBOOK.md`
("Demo Quickstart — clean clone to a demonstrable system"), executable as
`atrocore-docker/scripts/demo-quickstart.sh`. Point this app's
`app.config.json` at the Node-RED (`:1880`) and import (`:8000`) endpoints it
prints.

---

## ⚙️ Configuration

Runtime settings are read from **`app.config.json`** in the project root. This file must be present when running or packaging the app.

```jsonc
{
  "app": {
    "name": "Compliance Checklist",
    "version": "1.0.0"
  },
  "api": {
    "_comment_host": "Node-RED middleware (port 1880) — checklist, findings, specialties, locations, import triggers",
    "host": "http://localhost:1880",
    "importHost": "http://localhost:1880",
    "_comment_uploadHost": "compliance_import service (port 8000) — inspection and follow-up ZIP uploads",
    "uploadHost": "http://localhost:8000",
    "importCanonicalDelay": 3000,
    "importCanonicalRetries": 3,
    "serviceStatusTimeoutMs": 2500
  },
  "identity": {
    "requireOperator": true,
    "inspectorsPath": "/inspectors"
  },
  "reportHeader": {
    "entityName":     { "es": "AUTORIDAD DE AVIACIÓN CIVIL", "en": "CIVIL AVIATION AUTHORITY" },
    "entitySubtitle": { "es": "VIGILANCIA DE LA SEGURIDAD OPERACIONAL", "en": "OPERATIONAL SAFETY OVERSIGHT" },
    "logoPath": "public/images/compliance-logo.png",
    "docControlVersion": "",
    "docControlDate": ""
  },
  "fallback": {
    "specialties": [ ... ],  // Used when the import service is offline
    "locations":   [ ... ]   // Used when the import service is offline
  }
}
```

### API Key

`compliance_flow` (checklist reads, entity CRUD) and `compliance_import` (ZIP uploads) both gate
their REST endpoints with an `X-API-Key` header when their `API_KEY`/`IMPORT_API_KEY` env vars are
set — which they are by default in the current `.env.example` templates (a demo placeholder value
that must be rotated before any real deployment, and must be identical across both services). The
app stores a **single** key, prompted for on first upload, locally in
`~/Documents/Current_inspection/api-key.json`, and sends it as `X-API-Key` on every request to both
services (`src/utils/fileServices.js`'s `flowApiKeyHeaders()`) — not just uploads. If the deployment
does not require a key (gateway auth disabled for local development), leave the prompt empty and
click Cancel; every request then goes out bare, matching an unguarded dev stack.

When running E2E tests, `global-setup.mjs` temporarily rewrites `app.config.json` to point to isolated local test ports and restores it on teardown.

### Findings report header

The PDF findings report (`electron/utils/pdfGenerator.js`) is generated locally in the Electron main process — it never talks to Alfresco — so its header branding comes from its own `app.config.json` `reportHeader` block, not from `compliance_cmis`'s `entity-profile.json`. `entityName` and `entitySubtitle` are locale-keyed (the report's `locale` selects the line, falling back to `es`/`en`); `logoPath` names the image (resolved relative to the app root, or from the packaged `assets/images/` resources folder); `docControlVersion` and `docControlDate` are optional and **blank by default** — a blank version renders nothing, and a blank date falls back to the day the report was generated. The generic logo shipped here (`public/images/compliance-logo.png`) is the same one the web app and the `compliance_cmis` report templates use, so an adopting authority can point `logoPath` at its own file. The report *title* ("Reporte de Hallazgos" / "Findings Report") lives in the `labels.en`/`labels.es` table in `pdfGenerator.js`.

### Locale Preference

The app supports English and Spanish (`vue-i18n` in the renderer, `src/i18n/`). Unlike `app.config.json` above, the user's locale choice is a runtime preference, not deployment config — it's stored separately in a small `settings.json` file under Electron's `userData` directory (not the project root), managed by `electron/utils/userSettings.js`.

- Resolution order on startup: a saved preference in `settings.json` → the OS locale (`app.getLocale()`) collapsed to `en`/`es` → `en` fallback.
- The renderer reads/writes it via two IPC channels exposed on the preload bridge: `settings:getLocale` and `settings:setLocale`. A toggle in `App.vue`'s header calls these.
- `CHECKLIST_FORCE_LOCALE` (env var, `en` or `es`) overrides everything above — used by the Playwright e2e suite (`e2e/specs/helpers/electron-app.mjs`) to pin the locale deterministically, since guessing Electron's `userData` path from the test process isn't reliable.
- The PDF findings report (`electron/utils/pdfGenerator.js`) takes the current locale as a parameter and looks up its strings from a `labels.en`/`labels.es` table in the same file.

---

## 📜 Available Scripts

| Script                   | Description                                              |
| :----------------------- | :------------------------------------------------------- |
| `npm start`              | Launch Electron directly (requires a prior `npm run build`) |
| `npm run dev`            | Start the Vite development server (renderer only)        |
| `npm run build`          | Build the Vue renderer bundle to `dist/`                 |
| `npm run build:win-portable` | Package a portable Windows x64 executable            |
| `npm run build:mac-portable` | Package a macOS universal DMG                        |
| `npm test`               | Run all unit tests with Vitest                           |
| `npm run test:ui`        | Run Vitest with the interactive browser UI               |
| `npm run test:coverage`  | Run tests and generate a V8 coverage report              |
| `npm run e2e`            | Run Playwright end-to-end tests                          |
| `npm run e2e:headed`     | Run E2E tests in headed (visible browser) mode           |
| `npm run e2e:setup`      | Install Playwright browsers and dependencies             |
| `npm run lint`           | Lint source files with ESLint                            |
| `npm run lint:fix`       | Lint and auto-fix fixable issues                         |
| `npm run format`         | Format all files with Prettier                           |

---

## 🔀 Branching Model

This project uses a Gitflow-inspired workflow:

| Branch      | Purpose                                                   |
| :---------- | :-------------------------------------------------------- |
| `main`      | Stable, production-ready code                             |
| `develop`   | Active development — **all MRs should target this branch** |
| `feature/*` | New features (e.g., `feature/add-audio-notes`)            |
| `fix/*`     | Bug fixes (e.g., `fix/ui-freeze`)                         |
| `release/*` | Release preparation                                       |
| `hotfix/*`  | Urgent patches to `main`                                  |

---

## 🔗 Alfresco Integration Notes

> Relevant only if integrating with the Alfresco backend document model.

- Finding issue date uses `dateIssued` as the canonical field name across the app, API payloads, and Pinia stores.
- The Alfresco model property was renamed from `vso:openedDate` to `vso:dateIssued` for consistency across model, forms, and messaging.

---

## 🧩 Contributing

We welcome contributions! Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on setting up your environment, code style, and submitting a Merge Request.

---

## 📄 License

Copyright 2026 Fernando A. Casso Rodriguez

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for the full license text.
