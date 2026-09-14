import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { rename, rm } from 'node:fs/promises'

const runtimeDir = join(process.cwd(), 'e2e', '.runtime')
const appConfigPath = join(process.cwd(), 'app.config.json')
const e2eImportPort = 31880
const e2eUploadPort = 38000

function waitForMockServer(readyFile, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    const poll = () => {
      if (existsSync(readyFile)) {
        resolve()
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('Timed out waiting for E2E mock server startup'))
        return
      }
      setTimeout(poll, 100)
    }

    poll()
  })
}

export default async function globalSetup() {
  if (!existsSync(runtimeDir)) {
    mkdirSync(runtimeDir, { recursive: true })
  }

  const readyFile = join(runtimeDir, 'mock-server.ready')
  const pidFile = join(runtimeDir, 'mock-server.pid')
  const appConfigBackupFile = join(runtimeDir, 'app.config.backup.json')
  const stateBackupDir = join(runtimeDir, 'state-backup')

  if (!existsSync(stateBackupDir)) {
    mkdirSync(stateBackupDir, { recursive: true })
  }

  const currentInspectionDir = join(homedir(), 'Documents', 'Current_inspection')
  const workspaceDir = join(currentInspectionDir, 'MDSD_SUR')
  const registryFile = join(currentInspectionDir, 'workspaces.json')
  const backupWorkspaceDir = join(stateBackupDir, 'MDSD_SUR')
  const backupRegistryFile = join(stateBackupDir, 'workspaces.json')

  if (existsSync(backupWorkspaceDir)) {
    await rm(backupWorkspaceDir, { recursive: true, force: true })
  }
  if (existsSync(backupRegistryFile)) {
    await rm(backupRegistryFile, { force: true })
  }

  if (existsSync(workspaceDir)) {
    await rename(workspaceDir, backupWorkspaceDir)
  }
  if (existsSync(registryFile)) {
    await rename(registryFile, backupRegistryFile)
  }

  // The upload store's exportUploadPayload() blocks on an API-key prompt
  // modal whenever no key is on disk (readApiKey() -> null); a fresh CI
  // runner never has one, so electron.upload.spec.mjs's upload click would
  // hang on that modal forever instead of ever reaching the mock server.
  // Seed a fixture key so the prompt never appears.
  //
  // Electron's app.getPath('documents') is environment-dependent: on a
  // real desktop it's ~/Documents, but a minimal CI container with no
  // XDG user-dirs config falls back to bare $HOME (confirmed empirically
  // — the app's own workspace path showed up as /root/Current_inspection,
  // not /root/Documents/Current_inspection). Seed both candidates so the
  // fixture is found regardless of which one Electron resolves to here.
  const apiKeyRoots = [join(homedir(), 'Documents'), homedir()]
  for (const root of apiKeyRoots) {
    const dir = join(root, 'Current_inspection')
    const apiKeyFile = join(dir, 'api-key.json')
    const backupApiKeyFile = join(stateBackupDir, `api-key.${root === homedir() ? 'home' : 'documents'}.json`)

    if (existsSync(backupApiKeyFile)) {
      await rm(backupApiKeyFile, { force: true })
    }
    if (existsSync(apiKeyFile)) {
      await rename(apiKeyFile, backupApiKeyFile)
    }

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    await writeFile(apiKeyFile, JSON.stringify({ key: 'e2e-test-api-key' }, null, 2), 'utf8')
  }

  const appConfigRaw = await readFile(appConfigPath, 'utf8')
  await writeFile(appConfigBackupFile, appConfigRaw, 'utf8')

  const appConfig = JSON.parse(appConfigRaw)
  appConfig.api = appConfig.api || {}
  appConfig.api.host = `http://127.0.0.1:${e2eImportPort}`
  appConfig.api.importHost = `http://127.0.0.1:${e2eImportPort}`
  appConfig.api.uploadHost = `http://127.0.0.1:${e2eUploadPort}`
  // The mock stack has no Alfresco to sign the operator in against, so the
  // operator prompt is disabled for e2e; the real app config requires it.
  appConfig.identity = { ...(appConfig.identity || {}), requireOperator: false }
  await writeFile(appConfigPath, JSON.stringify(appConfig, null, 2), 'utf8')

  const child = spawn('node', ['e2e/mock-server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      E2E_READY_FILE: readyFile,
      E2E_IMPORT_PORT: String(e2eImportPort),
      E2E_UPLOAD_PORT: String(e2eUploadPort),
    },
    stdio: 'inherit',
  })

  process.env.E2E_MOCK_SERVER_PID = String(child.pid)

  await waitForMockServer(readyFile)

  process.stdout.write(`[e2e] mock services ready (pid=${child.pid})\n`)

  // Store PID for teardown process.
  await import('node:fs/promises').then((fs) => fs.writeFile(pidFile, String(child.pid), 'utf8'))
}
