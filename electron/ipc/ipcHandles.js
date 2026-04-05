import { app } from 'electron'
import { shell } from 'electron'
import path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import JSZip from 'jszip'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  fileExists,
  ensureDir,
  listDir,
  readFile,
  saveFile,
  deleteFile,
  getFileStats,
} from '../utils/fileOps.js'
import { safeJoin } from '../utils/fileSec.js'
import { logger } from '../utils/logger.js'
import { generateFindingsReport } from '../utils/pdfGenerator.js'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)

const checklistSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Checklist',
  type: 'object',
  required: ['schemaVersion', 'checklist', 'items'],
  properties: {
    schemaVersion: {
      type: 'string',
    },
    checklist: {
      type: 'object',
      required: ['inspectionId', 'inspectionCode', 'domain', 'providerId'],
      properties: {
        inspectionId: { type: 'string' },
        inspectionCode: {
          type: 'string',
          pattern: '^[A-Z0-9]{4}-\\d{4}-\\d{2}$',
        },
        locationId: { type: 'string' },
        locationName: { type: 'string' },
        checklistId: {
          type: 'string',
          pattern: '^CHK-[A-Z]{4}-\\d{4}-\\d{2}-[A-Z]{3}$',
        },
        domain: { type: 'string' },
        providerId: { type: 'string' },
        providerName: { type: 'string' },
        inspectors: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['itemId', 'itemCode', 'compliance'],
        properties: {
          itemId: { type: 'string' },
          itemCode: {
            type: 'string',
            pattern: '^[A-Z]{3}-\\d{4}$',
          },
          requirement: { type: 'string' },
          verificationMethod: { type: 'string' },
          comment: { type: 'string' },
          reference: {
            type: 'object',
            properties: {
              icaoReference: { type: 'string' },
              nationalRegulation: { type: 'string' },
            },
          },
          compliance: {
            type: 'string',
            enum: ['Compliant', 'Non-compliant', 'Not applicable'],
          },
          riskLevel: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
          },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              required: ['evidenceId'],
              properties: {
                evidenceId: { type: 'string' },
                evidenceType: { type: 'string' },
                evidenceSource: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
}

const findingSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Finding',
  type: 'object',
  required: ['schemaVersion', 'finding'],
  properties: {
    schemaVersion: {
      type: 'string',
    },
    finding: {
      type: 'object',
      required: [
        'findingId',
        'domain',
        'providerId',
        'locationId',
        'locationName',
        'itemId',
        'description',
      ],
      properties: {
        findingId: {
          type: 'string',
          pattern: '^[A-Z0-9]{4}-[A-Z]{3}-\\d{4}-\\d{2}$',
        },
        domain: { type: 'string' },
        providerId: { type: 'string' },
        locationId: { type: 'string' },
        locationName: { type: 'string' },
        itemId: { type: 'string' },
        requirementBreached: { type: 'string' },
        dateIssued: { type: 'string', format: 'date' },
        findingLevel: { type: 'string' },
        description: { type: 'string' },
        riskLevel: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Critical'],
        },
      },
    },
  },
}

const followUpReportSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'FollowUpReport',
  type: 'object',
  required: ['schemaVersion', 'followUpReport'],
  properties: {
    schemaVersion: {
      type: 'string',
    },
    followUpReport: {
      type: 'object',
      required: [
        'findingId',
        'domain',
        'providerId',
        'locationId',
        'locationName',
        'followUpDate',
        'findingClosed',
        'percentComplete',
        'effectivenessConfirmed',
      ],
      properties: {
        findingId: { type: 'string' },
        capId: { type: 'string' },
        domain: { type: 'string' },
        providerId: { type: 'string' },
        locationId: { type: 'string' },
        locationName: { type: 'string' },
        followUpDate: { type: 'string', format: 'date-time' },
        findingClosed: { type: 'boolean' },
        percentComplete: { type: 'integer', minimum: 0, maximum: 100 },
        followUpClosureDate: { type: 'string', format: 'date' },
        closureVerificationMethod: { type: 'string' },
        effectivenessConfirmed: { type: 'boolean' },
        comment: { type: 'string' },
        evidence: {
          type: 'array',
          items: {
            type: 'object',
            required: ['evidenceId'],
            properties: {
              evidenceId: { type: 'string' },
              evidenceType: { type: 'string' },
              evidenceSource: { type: 'string' },
            },
          },
        },
      },
    },
  },
}

