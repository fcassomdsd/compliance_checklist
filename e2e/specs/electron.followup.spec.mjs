import { test, expect } from '@playwright/test'
import { importFollowUp, launchApp } from './helpers/electron-app.mjs'

test('imports follow-up findings and renders follow-up table', async () => {
  const { electronApp, window } = await launchApp()

  await importFollowUp(window, 'MDSD', 'VIG')

  await expect(window.locator('#followupTable')).toBeVisible()
  await expect(window.locator('text=MDSD-VIG-2026-0001')).toBeVisible()

  await electronApp.close()
})
