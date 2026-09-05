import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'

const SUPPORTED_LOCALES = ['en', 'es']
const DEFAULT_LOCALE = 'en'

function normalizeLocale(value) {
  const short = String(value || '').slice(0, 2).toLowerCase()
  return SUPPORTED_LOCALES.includes(short) ? short : null
}

function settingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

async function readUserSettings() {
  try {
    const raw = await fs.readFile(settingsFilePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed == 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writeUserSettings(settings) {
  const existing = await readUserSettings()
  const merged = { ...existing, ...settings }
  await fs.writeFile(settingsFilePath(), JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

// Test-only override: lets Playwright e2e runs pin the locale without
// depending on Electron's userData path or OS locale, which can't be
// controlled reliably from the test process. See e2e/specs/helpers/electron-app.mjs.
async function getLocale() {
  if (process.env.CHECKLIST_FORCE_LOCALE) {
    return normalizeLocale(process.env.CHECKLIST_FORCE_LOCALE) || DEFAULT_LOCALE
  }
  const settings = await readUserSettings()
  if (settings.locale) {
    const normalized = normalizeLocale(settings.locale)
    if (normalized) {
      return normalized
    }
  }
  return normalizeLocale(app.getLocale()) || DEFAULT_LOCALE
}

async function setLocale(locale) {
  const normalized = normalizeLocale(locale) || DEFAULT_LOCALE
  await writeUserSettings({ locale: normalized })
  return normalized
}

export { readUserSettings, writeUserSettings, getLocale, setLocale, normalizeLocale, DEFAULT_LOCALE }
