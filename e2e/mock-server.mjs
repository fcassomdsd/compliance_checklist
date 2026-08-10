import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const importPort = Number.parseInt(process.env.E2E_IMPORT_PORT || '1880', 10)
const uploadPort = Number.parseInt(process.env.E2E_UPLOAD_PORT || '8000', 10)
const readyFile = process.env.E2E_READY_FILE

const fixturesDir = join(process.cwd(), 'e2e', 'fixtures')

async function loadJson(name) {
  const content = await readFile(join(fixturesDir, name), 'utf8')
  return JSON.parse(content)
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function createImportServer() {
  const specialties = await loadJson('specialties.json')
  const locations = await loadJson('locations.json')
  const checklist = await loadJson('checklist.vig.0224.json')
  const findings = await loadJson('findings.vig.mdsd.json')

  return createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${importPort}`)

    if (url.pathname === '/') {
      sendJson(res, 200, { service: 'import', ok: true })
      return
    }

    if (url.pathname === '/specialties') {
      sendJson(res, 200, specialties)
      return
    }

    if (url.pathname === '/location') {
      sendJson(res, 200, locations)
      return
    }

    if (url.pathname === '/checklist') {
      const inspectionId = url.searchParams.get('inspectionId') || url.searchParams.get('inspection')
      const specialty = url.searchParams.get('specialty')
      if ((inspectionId === 'INS1' || inspectionId === '0224') && specialty === 'VIG') {
        sendJson(res, 200, checklist)
      } else {
        sendJson(res, 404, { error: 'fixture not found' })
      }
      return
    }

    if (url.pathname === '/inspectionProvider') {
      sendJson(res, 200, [
        { inspectionId: 'INS1', inspectedProviderId: 'IP1', siteVisitId: 'SV1', code: '0224', status: 'Planned', serviceProviderId: 'SP1', serviceProviderName: 'Provider A' },
      ])
      return
    }

    if (url.pathname === '/findings/open') {
      sendJson(res, 200, findings)
      return
    }

    if (url.pathname === '/inspection-import') {
      sendJson(res, 200, { imported: true })
      return
    }

    if (url.pathname === '/__e2e__/upload-mode') {
      const mode = url.searchParams.get('value')
      if (mode === 'ok' || mode === 'fail') {
        uploadMode = mode
        sendJson(res, 200, { mode: uploadMode })
      } else {
        sendJson(res, 400, { error: 'invalid mode' })
      }
      return
    }

    sendJson(res, 404, { error: 'not found' })
  })
}

let uploadMode = 'ok'
let inspectionUploadHits = 0
let followUpUploadHits = 0

function createUploadServer() {
  return createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${uploadPort}`)

    if (url.pathname === '/') {
      sendJson(res, 200, { service: 'upload', ok: true })
      return
    }

    if (url.pathname === '/__e2e__/stats') {
      sendJson(res, 200, {
        uploadMode,
        inspectionUploadHits,
        followUpUploadHits,
      })
      return
    }

    if (url.pathname === '/inspection-import') {
      inspectionUploadHits += 1
      if (uploadMode === 'fail') {
        res.writeHead(500, { 'content-type': 'text/plain' })
        res.end('upload failed (inspection)')
      } else {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('ok')
      }
      return
    }

    if (url.pathname === '/followup-import') {
      followUpUploadHits += 1
      if (uploadMode === 'fail') {
        res.writeHead(500, { 'content-type': 'text/plain' })
        res.end('upload failed (follow-up)')
      } else {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('ok')
      }
      return
    }

    sendJson(res, 404, { error: 'not found' })
  })
}

const importServer = await createImportServer()
const uploadServer = createUploadServer()

await new Promise((resolve, reject) => {
  importServer.once('error', reject)
  importServer.listen(importPort, '127.0.0.1', resolve)
})

await new Promise((resolve, reject) => {
  uploadServer.once('error', reject)
  uploadServer.listen(uploadPort, '127.0.0.1', resolve)
})

if (readyFile) {
  await writeFile(readyFile, 'ready', 'utf8')
}

process.stdout.write(`[e2e] import mock listening on :${importPort}\n`)
process.stdout.write(`[e2e] upload mock listening on :${uploadPort}\n`)

function shutdown() {
  importServer.close(() => {})
  uploadServer.close(() => {})
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
