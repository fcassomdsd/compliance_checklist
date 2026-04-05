import { expect, _electron as electron } from '@playwright/test'
import { join } from 'node:path'

const E2E_IMPORT_BASE = 'http://127.0.0.1:31880'
const E2E_UPLOAD_BASE = 'http://127.0.0.1:38000'

export async function launchApp() {
  const electronApp = await electron.launch({
    args: [join(process.cwd(), 'electron', 'main.mjs')],
  })
  const window = await electronApp.firstWindow()

  await expect(
    window.getByRole('heading', { name: 'Operational Safety Compliance Checklist' })
  ).toBeVisible()

  return { electronApp, window }
}

export async function importInspection(window, inspectionCode = '0224', specialtyCode = 'VIG') {
  await window.locator('#modeSelect').selectOption('inspection')
  await window.locator('#openImportModalBtn').click()
  await window.locator('#importInspection').fill(inspectionCode)
  await window.locator('#importSpecialty').selectOption(specialtyCode)
  await window.locator('#importDataBtn').click()
}

export async function importFollowUp(window, locationIcao = 'MDSD', specialtyCode = 'VIG') {
  await window.locator('#modeSelect').selectOption('followUp')
  await window.locator('#openImportModalBtn').click()
  await window.locator('#importLocation').selectOption(locationIcao)
  await window.locator('#importSpecialty').selectOption(specialtyCode)
  await window.locator('#importDataBtn').click()
}

export async function finalizeInspection(window) {
  await window.locator('#finalizeBtn').click()
  await window.getByRole('button', { name: 'Yes, Continue' }).click()
}

export async function setUploadMode(mode) {
  const url = `${E2E_IMPORT_BASE}/__e2e__/upload-mode?value=${encodeURIComponent(mode)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to set upload mode (${mode}): status ${response.status}`)
  }
}

export async function getUploadStats() {
  const response = await fetch(`${E2E_UPLOAD_BASE}/__e2e__/stats`)
  if (!response.ok) {
    throw new Error(`Failed to get upload stats: status ${response.status}`)
  }
  return response.json()
}
