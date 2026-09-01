import { test, expect } from '@playwright/test'
import {
  finalizeInspection,
  getUploadStats,
  importInspection,
  launchApp,
  setUploadMode,
} from './helpers/electron-app.mjs'

test.describe('inspection upload', () => {
  test.beforeEach(async () => {
    await setUploadMode('ok')
  })

  test('uploads finalized inspection payload successfully', async () => {
    const before = await getUploadStats()

    const { electronApp, window } = await launchApp()

    await importInspection(window, '0224', 'SUR')
    await finalizeInspection(window)

    await expect(window.locator('#exportUploadBtn')).toBeEnabled()
    await window.locator('#exportUploadBtn').click()

    await expect(window.locator('#exportUploadBtn')).toContainText('Upload')

    await electronApp.close()

    const after = await getUploadStats()
    expect(after.inspectionUploadHits).toBe(before.inspectionUploadHits + 1)
  })

  test('attempts upload and receives non-OK response from upload service', async () => {
    await setUploadMode('fail')
    const before = await getUploadStats()

    const { electronApp, window } = await launchApp()

    await importInspection(window, '0224', 'SUR')
    await finalizeInspection(window)

    await expect(window.locator('#exportUploadBtn')).toBeEnabled()
    await window.locator('#exportUploadBtn').click()

    await expect(window.locator('#exportUploadBtn')).toContainText('Upload')

    await electronApp.close()

    const after = await getUploadStats()
    expect(after.inspectionUploadHits).toBe(before.inspectionUploadHits + 1)
  })
})
