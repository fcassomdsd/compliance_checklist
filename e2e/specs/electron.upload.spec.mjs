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

    // The button reads "Uploading..." while the request is in flight and
    // "Upload" once it settles — both contain the substring "Upload", so
    // waiting on text alone races the actual upload. Wait for the disabled
    // (uploading) state, then for it to re-enable once isUploading flips
    // back to false in the store's `finally` block.
    await expect(window.locator('#exportUploadBtn')).toBeDisabled()
    await expect(window.locator('#exportUploadBtn')).toBeEnabled({ timeout: 10000 })

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

    await expect(window.locator('#exportUploadBtn')).toBeDisabled()
    await expect(window.locator('#exportUploadBtn')).toBeEnabled({ timeout: 10000 })

    await electronApp.close()

    const after = await getUploadStats()
    expect(after.inspectionUploadHits).toBe(before.inspectionUploadHits + 1)
  })
})
