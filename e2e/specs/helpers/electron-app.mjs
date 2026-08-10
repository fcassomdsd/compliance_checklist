import { expect, _electron as electron } from '@playwright/test'
import { join } from 'node:path'

const E2E_IMPORT_BASE = 'http://127.0.0.1:31880'
const E2E_UPLOAD_BASE = 'http://127.0.0.1:38000'

async function dismissBlockingModal(window) {
  const blockingOverlay = window.locator('.modal-overlay').first()
  if (!(await blockingOverlay.isVisible())) {
    return
  }

  const cancelBtn = window.getByRole('button', { name: 'Cancel' })
  if (await cancelBtn.first().isVisible()) {
    await cancelBtn.first().click()
    await expect(blockingOverlay).toBeHidden()
  }
}

async function ensureReadyForImport(window) {
  await expect(window.locator('#modeSelect')).toBeVisible()
  await expect(window.locator('#openImportModalBtn')).toBeVisible()
  await dismissBlockingModal(window)
}

export async function launchApp() {
  const electronApp = await electron.launch({
    args: [join(process.cwd(), 'electron', 'main.mjs')],
  })
  const window = await electronApp.firstWindow()

  await expect(
    window.getByRole('heading', { name: 'Operational Safety Compliance Checklist' })
  ).toBeVisible()

  await ensureReadyForImport(window)

  return { electronApp, window }
}

export async function importInspection(window, inspectionCode = '0224', specialtyCode = 'VIG') {
  const expectedWorkspaceKey = `MDSD__${specialtyCode.toUpperCase()}`

  const ensureWorkspaceLoaded = async () => {
    const workspaceSelect = window.locator('#workspaceSelect')
    const matchingOption = workspaceSelect.locator(`option[value="${expectedWorkspaceKey}"]`)
    if ((await matchingOption.count()) == 0) {
      return false
    }

    await workspaceSelect.selectOption(expectedWorkspaceKey)
    try {
      await expect(window.locator('#cklTable')).toBeVisible({ timeout: 2000 })
      return true
    } catch {
      return false
    }
  }

  await ensureReadyForImport(window)
  await window.locator('#modeSelect').selectOption('inspection')
  await dismissBlockingModal(window)

  if (await ensureWorkspaceLoaded()) {
    return
  }

  await window.locator('#openImportModalBtn').click()
  // Wait for inspection provider options to load, then select the first one
  const importSelect = window.locator('#importInspection')
  await expect(importSelect.locator('option[value]').last()).toBeAttached({ timeout: 5000 })
  await importSelect.selectOption({ index: 1 })  // first non-empty option
  await window.locator('#importSpecialty').selectOption(specialtyCode)
  await window.locator('#importDataBtn').click()

  if (await ensureWorkspaceLoaded()) {
    return
  }

  await expect(window.locator('#cklTable')).toBeVisible()
}

export async function importFollowUp(window, locationIcao = 'MDSD', specialtyCode = 'VIG') {
  const expectedWorkspaceKey = `${locationIcao.toUpperCase()}__${specialtyCode.toUpperCase()}`

  const ensureWorkspaceLoaded = async () => {
    const workspaceSelect = window.locator('#workspaceSelect')
    const matchingOption = workspaceSelect.locator(`option[value="${expectedWorkspaceKey}"]`)
    if ((await matchingOption.count()) == 0) {
      return false
    }

    await workspaceSelect.selectOption(expectedWorkspaceKey)
    try {
      await expect(window.locator('#followupTable')).toBeVisible({ timeout: 2000 })
      return true
    } catch {
      return false
    }
  }

  await ensureReadyForImport(window)
  await window.locator('#modeSelect').selectOption('followUp')
  await dismissBlockingModal(window)

  if (await ensureWorkspaceLoaded()) {
    return
  }

  await window.locator('#openImportModalBtn').click()
  await window.locator('#importLocation').selectOption(locationIcao)
  await window.locator('#importSpecialty').selectOption(specialtyCode)
  await window.locator('#importDataBtn').click()

  if (await ensureWorkspaceLoaded()) {
    return
  }

  await expect(window.locator('#followupTable')).toBeVisible()
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