// Moved outside the setup function as it's a constant
//const defaultSavePath = '/home/fernando/Documents/Current_inspection'; //path.join(app.getPath('documents'), 'Current_inspection');
const defaultSavePath = path.join(app.getPath('documents'), 'Current_inspection')

const sanitizeUpperAlnum = (value = '') =>
  String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const safeString = (value, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback

const sanitizeWorkspaceLeg = (value = '') => String(value).replace(/[^A-Za-z0-9_-]/g, '_')

const buildWorkspaceFolderName = (locationId, specialty) => {
  const safeLocationId = sanitizeWorkspaceLeg(String(locationId || '').toUpperCase())
  const safeSpecialty = sanitizeWorkspaceLeg(String(specialty).toUpperCase())
  return `${safeLocationId}_${safeSpecialty}`
}

const readAppConfig = async () => {
  const appDir = dirname(fileURLToPath(import.meta.url))
  const configPath = path.join(appDir, '..', '..', 'app.config.json')
  const raw = await fs.readFile(configPath, 'utf-8')
  return JSON.parse(raw)
}

const asDateOnly = (value) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0]
  }
  return parsed.toISOString().split('T')[0]
}

const normalizeCompliance = (value) => {
  if (value === 'Compliant' || value === 'Non-compliant' || value === 'Not applicable') {
    return value
  }
  return 'Not applicable'
}

const inferInspectionCode = (checklistObj) => {
  const existing = safeString(checklistObj?.inspection)
  if (/^[A-Z]{4}-\d{4}-\d{2}$/.test(existing)) {
    return existing
  }

  const locationToken =
    sanitizeUpperAlnum(checklistObj?.locationCode || checklistObj?.locationId || checklistObj?.location)
      .slice(0, 4)
      .padEnd(4, 'X')
  const year = asDateOnly(checklistObj?.startDate).slice(0, 4)
  const seq = String(checklistObj?.inspection || checklistObj?.inspectionNumber || '01').replace(
    /\D/g,
    ''
  )
  const seq2 = (seq.slice(-2) || '01').padStart(2, '0')
  return `${locationToken}-${year}-${seq2}`
}

const inferSpecialtyCode = (checklistObj, specialty) => {
  const existing = safeString(checklistObj?.specialtyCode, safeString(specialty))
  return sanitizeUpperAlnum(existing).slice(0, 3).padEnd(3, 'X')
}

const inferDomainName = (checklistObj, specialty, specialtyCode) => {
  return (
    safeString(checklistObj?.specialtyName) ||
    safeString(checklistObj?.domain) ||
    safeString(specialty) ||
    specialtyCode
  )
}

const inferChecklistId = (inspectionCode, domainCode) => {
  const [locationPart = 'XXXX', year = '0000', sequence = '00'] = String(inspectionCode).split('-')
  const checklistLocation = locationPart.replace(/[^A-Z]/g, '').padEnd(4, 'X').slice(0, 4)
  return `CHK-${checklistLocation}-${year}-${sequence}-${domainCode}`
}

const inferItemCode = (row, domainCode, index) => {
  const importedCode = safeString(row?.code, safeString(row?.itemCode))
  if (importedCode) {
    return importedCode
  }

  const existing = safeString(row?.itemCode)
  if (/^[A-Z]{3}-\d{4}$/.test(existing)) {
    return existing
  }

  const sequenceDigits = String(row?.sequence || index + 1).replace(/\D/g, '')
  const seq4 = (sequenceDigits || String(index + 1)).padStart(4, '0').slice(-4)
  return `${domainCode}-${seq4}`
}

