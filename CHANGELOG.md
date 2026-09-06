## 2026-09-05 (Release 1.2.0-alpha)

### Added
- **English/Spanish localization**: renderer strings, ~80 toast messages, and the findings PDF report are now locale-aware via `vue-i18n` and a new `labels.en`/`labels.es` table in `pdfGenerator.js`. See "Locale Preference" in `README.md`.
- **Locale persistence**: new `electron/utils/userSettings.js` (a `settings.json` file under Electron's `userData` dir) and `settings:getLocale`/`settings:setLocale` IPC channels, with a toggle in `App.vue`'s header.
- **`CHECKLIST_FORCE_LOCALE`**: env var to pin the locale during e2e runs.

### Fixed
- **Modal dispatch bug**: `checklistStore.js`'s modal logic switched on the *translated* modal title string, which would have silently broken once that string changed by locale. Now switches on a stable `activeModalKey`.
- **CI lint crash**: `eslint-plugin-vue`'s `flat/essential` config carries rule sets with no `files` restriction, so adding the new `src/i18n/locales/*.json` resources took down the whole lint stage (`vue-eslint-parser` has no script-setup context for JSON). Scoped every `flat/essential` sub-config to `*.vue`; also added a proper Node-globals block for `electron/**` (main-process code), surfacing and fixing a real `process is not defined` error the crash had been masking.

## 2026-08-02 (Release 1.1.0-alpha)

### Added
- **Provider selection in import modal**: Single dropdown showing Inspection/Provider combinations (e.g., "MDPP-001 / Aeropuertos Dominicanos"). Fetched from new `/inspectionProvider` Node-RED endpoint. Replaces separate text input + provider dropdown.
- **IDs-based API calls**: Checklist import and canonical import now pass `inspectionId`, `inspectedProviderId`, and `siteVisitId` (was `code` + `provider`). Removes ambiguity of shared inspection codes across providers.
- **Interviewee field in session summary**: New textarea below general comments for capturing interviewee names per specialty. Persisted in `session.json`.
- **Regulation title/item separation**: `nationalRegulation` and `regulationItem` now stored separately in canonical JSON (was concatenated). Both added to checklist and finding schemas.
- **`fetchInspectionProviders()`**: New function calling `GET /inspectionProvider?status=Uploaded` on Node-RED.
- **`fetchChecklistFromApi` provider param**: Optional third parameter `ids` object (`{ inspectedProviderId, siteVisitId }`) passed as URL params.
- **`notifyImportCanonical` provider param**: Same `ids` object added for canonical import calls.

### Changed
- **Import flow**: Site Visit text input replaced with dropdown of pre-Uploaded inspections. Providers auto-populate on selection.
- **API endpoint aliases**: `/checklist` and `/importCanonical` now accept `inspectionId`, `siteVisitId`, `inspectedProviderId` params.
- **Workspace key unchanged**: Location + Speciality key still works since a specialty at a location maps to one provider.

### Fixed
- Fixed `specialtyCode` variable scoping bug in `onImportData` regression.
- Fixed `fetchFindingsFromApi` error message typo ("find" → "fetch").

## 2026-08-01 (Release 1.0.1)

### Added
- API key support for secured upload service (prompt on first upload, stored locally)
- IPC handlers for API key persistence (read/save to api-key.json)
- X-API-Key header on all upload fetch calls
- Alfresco credential storage IPC handlers for future credential forwarding
- Finding severity selector (A/B/C) in non-conformity modal with days-to-solution labels
- Severity config caching from Node-RED API in app.config.json
- write-app-config IPC handler for persisting configuration
- Residual risk dropdown (Low/Medium/High/Critical) in follow-up table
- Readme architecture diagram showing data flow across all services

### Fixed
- Checklist removal now deletes findings.json, follow-up artifacts before directory check
- UI state cleared immediately after checklist removal (no stale data)
- Checklist removal now works for standalone inspections even with leftover follow-up artifacts

### Changed
- Severity defaults to C for new findings, restored from session for existing ones
- Residual risk defaults to finding's riskClassification

## 2026-05-23 (Release 1.0.0a candidate)

- Scope: prepare merge from `develop` to `main`.
- Delta snapshot: 68 commits ahead of `main` (50 non-merge commits).

### Added

- Follow-up workflow expansion with CAP handling, typed verification workflow, evidence roles, and delayed callback payload support.
- Workspace-based follow-up flow, canonical import flow improvements, and upload progress state handling.
- Checklist/schema enhancements: support item-code keyed sessions, multi-evidence payloads, provider metadata, structured checklist references, and nullable ICAO reference.
- IPC/export improvements: completion date export, follow-up files in export response, named import payload handling, and contract-aligned payload schema updates.
- End-to-end Playwright Electron smoke/follow-up/upload suite and associated CI additions.

### Changed

- Alignment of Alfresco/export contracts, including standardized IDs and payload nomenclature.
- README documentation expanded with project structure, scripts, configuration, and end-to-end testing guidance.
- License updated to Apache-2.0.

### Fixed

- Follow-up export compatibility for flat findings and fallback finding IDs.
- Session removal and state-reset behaviors, including missing evidence directory handling.
- Workspace/session path handling for media, report generation, and checklist visibility across specialty switches.
- Open-file IPC robustness with improved error handling, timeout control, and logging.
- Schema and validation fixes for checklist ID patterns, risk-level normalization, and follow-up risk/domain sanitization.

## 2026-04-14

- Model update: renamed finding property `vso:openedDate` to `vso:dateIssued` in the Alfresco model for naming uniformity.
- Contract note: integrations and payload mappings should use `dateIssued` as the canonical field name for finding issue date.

