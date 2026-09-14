import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { app } from 'electron'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * The copy shipped with the application.
 *
 * electron-builder previously excluded app.config.json entirely, so a packaged
 * build started with an empty config and silently fell back to localhost hosts
 * and empty fallback data.
 */
export function bundledAppConfigPath() {
  if (app.isPackaged && process.resourcesPath) {
    return path.join(process.resourcesPath, 'app.config.json')
  }
  return path.join(moduleDir, '..', '..', 'app.config.json')
}

/**
 * The writable copy. A packaged app cannot write beside itself (app.asar is
 * read-only), so runtime state lives under the user data directory. Development
 * keeps using the repository copy.
 */
export function writableAppConfigPath() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'app.config.json')
  }
  return path.join(moduleDir, '..', '..', 'app.config.json')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Preference order for reads: the writable copy, then the bundled default.
 */
export async function resolveReadableAppConfigPath() {
  const writable = writableAppConfigPath()
  if (await exists(writable)) {
    return writable
  }

  const bundled = bundledAppConfigPath()
  if (await exists(bundled)) {
    return bundled
  }

  return writable
}