const findResponseForRow = (responses, row, index) => {
  const rowCode = safeString(row?.code)
  const byCode = rowCode ? responses?.[rowCode] : null
  if (byCode) {
    return byCode
  }

  const byIndex = responses?.[String(index + 1)] || responses?.[index + 1]
  if (byIndex) {
    return byIndex
  }

  const rowId = safeString(row?.id)
  if (!rowId) {
    return null
  }

  for (const entry of Object.values(responses || {})) {
    if (entry?.id === rowId || (rowCode && entry?.code === rowCode)) {
      return entry
    }
  }

  return null
}

const inferEvidenceType = (fileName = '') => {
  const extension = path.extname(fileName).toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(extension)) {
    return 'image'
  }
  if (['.mp3', '.wav', '.webm', '.m4a'].includes(extension)) {
    return 'audio'
  }
  return 'document'
}

const mapChecklistPayload = ({ checklistObj, sessionObj, specialty }) => {
  const questions = Array.isArray(checklistObj?.questions) ? checklistObj.questions : []
  const responses = sessionObj?.responses || {}
  const specialtyCode = inferSpecialtyCode(checklistObj, specialty)
  const domainName = inferDomainName(checklistObj, specialty, specialtyCode)

  const inspectionCode = inferInspectionCode(checklistObj)

  const checklistSection = {
    inspectionId: safeString(checklistObj?.inspectionId, safeString(checklistObj?.inspection)),
    inspectionCode,
    domain: domainName,
    providerId: safeString(checklistObj?.providerId),
  }

  const optionalChecklistFields = {
    locationId: safeString(checklistObj?.locationId),
    locationName: safeString(checklistObj?.locationName, safeString(checklistObj?.location)),
    checklistId: inferChecklistId(inspectionCode, specialtyCode),
    providerName: safeString(checklistObj?.providerName),
    inspectors: Array.isArray(checklistObj?.inspectors)
      ? checklistObj.inspectors.filter((name) => typeof name === 'string' && name.trim())
      : [],
  }

  for (const [field, value] of Object.entries(optionalChecklistFields)) {
    if (Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0) {
      checklistSection[field] = value
    }
  }

  const items = questions.map((row, index) => {
    const response = findResponseForRow(responses, row, index) || {}
    const item = {
      itemId: safeString(row?.id, `item-${index + 1}`),
      itemCode: inferItemCode(row, specialtyCode, index),
      compliance: normalizeCompliance(response?.compliance),
    }

    const requirement = safeString(row?.question)
    if (requirement) {
      item.requirement = requirement
    }

    const verificationMethod = safeString(row?.verification)
    if (verificationMethod) {
      item.verificationMethod = verificationMethod
    }

    const comment = safeString(response?.comments)
    if (comment) {
      item.comment = comment
    }

    const rowReference = row?.reference || {}
    const referenceObj = {
      icaoReference: safeString(rowReference?.normativa?.ICAOref || rowReference?.icaoReference),
      nationalRegulation: safeString(
        rowReference?.normativa?.reglamento || rowReference?.nationalRegulation
      ),
    }

    if (referenceObj.icaoReference || referenceObj.nationalRegulation) {
      item.reference = {}
      if (referenceObj.icaoReference) {
        item.reference.icaoReference = referenceObj.icaoReference
      }
      if (referenceObj.nationalRegulation) {
        item.reference.nationalRegulation = referenceObj.nationalRegulation
      }
    }

    const evidenceList = Array.isArray(response?.evidence) ? response.evidence : []
    if (evidenceList.length > 0) {
      item.evidence = evidenceList.map((evidenceSource, evidenceIndex) => ({
        evidenceId: `EV-${String(index + 1).padStart(4, '0')}-${String(evidenceIndex + 1).padStart(2, '0')}`,
        evidenceType: inferEvidenceType(evidenceSource),
        evidenceSource,
      }))
    }

    return item
  })

  return {
    schemaVersion: '1.0',
    checklist: checklistSection,
    items,
  }
}

