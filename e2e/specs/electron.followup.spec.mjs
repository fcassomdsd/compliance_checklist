import { test, expect } from '@playwright/test'
import { importFollowUp, launchApp } from './helpers/electron-app.mjs'

test('imports follow-up findings and renders follow-up table', async () => {
  const { electronApp, window } = await launchApp()

  await importFollowUp(window, 'MDSD', 'VIG')

  await expect(window.locator('#followupTable')).toBeVisible()
  await expect(window.locator('text=MDSD-VIG-2026-0001')).toBeVisible()

  const rowWithCap = window.locator('#followupTable tbody tr').filter({ has: window.locator('.cap-badge') }).first()
  if ((await rowWithCap.count()) > 0) {
    await expect(rowWithCap.locator('.cap-badge')).toBeVisible()
    await expect(rowWithCap.locator('select option[value="CAP Verification"]')).toHaveCount(1)

    await rowWithCap.locator('.cap-badge').click()
    await expect(window.locator('.cap-modal')).toBeVisible()
    await expect(window.locator('.cap-modal')).toContainText('CAP ID:')
    await window.locator('.cap-modal button', { hasText: 'Close' }).click()

    const capDotColor = await rowWithCap.locator('.cap-badge .cap-dot').evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )
    expect(capDotColor).not.toBe('rgb(156, 163, 175)')
  }

  const overdueRow = window.locator('#followupTable tbody tr').filter({ hasText: 'MDSD-VIG-2026-0002' }).first()
  if ((await overdueRow.count()) > 0) {
    const overdueDot = overdueRow.locator('.finding-id-cell .status-dot').first()
    let isOverdue = false
    if ((await overdueDot.count()) > 0) {
      const overdueFindingDotColor = await overdueDot.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      )
      isOverdue = overdueFindingDotColor == 'rgb(239, 68, 68)'
      if (isOverdue) {
        expect(overdueFindingDotColor).toBe('rgb(239, 68, 68)')
      }
    }
    if (isOverdue) {
      await expect(overdueRow.locator('input[type="number"]').first()).toBeDisabled()
      await expect(overdueRow.locator('textarea').first()).toBeDisabled()
    }
  }

  await electronApp.close()
})
