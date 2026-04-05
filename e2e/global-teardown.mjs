import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export default async function globalTeardown() {
  const runtimeDir = join(process.cwd(), 'e2e', '.runtime')
  const appConfigPath = join(process.cwd(), 'app.config.json')
  const appConfigBackupFile = join(runtimeDir, 'app.config.backup.json')
  const pidFile = join(runtimeDir, 'mock-server.pid')
  const readyFile = join(runtimeDir, 'mock-server.ready')

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
}