const mapFindingsPayload = ({ checklistPayload, checklistObj, sessionObj, specialty }) => {
  const questions = Array.isArray(checklistObj?.questions) ? checklistObj.questions : []
  const responses = sessionObj?.responses || {}
  const specialtyCode = inferSpecialtyCode(checklistObj, specialty)
  const domainName = inferDomainName(checklistObj, specialty, specialtyCode)

  const dateIssued = asDateOnly(sessionObj?.summary?.lastUpdated || checklistObj?.startDate)
  const locationToken = sanitizeUpperAlnum(checklistPayload?.checklist?.inspectionCode).slice(0, 4)

  const findings = []

  questions.forEach((row, index) => {
    const response = findResponseForRow(responses, row, index) || {}
    if (normalizeCompliance(response?.compliance) !== 'Non-compliant') {
      return
    }

    const findingNumber = findings.length + 1
    const finding = {
      schemaVersion: '1.0',
      finding: {
        findingId: `${(locationToken || 'XXXX').padEnd(4, 'X')}-${specialtyCode}-${asDateOnly(
          checklistObj?.startDate
        ).slice(0, 4)}-${String(findingNumber).padStart(2, '0')}`,
        domain: checklistPayload?.checklist?.domain || domainName,
        providerId: checklistPayload?.checklist?.providerId || '',
        locationId: checklistPayload?.checklist?.locationId || '',
        locationName:
          checklistPayload?.checklist?.locationName || safeString(checklistObj?.locationName),
        itemId: safeString(row?.id, `item-${index + 1}`),
        description: safeString(response?.nonConformity || response?.comments || row?.question),
      },
    }

    const requirementBreached =
      safeString(row?.reference?.normativa?.reglamento) ||
      safeString(row?.reference?.nationalRegulation)
    if (requirementBreached) {
      finding.finding.requirementBreached = requirementBreached
    }

    finding.finding.dateIssued = dateIssued

    const riskLevel = safeString(response?.riskLevel || row?.riskLevel)
    if (['Low', 'Medium', 'High', 'Critical'].includes(riskLevel)) {
      finding.finding.riskLevel = riskLevel
    }

    const findingLevel = safeString(response?.findingLevel)
    if (findingLevel) {
      finding.finding.findingLevel = findingLevel
    }

    findings.push(finding)
  })

  return findings
}

const mapFollowUpReportsPayload = ({ findingsObj, followUpSessionObj }) => {
  const findings = Array.isArray(findingsObj) ? findingsObj : []
  const responses = followUpSessionObj?.responses || {}

  return Object.entries(responses).map(([findingId, response], index) => {
    const findingEntry = findings.find((entry) => entry?.finding?.findingId === findingId)
    if (!findingEntry?.finding) {
      throw new Error(`Could not find source finding for follow-up response ${findingId}`)
    }

    const finding = findingEntry.finding
    const report = {
      schemaVersion: '1.0',
      followUpReport: {
        findingId,
        domain: safeString(finding.domain),
        providerId: safeString(finding.providerId),
        locationId: safeString(finding.locationId),
        locationName: safeString(finding.locationName),
        followUpDate: safeString(
          response?.followUpDate,
          safeString(followUpSessionObj?.summary?.lastUpdated, new Date().toISOString())
        ),
        findingClosed: Boolean(response?.findingClosed),
        percentComplete: Math.max(0, Math.min(100, Number(response?.percentComplete || 0))),
        effectivenessConfirmed: Boolean(response?.effectivenessConfirmed),
      },
    }

    const capId = safeString(finding?.correctiveAction?.capId)
    if (capId) {
      report.followUpReport.capId = capId
    }

    const closureVerificationMethod = safeString(response?.closureVerificationMethod)
    if (closureVerificationMethod) {
      report.followUpReport.closureVerificationMethod = closureVerificationMethod
    }

    const comment = safeString(response?.comments)
    if (comment) {
      report.followUpReport.comment = comment
    }

    if (report.followUpReport.findingClosed) {
      report.followUpReport.followUpClosureDate = asDateOnly(
        response?.followUpClosureDate || report.followUpReport.followUpDate
      )
    }

    const evidenceList = Array.isArray(response?.evidence) ? response.evidence : []
    if (evidenceList.length > 0) {
      report.followUpReport.evidence = evidenceList.map((evidenceSource, evidenceIndex) => ({
        evidenceId: `FUEV-${String(index + 1).padStart(4, '0')}-${String(evidenceIndex + 1).padStart(2, '0')}`,
        evidenceType: inferEvidenceType(evidenceSource),
        evidenceSource,
      }))
    }

    return report
  })
}

