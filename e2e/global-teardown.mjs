import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { rename } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'

export default async function globalTeardown() {
  const runtimeDir = join(process.cwd(), 'e2e', '.runtime')
  const appConfigPath = join(process.cwd(), 'app.config.json')
  const appConfigBackupFile = join(runtimeDir, 'app.config.backup.json')
  const pidFile = join(runtimeDir, 'mock-server.pid')
  const readyFile = join(runtimeDir, 'mock-server.ready')
  const stateBackupDir = join(runtimeDir, 'state-backup')

  if (existsSync(pidFile)) {
    try {
      const pidRaw = await readFile(pidFile, 'utf8')
      const pid = Number.parseInt(pidRaw.trim(), 10)
      if (Number.isFinite(pid)) {
        process.kill(pid, 'SIGTERM')
      }
    } catch {
      // Best-effort shutdown.
    }
  }

  if (existsSync(pidFile)) {
    await rm(pidFile)
  }
  if (existsSync(readyFile)) {
    await rm(readyFile)
  }

  if (existsSync(appConfigBackupFile)) {
    const backup = await readFile(appConfigBackupFile, 'utf8')
    await writeFile(appConfigPath, backup, 'utf8')
    await rm(appConfigBackupFile)
  }

  const currentInspectionDir = join(homedir(), 'Documents', 'Current_inspection')
  const workspaceDir = join(currentInspectionDir, 'MDSD_SUR')
  const registryFile = join(currentInspectionDir, 'workspaces.json')
  const backupWorkspaceDir = join(stateBackupDir, 'MDSD_SUR')
  const backupRegistryFile = join(stateBackupDir, 'workspaces.json')

  if (existsSync(backupWorkspaceDir) || existsSync(backupRegistryFile)) {
    await mkdir(currentInspectionDir, { recursive: true })
  }

  if (existsSync(backupWorkspaceDir)) {
    if (existsSync(workspaceDir)) {
      await rm(workspaceDir, { recursive: true, force: true })
    }
    await rename(backupWorkspaceDir, workspaceDir)
  }

  if (existsSync(backupRegistryFile)) {
    if (existsSync(registryFile)) {
      await rm(registryFile, { force: true })
    }
    await rename(backupRegistryFile, registryFile)
  }

  // Mirror of global-setup.mjs's dual-path API-key fixture seeding (see
  // the comment there for why both roots are needed).
  const apiKeyRoots = [join(homedir(), 'Documents'), homedir()]
  for (const root of apiKeyRoots) {
    const dir = join(root, 'Current_inspection')
    const apiKeyFile = join(dir, 'api-key.json')
    const backupApiKeyFile = join(stateBackupDir, `api-key.${root === homedir() ? 'home' : 'documents'}.json`)

    if (existsSync(backupApiKeyFile)) {
      await mkdir(dir, { recursive: true })
      if (existsSync(apiKeyFile)) {
        await rm(apiKeyFile, { force: true })
      }
      await rename(backupApiKeyFile, apiKeyFile)
    } else if (existsSync(apiKeyFile)) {
      // No pre-existing key was backed up, meaning global-setup's fixture
      // key is what's on disk — remove it rather than leaving a fake key
      // in place of whatever a real user would otherwise be prompted for.
      await rm(apiKeyFile, { force: true })
    }
  }
}
