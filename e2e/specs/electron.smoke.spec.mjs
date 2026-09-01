import { test, expect } from '@playwright/test'
import { importInspection, launchApp } from './helpers/electron-app.mjs'

test('imports inspection and renders checklist table', async () => {
  const { electronApp, window } = await launchApp()

  await importInspection(window, '0224', 'SUR')

  await expect(window.locator('#cklTable')).toBeVisible()
  await expect(window.locator('.controls-container span').filter({ hasText: 'Inspection: 0224' })).toBeVisible()
  await expect(window.locator('#workspaceSelect')).toHaveValue(/MDSD__SUR/i)

  await electronApp.close()
})