const buildAjvError = (errors = []) =>
  errors.map((entry) => `${entry.instancePath || '/'} ${entry.message}`).join('; ')

const addDirectoryToZip = async (zipFolder, diskPath) => {
  const entries = await fs.readdir(diskPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(diskPath, entry.name)
    if (entry.isDirectory()) {
      const childFolder = zipFolder.folder(entry.name)
      await addDirectoryToZip(childFolder, fullPath)
    } else if (entry.isFile()) {
      const fileContent = await fs.readFile(fullPath)
      zipFolder.file(entry.name, fileContent)
    }
  }
}

// All handler definitions are now inside this function
export function setupIpcHandles(ipcMain) {
  /**
      filePath : the directory or file to check; if null, then fallback to defaultSavePath
      pathLegs : any additional components of the path, existing under the previous filePath
      
    */
  ipcMain.handle('check-path', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath !== null ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      return await fileExists(toFilePath)
    } catch (err) {
      logger.error(
        `check-path: Could not assess presence of file ${filePath} ${pathLegs.toString()}: ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('get-path', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      return safeJoin(dirPath, pathLegs)
    } catch (err) {
      logger.error(
        `create-dir: Could not create directory ${filePath} ${pathLegs.toString()} : ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('get-full-path', async (event, filePath, pathLegs, fileName) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const dirPathWithLegs = safeJoin(dirPath, pathLegs)
      return safeJoin(dirPathWithLegs, fileName)
    } catch (err) {
      logger.error(
        `get-full-path: Could not get full path ${filePath} ${pathLegs} ${fileName}: ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('get-stats', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const fileStats = await getFileStats(toFilePath)
      return fileStats
    } catch (err) {
      logger.error(`get-stats: Could not stat file ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('create-dir', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = pathLegs ? safeJoin(dirPath, pathLegs) : dirPath
      await ensureDir(toFilePath)
    } catch (err) {
      logger.error(
        `create-dir: Could not create directory ${filePath} ${pathLegs} : ${err.message}`
      )
      throw err
    }
  })

  ipcMain.handle('list-path', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = pathLegs ? safeJoin(dirPath, pathLegs) : dirPath
      const dirList = await listDir(toFilePath)
      return dirList
    } catch (err) {
      logger.error(`list-file: Could not read directory ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('read-file', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const fileContent = await readFile(toFilePath)
      return fileContent
    } catch (err) {
      logger.error(`read-file: Could not read file ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('save-file', async (event, fileData, filePath, pathLegs) => {
    try {
      // data should be a string or an array
      if (typeof fileData != 'string' && fileData?.byteLength === undefined) {
        throw new Error('Invalid buffer')
      }

      if (fileData.length == 0) {
        throw new Error('Buffer is empty')
      }

      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const dataToSave = typeof fileData === 'string' ? fileData : Buffer.from(fileData)
      const saved = await saveFile(toFilePath, dataToSave)
      return saved
    } catch (err) {
      logger.error(`save-file: Could not save file ${filePath} ${pathLegs} : ${err.message}`)
      throw new Error(
        `ipcHandles.save-file: Could not save file ${filePath} ${pathLegs} : ${err.message}`
      )
    }
  })

  ipcMain.handle('delete-file', async (event, filePath, pathLegs) => {
    try {
      const dirPath = filePath ? filePath : defaultSavePath
      const toFilePath = safeJoin(dirPath, pathLegs)
      const deleted = await deleteFile(toFilePath)
      return deleted
    } catch (err) {
      logger.error(`delete-file: Could not delete file ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('generate-pdf', async (event, { checklistString, sessionString, specialty, outputPath }) => {
    try {
      if (!checklistString || !sessionString || !specialty || !outputPath) {
        throw new Error('Missing required parameters: checklistString, sessionString, specialty, outputPath')
      }
      const result = await generateFindingsReport({ checklistString, sessionString, specialty, outputPath })
      return result
    } catch (err) {
      logger.error(`generate-pdf: Could not generate PDF: ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      if (!filePath) {
        throw new Error('Missing required parameter: filePath')
      }
      await shell.openPath(filePath)
      return { success: true }
    } catch (err) {
      logger.error(`open-file: Could not open file ${filePath}: ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('get-app-config', async () => {
    try {
      return await readAppConfig()
    } catch (err) {
      logger.error(`get-app-config: Could not read app config: ${err.message}`)
      return {}
    }
  })

  ipcMain.handle('check-service-health', async (event, params) => {
    try {
      const baseUrl = typeof params?.baseUrl == 'string' ? params.baseUrl.trim() : ''
      const timeoutMs = Number.isFinite(params?.timeoutMs) ? params.timeoutMs : 2500

      if (!baseUrl) {
        throw new Error('Missing required parameter: baseUrl')
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(baseUrl, {
          method: 'GET',
          signal: controller.signal,
        })

        return {
          online: true,
          baseUrl,
          status: response.status,
          error: null,
        }
      } finally {
        clearTimeout(timer)
      }
    } catch (err) {
      return {
        online: false,
        baseUrl: params?.baseUrl || null,
        status: 0,
        error: err.message,
      }
    }
  })

  ipcMain.handle('export-inspection-payload', async (event, payload) => {
    try {
      const { checklistString, sessionString, specialty, locationId, filePath, uploadUrl } = payload || {}
      if (!checklistString || !sessionString || !specialty) {
        throw new Error('Missing required parameters: checklistString, sessionString, specialty')
      }

      const checklistObj =
        typeof checklistString === 'string' ? JSON.parse(checklistString) : checklistString
      const sessionObj = typeof sessionString === 'string' ? JSON.parse(sessionString) : sessionString

      const checklistPayload = mapChecklistPayload({ checklistObj, sessionObj, specialty })
      const findingsPayload = mapFindingsPayload({
        checklistPayload,
        checklistObj,
        sessionObj,
        specialty,
      })

      const validateChecklist = ajv.compile(checklistSchema)
      const validateFinding = ajv.compile(findingSchema)

      if (!validateChecklist(checklistPayload)) {
        throw new Error(`Generated checklist payload failed schema validation: ${buildAjvError(validateChecklist.errors)}`)
      }

      findingsPayload.forEach((finding, index) => {
        if (!validateFinding(finding)) {
          throw new Error(
            `Generated finding payload at index ${index} failed schema validation: ${buildAjvError(validateFinding.errors)}`
          )
        }
      })

      const dirPath = filePath ? filePath : defaultSavePath
      const resolvedLocationId =
        locationId || checklistObj?.locationId || checklistObj?.location || checklistPayload?.checklist?.locationId
      const workspaceFolder = resolvedLocationId
        ? buildWorkspaceFolderName(resolvedLocationId, specialty)
        : sanitizeWorkspaceLeg(String(specialty).toUpperCase())
      const workspacePath = safeJoin(dirPath, [workspaceFolder])
      const evidencePath = safeJoin(dirPath, [workspaceFolder, 'Evidence'])
      await ensureDir(workspacePath)

      const zip = new JSZip()
      zip.file('checklist.json', JSON.stringify(checklistPayload, null, 2))
      zip.file('findings.json', JSON.stringify(findingsPayload, null, 2))

      if (await fileExists(evidencePath)) {
        const evidenceFolder = zip.folder('Evidence')
        await addDirectoryToZip(evidenceFolder, evidencePath)
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const zipName = `inspection_payload_${sanitizeUpperAlnum(specialty) || 'SPECIALTY'}_${timestamp}.zip`
      const zipPath = safeJoin(workspacePath, [zipName])
      await saveFile(zipPath, zipBuffer)

      let targetUrl = uploadUrl
      if (!targetUrl) {
        const appConfig = await readAppConfig().catch(() => ({}))
        const uploadHost = appConfig?.api?.uploadHost || 'http://localhost:8000'
        targetUrl = `${uploadHost}/inspection-import`
      }
      const form = new FormData()
      form.append('file', new Blob([zipBuffer], { type: 'application/zip' }), zipName)
      const response = await fetch(targetUrl, {
        method: 'POST',
        body: form,
      })

      const responseText = await response.text()
      if (!response.ok) {
        throw new Error(`Import API failed with status ${response.status}: ${responseText}`)
      }

      return {
        zipPath,
        uploadStatus: response.status,
        uploadBody: responseText,
        findingsCount: findingsPayload.length,
      }
    } catch (err) {
      logger.error(`export-inspection-payload: Could not create/upload payload: ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('export-follow-up-payload', async (event, payload) => {
    try {
      const {
        findingsString,
        followUpSessionString,
        specialty,
        locationId,
        filePath,
        uploadUrl,
      } = payload || {}
      if (!findingsString || !followUpSessionString || !specialty) {
        throw new Error('Missing required parameters: findingsString, followUpSessionString, specialty')
      }

      const findingsObj = typeof findingsString === 'string' ? JSON.parse(findingsString) : findingsString
      const followUpSessionObj =
        typeof followUpSessionString === 'string'
          ? JSON.parse(followUpSessionString)
          : followUpSessionString

      const followUpReportsPayload = mapFollowUpReportsPayload({
        findingsObj,
        followUpSessionObj,
      })

      const validateFinding = ajv.compile(findingSchema)
      const validateFollowUpReport = ajv.compile(followUpReportSchema)

      findingsObj.forEach((finding, index) => {
        if (!validateFinding(finding)) {
          throw new Error(
            `Source finding payload at index ${index} failed schema validation: ${buildAjvError(validateFinding.errors)}`
          )
        }
      })

      followUpReportsPayload.forEach((report, index) => {
        if (!validateFollowUpReport(report)) {
          throw new Error(
            `Generated follow-up payload at index ${index} failed schema validation: ${buildAjvError(validateFollowUpReport.errors)}`
          )
        }
      })

      const dirPath = filePath ? filePath : defaultSavePath
      const workspaceFolder = locationId
        ? buildWorkspaceFolderName(locationId, specialty)
        : sanitizeWorkspaceLeg(String(specialty).toUpperCase())
      const workspacePath = safeJoin(dirPath, [workspaceFolder])
      const followUpEvidencePath = safeJoin(dirPath, [workspaceFolder, 'FollowUpEvidence'])
      await ensureDir(workspacePath)

      const zip = new JSZip()
      zip.file('findings.json', JSON.stringify(findingsObj, null, 2))
      zip.file('followup-reports.json', JSON.stringify(followUpReportsPayload, null, 2))

      if (await fileExists(followUpEvidencePath)) {
        const evidenceFolder = zip.folder('FollowUpEvidence')
        await addDirectoryToZip(evidenceFolder, followUpEvidencePath)
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const zipName = `followup_payload_${sanitizeUpperAlnum(specialty) || 'SPECIALTY'}_${timestamp}.zip`
      const zipPath = safeJoin(workspacePath, [zipName])
      await saveFile(zipPath, zipBuffer)

      let targetUrl = uploadUrl
      if (!targetUrl) {
        const appConfig = await readAppConfig().catch(() => ({}))
        const uploadHost = appConfig?.api?.uploadHost || 'http://localhost:8000'
        targetUrl = `${uploadHost}/followup-import`
      }
      const form = new FormData()
      form.append('file', new Blob([zipBuffer], { type: 'application/zip' }), zipName)
      const response = await fetch(targetUrl, {
        method: 'POST',
        body: form,
      })

      const responseText = await response.text()
      if (!response.ok) {
        throw new Error(`Follow-up import API failed with status ${response.status}: ${responseText}`)
      }

      return {
        zipPath,
        uploadStatus: response.status,
        uploadBody: responseText,
        reportsCount: followUpReportsPayload.length,
      }
    } catch (err) {
      logger.error(`export-follow-up-payload: Could not create/upload payload: ${err.message}`)
      throw err
    }
  })
}
