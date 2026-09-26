import { app } from 'electron'
import { shell, safeStorage } from 'electron'
import path from 'node:path'
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
  hashFile,
} from '../utils/fileOps.js'
import { safeJoin } from '../utils/fileSec.js'
import {
  CLOSURE_FOLLOW_UP_TYPE,
  DEFAULT_FOLLOW_UP_TYPE,
  EVIDENCE_ROLES,
  FOLLOW_UP_TYPES,
  allowedFollowUpTypes,
  normalizeFollowUpType,
} from '../utils/domainRules.mjs'
import { resolveReadableAppConfigPath, writableAppConfigPath } from '../utils/appConfig.js'
import { logger } from '../utils/logger.js'
import { generateFindingsReport } from '../utils/pdfGenerator.js'
import { getLocale, setLocale } from '../utils/userSettings.js'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)

const evidenceItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['evidenceId'],
  properties: {
    evidenceId: { type: 'string' },
    evidenceType: { type: 'string' },
    source: { type: 'string' },
    collectionDate: { type: 'string', format: 'date' },
    hashValue: { type: 'string' },
    immutable: { type: 'boolean' },
    sealedDate: { type: 'string', format: 'date-time' },
    evidenceRole: {
      type: 'string',
      enum: [...EVIDENCE_ROLES],
    },
  },
}

const checklistSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Checklist',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'checklist', 'items'],
  properties: {
    schemaVersion: {
      type: 'string',
    },
    checklist: {
      type: 'object',
      additionalProperties: false,
      required: [
        'inspectionId',
        'inspectionCode',
        'specialtyId',
        'specialtyCode',
        'specialtyName',
        'providerId',
      ],
      properties: {
        contentType: { type: 'string' },
        inspectionId: { type: 'string' },
        inspectionCode: {
          type: 'string',
          pattern: '^[A-Z0-9]{4}-[A-Z]-\\d{4}$',
        },
        scope: { type: 'string' },
        locationId: { type: 'string' },
        locationCode: { type: 'string' },
        locationName: { type: 'string' },
        completionDate: { type: 'string', format: 'date' },
        // The field-recorded inspection window, exported so Alfresco can date
        // the inspection folder (and, through it, every checklist item filed
        // under it). Mirrors compliance_import's checklist.schema.json.
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        specialtyId: { type: 'string' },
        specialtyCode: { type: 'string' },
        specialtyName: { type: 'string' },
        checklistId: {
          type: 'string',
          pattern: '^LV-[A-Z0-9]{4}[A-Z]\\d{4}-[A-Z]{3,4}$',
        },
        providerId: { type: 'string' },
        providerName: { type: 'string' },
        inspectors: {
          type: 'array',
          items: { type: 'string' },
        },
        interviewee: { type: 'string' },
        declaredBy: { type: 'string' },
        inspectorId: { type: 'string' },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          itemId: { type: 'string' },
          itemCode: {
            type: 'string',
            pattern: '^[A-Z0-9]{3,6}-\\d{4}$',
          },
          requirementText: { type: 'string' },
          itemVerificationMethod: { type: 'string' },
          inspectorComment: { type: 'string' },
          reference: {
            type: 'object',
            properties: {
              icaoReference: { type: 'string' },
              nationalRegulation: { type: 'string' },
              regulationItem: { type: 'string' },
              usoapPqReference: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    criticalElement: { type: 'string' },
                    areaCode: { type: 'string' },
                  },
                },
              },
            },
          },
          complianceStatus: {
            type: 'string',
            enum: ['Compliant', 'Non-Compliant', 'Not Applicable'],
          },
          riskClassification: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
          },
          nominalRisk: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
          },
          hasOpenPriorFinding: {
            type: 'boolean',
            default: false,
          },
          evidenceItems: {
            type: 'array',
            items: evidenceItemSchema,
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
  additionalProperties: false,
  required: ['schemaVersion', 'finding'],
  properties: {
    schemaVersion: {
      type: 'string',
    },
    finding: {
      type: 'object',
      additionalProperties: false,
      required: [
        'findingId',
        'providerId',
        'locationId',
        'locationName',
        'checklistItemCode',
        'description',
      ],
      properties: {
        contentType: { type: 'string' },
        findingId: {
          type: 'string',
          pattern: '^H-[A-Z0-9]{4}[A-Z]\\d{4}-[A-Z]{3,4}-\\d{3}$',
        },
        specialtyId: { type: 'string' },
        specialtyCode: { type: 'string' },
        specialtyName: { type: 'string' },
        providerId: { type: 'string' },
        providerName: { type: 'string' },
        locationId: { type: 'string' },
        locationCode: { type: 'string' },
        locationName: { type: 'string' },
        itemCode: { type: 'string' },
        checklistItemCode: { type: 'string' },
        requirementBreached: { type: 'string' },
        icaoReference: { type: 'string' },
        nationalRegulation: { type: 'string' },
        regulationItem: { type: 'string' },
        usoapPqReference: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              criticalElement: { type: 'string' },
              areaCode: { type: 'string' },
            },
          },
        },
        dateIssued: { type: 'string', format: 'date' },
        findingLevel: {
          type: 'string',
          enum: ['Non-Compliance', 'Observation', 'Recommendation'],
          default: 'Non-Compliance',
        },
        findingSeverity: {
          type: 'string',
          enum: ['A', 'B', 'C'],
          default: 'C',
        },
        description: { type: 'string', maxLength: 2000 },
        // Mirrors vso:findingStatusList in compliance_cmis/configs/model/vsoModel.xml
        // (11 values). Both closure states are legitimate: a Closure Verification
        // follow-up that confirms effectiveness lands on 'Pending Closure Approval'
        // (never 'Closed' directly - a closure_reviewer approves that separately),
        // while 'Pending Closure Review' is the earlier review stage.
        findingStatus: {
          type: 'string',
          enum: [
            'Open',
            'CAP Submitted',
            'CAP Accepted',
            'In Progress',
            'Pending Closure Review',
            'Verifying Effective Closure',
            'Pending Closure Approval',
            'Closed',
            'CAP Overdue',
            'Solution Overdue',
            'Overdue',
          ],
          default: 'Open',
        },
        declaredBy: { type: 'string' },
        inspectorId: { type: 'string' },
        submissionDeadline: { type: 'string', format: 'date' },
        findingClosureDate: { type: 'string', format: 'date' },
        lastStatusChange: { type: 'string', format: 'date' },
        resolutionDeadline: { type: 'string', format: 'date' },
        inspectionId: { type: 'string' },
        riskClassification: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Critical'],
        },
        correctiveAction: {
          type: 'object',
          properties: {
            capId: {
              type: 'string',
              pattern: '^P-([A-Z0-9]{4}[A-Z]\\d{4})-([A-Z]{3,4})(\\d{3})-(\\d{2})$'
            },
            proposedAction: { type: 'string' },
            responsibleEntity: { type: 'string' },
            dueDate: { type: 'string', format: 'date' },
            acceptanceStatus: {
              type: 'string',
              enum: ['Pending', 'Accepted', 'Rejected', 'Returned']
            },
          },
        },
      },
    },
  },
}

const sourceFindingSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'SourceFindingForFollowUp',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'finding'],
  properties: {
    schemaVersion: { type: 'string' },
    finding: {
      type: 'object',
      additionalProperties: true,
      required: ['findingId', 'locationId'],
      properties: {
        findingId: { type: 'string' },
        locationId: { type: 'string' },
        locationName: { type: 'string' },
        providerId: { type: 'string' },
        providerName: { type: 'string' },
        itemCode: { type: 'string' },
        checklistItemCode: { type: 'string' },
        itemId: { type: 'string' },
        description: { type: 'string' },
        dateIssued: { type: 'string' },
        resolutionDeadline: { type: 'string' },
        findingClosureDate: { type: 'string' },
        correctiveAction: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  },
}

const followUpReportSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'FollowUpReport',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'followUpReport'],
  properties: {
    schemaVersion: { type: 'string' },
    followUpReport: {
      type: 'object',
      additionalProperties: false,
      required: [
        'findingId',
        'providerId',
        'locationId',
        'locationName',
        'followUpDate',
        'percentComplete',
        'followUpType',
      ],
      properties: {
        contentType: { type: 'string' },
        followUpId: {
          type: 'string',
          pattern: '^S-([A-Z0-9]{4}[A-Z]\\d{4})-([A-Z]{3,4})(\\d{3})-(\\d{2})$',
        },
        findingId: {
          type: 'string',
          pattern: '^H-[A-Z0-9]{4}[A-Z]\\d{4}-[A-Z]{3,4}-\\d{3}$',
        },
        specialtyId: { type: 'string' },
        specialtyCode: { type: 'string' },
        specialtyName: { type: 'string' },
        providerId: { type: 'string' },
        providerName: { type: 'string' },
        locationId: { type: 'string' },
        locationCode: { type: 'string' },
        locationName: { type: 'string' },
        declaredBy: { type: 'string' },
        inspectorId: { type: 'string' },
        followUpDate: { type: 'string', format: 'date-time' },
        percentComplete: { type: 'integer', minimum: 0, maximum: 100 },
        followUpType: {
          type: 'string',
          enum: [...FOLLOW_UP_TYPES],
        },
        followUpClosureDate: { type: 'string', format: 'date' },
        closureVerificationMethod: { type: 'string' },
        effectivenessConfirmed: { type: ['boolean', 'null'] },
        currentResidualRisk: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Critical'],
        },
        followUpComment: { type: 'string', maxLength: 2000 },
        capId: { type: ['string', 'null'] },
        inspectionId: { type: 'string' },
        evidenceItems: {
          type: 'array',
          items: evidenceItemSchema,
        },
      },
      allOf: [
        {
          if: {
            properties: { followUpType: { const: 'Closure Verification' } },
          },
          then: {
            required: ['effectivenessConfirmed'],
            properties: {
              effectivenessConfirmed: { type: 'boolean' },
            },
          },
          else: {
            properties: {
              effectivenessConfirmed: { type: 'null' },
            },
          },
        },
      ],
    },
  },
}

// Moved outside the setup function as it's a constant
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
  const configPath = await resolveReadableAppConfigPath()
  const raw = await fs.readFile(configPath, 'utf-8')
  return JSON.parse(raw)
}

const ALFRESCO_TICKETS_PATH = '/alfresco/api/-default-/public/authentication/versions/1/tickets'
const ALFRESCO_PEOPLE_ME_PATH = '/alfresco/api/-default-/public/alfresco/versions/1/people/-me-'

// Sync-time operator sign-in. Called once per upload: the password is used to
// obtain a ticket and is never written to disk, and the ticket lives only for
// the request that triggered the prompt. `expectedUserName` is the operator
// confirmed for the workspace; a sign-in as anybody else is rejected.
const authenticateOperator = async ({ username, password, expectedUserName } = {}) => {
  const normalizedUser = String(username || '').trim()
  if (!normalizedUser || typeof password !== 'string' || password.length === 0) {
    throw new Error('Operator username and password are required')
  }

  const appConfig = await readAppConfig().catch(() => ({}))
  const host = String(appConfig?.api?.alfrescoHost || 'http://localhost:8080').replace(/\/+$/, '')

  const loginResponse = await fetch(`${host}${ALFRESCO_TICKETS_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: normalizedUser, password }),
  })

  if (!loginResponse.ok) {
    throw new Error(`Operator sign-in failed with status ${loginResponse.status}`)
  }

  const loginBody = await loginResponse.json().catch(() => null)
  const ticket = loginBody?.entry?.id
  if (!ticket) {
    throw new Error('Operator sign-in returned no ticket')
  }

  const meResponse = await fetch(`${host}${ALFRESCO_PEOPLE_ME_PATH}?alf_ticket=${encodeURIComponent(ticket)}`)
  const meBody = meResponse.ok ? await meResponse.json().catch(() => null) : null
  const entry = meBody?.entry || {}
  const userName = String(entry.userName || entry.id || normalizedUser)
  const displayName = [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim() || userName

  const expected = String(expectedUserName || '').trim()
  if (expected && expected.toLowerCase() !== userName.toLowerCase()) {
    throw new Error(
      `Signed in as "${userName}", but this workspace is assigned to "${expected}". ` +
        'Confirm the operator or sign in with the assigned account.'
    )
  }

  return { ticket, userName, displayName }
}

// Every file operation is confined to the workspace root. The renderer supplies
// the base path, and `safeJoin` alone cannot contain it because a caller-chosen
// base makes the prefix check meaningless — so a base (or an absolute file path)
// outside the workspace is rejected instead of trusted.
const WORKSPACE_ROOT = path.resolve(defaultSavePath)

const assertInsideWorkspace = (target, label = 'path') => {
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }

  const resolved = path.resolve(target)
  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(WORKSPACE_ROOT + path.sep)) {
    throw new Error(`${label} is outside the workspace root`)
  }

  return resolved
}

const workspaceBase = (filePath) => {
  const base = filePath === null || filePath === undefined || filePath === '' ? WORKSPACE_ROOT : filePath
  return assertInsideWorkspace(base, 'workspaceBase')
}

const CREDENTIAL_ENVELOPE_VERSION = 1
const API_KEY_FILE = 'api-key.json'

// The gateway API key committed to compliance_flow/.env.example, and shared
// verbatim with compliance_web's NODE_RED_API_KEY and compliance_import's
// IMPORT_API_KEY. It exists so a cloned demo stack is not an open gateway, but
// it is published, so everyone who has cloned any component repository has it.
//
// This app is the one place the key is typed in by a person rather than read
// from a .env, so it is the one place the platform's other guards -- the three
// services' startup checks and preflight-secrets.sh -- cannot see. Saving it
// is legitimate against a demo stack and a mistake against a real one, and the
// app has no way to tell which it is pointed at, so this warns rather than
// refuses.
const PUBLISHED_GATEWAY_KEY = 'demo-only-CHANGE-BEFORE-ANY-PUBLIC-DEPLOYMENT'

// Credentials are sealed with the OS keychain (DPAPI / Keychain / libsecret)
// instead of being written as plain JSON. Where the OS cannot provide
// encryption the value is still written, but unencrypted and flagged as such.
const writeCredentialFile = async (fileName, payload) => {
  const serialized = JSON.stringify(payload)
  let envelope

  if (safeStorage.isEncryptionAvailable()) {
    envelope = {
      v: CREDENTIAL_ENVELOPE_VERSION,
      encrypted: true,
      payload: safeStorage.encryptString(serialized).toString('base64'),
    }
  } else {
    logger.warn(`Credentials: OS encryption unavailable, writing ${fileName} unencrypted`)
    envelope = { v: CREDENTIAL_ENVELOPE_VERSION, encrypted: false, payload: serialized }
  }

  await ensureDir(WORKSPACE_ROOT)
  await saveFile(path.join(WORKSPACE_ROOT, fileName), JSON.stringify(envelope, null, 2))
  return true
}

const readCredentialFile = async (fileName) => {
  let raw

  try {
    raw = await fs.readFile(path.join(WORKSPACE_ROOT, fileName), 'utf-8')
  } catch {
    return null
  }

  const parsed = JSON.parse(raw)

  // Legacy plaintext format written before encryption was introduced.
  if (parsed === null || typeof parsed !== 'object' || parsed.v === undefined) {
    return parsed
  }

  if (!parsed.encrypted) {
    return JSON.parse(parsed.payload)
  }

  if (!safeStorage.isEncryptionAvailable()) {
    logger.warn(`Credentials: cannot decrypt ${fileName} because OS encryption is unavailable`)
    return null
  }

  return JSON.parse(safeStorage.decryptString(Buffer.from(parsed.payload, 'base64')))
}

const asDateOnly = (value) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0]
  }
  return parsed.toISOString().split('T')[0]
}

const normalizeCompliance = (value) => {
  if (value === 'Compliant' || value === 'Non-Compliant' || value === 'Not Applicable') {
    return value
  }
  return 'Not Applicable'
}

const normalizeRiskLevel = (value) => {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Critical') {
    return value
  }
  return ''
}

const normalizeFindingLevel = (value) => {
  if (value === 'Non-Compliance' || value === 'Observation' || value === 'Recommendation') {
    return value
  }
  return 'Non-Compliance'
}

// Activity code compact form: ICAO(4) + type letter(1) + sequence(4) = 9 chars.
const compactInspectionCode = (inspectionCode = '') =>
  sanitizeUpperAlnum(inspectionCode)
    .slice(0, 9)
    .padEnd(9, 'X')

const normalizeInspectionSequence = (rawValue, fallback = '0001') => {
  const digits = String(rawValue || '').replace(/\D/g, '')
  const seq = digits.slice(-4) || fallback
  return seq.padStart(4, '0').slice(-4)
}

// checklistObj.inspection carries the Inspection/Activity code, e.g.
// "AV-MDPP-I-0002". compliance_import's inspectionCode field expects the
// same value with the "AV-" prefix stripped: "MDPP-I-0002".
const inferInspectionCode = (checklistObj) => {
  const existing = safeString(checklistObj?.inspection)

  const activityMatch = existing.match(/^AV-([A-Z0-9]{4})-([A-Z])-(\d{4})$/)
  if (activityMatch) {
    return `${activityMatch[1]}-${activityMatch[2]}-${activityMatch[3]}`
  }
  if (/^[A-Z0-9]{4}-[A-Z]-\d{4}$/.test(existing)) {
    return existing
  }

  const locationToken =
    sanitizeUpperAlnum(
      checklistObj?.locationCode ||
        checklistObj?.locationIcao ||
        checklistObj?.locationId ||
        checklistObj?.location
    )
      .slice(0, 4)
      .padEnd(4, 'X')
  const seq4 = normalizeInspectionSequence(
    checklistObj?.inspectionNumber || checklistObj?.inspection,
    '0001'
  )
  return `${locationToken}-I-${seq4}`
}

const inferSpecialtyCode = (checklistObj, specialty) => {
  const existing = safeString(checklistObj?.specialtyCode, safeString(specialty))
  const normalized = sanitizeUpperAlnum(existing)
  if (normalized.length == 0) {
    return 'XXX'
  }
  if (normalized.length < 3) {
    return normalized.padEnd(3, 'X')
  }
  return normalized.slice(0, 6)
}

const inferDomainName = (checklistObj, specialty, specialtyCode) => {
  return (
    safeString(checklistObj?.specialtyName) ||
    safeString(specialty) ||
    specialtyCode
  )
}

const inferChecklistId = (inspectionCode, domainCode) => {
  return `LV-${compactInspectionCode(inspectionCode)}-${domainCode}`
}

const inferItemCode = (row, domainCode, index) => {
  const importedCode = safeString(row?.code, safeString(row?.itemCode))
  if (importedCode) {
    return importedCode
  }

  const existing = safeString(row?.itemCode)
  if (/^[A-Z0-9]{3,6}-\d{4}$/.test(existing)) {
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

const normalizeEvidenceEntry = (entry) => {
  if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') {
    return null
  }
  return {
    name: entry.name,
    ...entry,
    hashValue: safeString(entry.hashValue),
    immutable: entry.immutable === true,
    sealedDate: safeString(entry.sealedDate),
  }
}

const mapChecklistPayload = ({ checklistObj, sessionObj, specialty, operator }) => {
  const questions = Array.isArray(checklistObj?.questions) ? checklistObj.questions : []
  const responses = sessionObj?.responses || {}
  const specialtyCode = inferSpecialtyCode(checklistObj, specialty)
  const specialtyName = inferDomainName(checklistObj, specialty, specialtyCode)
  // The renderer resolves this from the API specialty catalog before export
  // (the bundled offline catalog never supplies an id), so accept whatever
  // AtroCore returned: real ids are not guaranteed to be long — this deployment
  // uses short ids such as "spec_apr". Never fall back to the specialty code,
  // which is not an id, and fail loudly when there is no id at all.
  const candidateSpecialtyId = safeString(
    checklistObj?.specialtyId,
    safeString(sessionObj?.summary?.specialtyId)
  )
  const specialtyId =
    candidateSpecialtyId && candidateSpecialtyId.toUpperCase() !== specialtyCode.toUpperCase()
      ? candidateSpecialtyId
      : ''
  if (!specialtyId) {
    throw new Error(
      `Specialty "${specialtyCode}" has no resolved backend id. Reconnect so the specialty catalog ` +
        'can be loaded from the API, then export again.'
    )
  }

  const inspectionCode = inferInspectionCode(checklistObj)
  const locationCode = safeString(
    checklistObj?.locationCode,
    safeString(checklistObj?.locationIcao, safeString(checklistObj?.icaoCode))
  )

  const checklistSection = {
    contentType: 'InspectionChecklist',
    inspectionId: safeString(checklistObj?.inspectionId, safeString(checklistObj?.inspection)),
    inspectionCode,
    specialtyId,
    specialtyCode,
    specialtyName,
    providerId: safeString(checklistObj?.providerId),
  }

  // Pre-verification attribution: the operator confirmed for this workspace.
  // compliance_import replaces/augments it with the identity it verifies from
  // the ticket (enteredBy/enteredAt) and keeps this for mismatch auditing.
  if (operator?.userName) {
    checklistSection.declaredBy = operator.userName
  }
  if (operator?.inspectorId) {
    checklistSection.inspectorId = operator.inspectorId
  }

  const optionalChecklistFields = {
    scope: safeString(checklistObj?.scope),
    locationId: safeString(checklistObj?.locationId),
    locationCode,
    locationName: safeString(checklistObj?.locationName, safeString(checklistObj?.location)),
    // The field-recorded inspection window. "completionDate" stays for
    // compatibility (it is what the CMIS model stores on the checklist
    // document itself), while startDate/endDate carry the same window
    // explicitly so Alfresco can date the inspection folder - and therefore
    // every checklist item filed under it, none of which has a date of its
    // own (see compliance_cmis's canonical-model-import and the provider
    // history / CE evidence reports).
    startDate: safeString(checklistObj?.startDate),
    endDate: safeString(checklistObj?.endDate),
    completionDate: safeString(checklistObj?.endDate),
    checklistId: inferChecklistId(inspectionCode, specialtyCode),
    providerName: safeString(checklistObj?.providerName),
    inspectors: Array.isArray(checklistObj?.inspectors)
      ? checklistObj.inspectors.filter((name) => typeof name === 'string' && name.trim())
      : [],
    interviewee: safeString(sessionObj?.summary?.interviewee),
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
      complianceStatus: normalizeCompliance(response?.compliance),
    }

    const requirement = safeString(row?.question)
    if (requirement) {
      item.requirementText = requirement
    }

    const verificationMethod = safeString(row?.verification)
    if (verificationMethod) {
      item.itemVerificationMethod = verificationMethod
    }

    const comment = safeString(response?.comments)
    if (comment) {
      item.inspectorComment = comment
    }

    const rowReference = row?.reference || {}
    const reglamento = safeString(rowReference?.normativa?.reglamento, '')
    const articulo = safeString(rowReference?.normativa?.articulo, '')
    const nationalRegulation = reglamento || safeString(rowReference?.nationalRegulation, '')
    const regulationItem = articulo || safeString(rowReference?.regulationItem, '')
    const usoapPqReference = Array.isArray(rowReference?.normativa?.usoapPqReference)
      ? rowReference.normativa.usoapPqReference
      : rowReference?.usoapPqReference
    const referenceObj = {
      icaoReference: safeString(rowReference?.normativa?.ICAOref || rowReference?.icaoReference),
      nationalRegulation: nationalRegulation,
      regulationItem: regulationItem,
    }

    if (referenceObj.icaoReference || referenceObj.nationalRegulation || referenceObj.regulationItem) {
      item.reference = {}
      if (referenceObj.icaoReference) {
        item.reference.icaoReference = referenceObj.icaoReference
      }
      if (referenceObj.nationalRegulation) {
        item.reference.nationalRegulation = referenceObj.nationalRegulation
      }
      if (referenceObj.regulationItem) {
        item.reference.regulationItem = referenceObj.regulationItem
      }
    }
    if (Array.isArray(usoapPqReference) && usoapPqReference.length > 0) {
      item.reference = item.reference || {}
      item.reference.usoapPqReference = usoapPqReference
    }

    const evidenceList = Array.isArray(response?.evidence) ? response.evidence : []
    const normalizedEvidence = evidenceList.map((entry) => normalizeEvidenceEntry(entry)).filter(Boolean)
    if (normalizedEvidence.length > 0) {
      item.evidenceItems = normalizedEvidence.map((ev, evidenceIndex) => {
        const mapped = {
          evidenceId: `EV-${String(index + 1).padStart(4, '0')}-${String(evidenceIndex + 1).padStart(2, '0')}`,
          evidenceType: inferEvidenceType(ev.name),
          source: ev.name,
          evidenceRole: item.complianceStatus === 'Non-Compliant' ? 'Finding Support' : 'Compliance Evidence',
        }
        const collectionDate = safeString(ev.collectionDate)
        if (collectionDate) {
          mapped.collectionDate = asDateOnly(collectionDate)
        }
        if (ev.hashValue) {
          mapped.hashValue = ev.hashValue
        }
        if (ev.immutable) {
          mapped.immutable = true
        }
        if (ev.sealedDate) {
          mapped.sealedDate = ev.sealedDate
        }
        return mapped
      })
    }

    const nominalRiskLevel = normalizeRiskLevel(row?.riskLevel)
    if (nominalRiskLevel) {
      item.nominalRisk = nominalRiskLevel
    }

    return item
  })

  return {
    schemaVersion: '1.0',
    checklist: checklistSection,
    items,
  }
}

const mapFindingsPayload = ({ checklistPayload, checklistObj, sessionObj, specialty, operator }) => {
  const questions = Array.isArray(checklistObj?.questions) ? checklistObj.questions : []
  const responses = sessionObj?.responses || {}
  const specialtyCode = inferSpecialtyCode(checklistObj, specialty)

  const dateIssued = asDateOnly(sessionObj?.summary?.lastUpdated || checklistObj?.startDate)
  const inspectionCompact = compactInspectionCode(checklistPayload?.checklist?.inspectionCode)

  const findings = []

  questions.forEach((row, index) => {
    const response = findResponseForRow(responses, row, index) || {}
    if (normalizeCompliance(response?.compliance) !== 'Non-Compliant') {
      return
    }

    const findingNumber = findings.length + 1
    const finding = {
      schemaVersion: '1.0',
      finding: {
        contentType: 'Finding',
        findingId: `H-${inspectionCompact}-${specialtyCode}-${String(findingNumber).padStart(3, '0')}`,
        providerId: checklistPayload?.checklist?.providerId || '',
        providerName: checklistPayload?.checklist?.providerName || safeString(checklistObj?.providerName),
        locationId: checklistPayload?.checklist?.locationId || '',
        locationCode: checklistPayload?.checklist?.locationCode || '',
        locationName:
          checklistPayload?.checklist?.locationName || safeString(checklistObj?.locationName),
        specialtyId: checklistPayload?.checklist?.specialtyId || '',
        specialtyCode,
        specialtyName: checklistPayload?.checklist?.specialtyName || safeString(specialty),
        inspectionId: checklistPayload?.checklist?.inspectionId || '',
        checklistItemCode: inferItemCode(row, specialtyCode, index),
        description: safeString(
          response?.nonConformityDetails?.description || response?.comments || row?.question
        ),
        findingStatus: 'Open',
      },
    }

    if (operator?.userName) {
      finding.finding.declaredBy = operator.userName
    }
    if (operator?.inspectorId) {
      finding.finding.inspectorId = operator.inspectorId
    }

    const reglamento = safeString(row?.reference?.normativa?.reglamento, '')
    const articulo = safeString(row?.reference?.normativa?.articulo, '')
    const nationalRegulation = reglamento || safeString(row?.reference?.nationalRegulation, '')
    const regulationItem = articulo || safeString(row?.reference?.regulationItem, '')
    const requirementBreached = nationalRegulation || ''
    if (requirementBreached) {
      finding.finding.requirementBreached = requirementBreached
      finding.finding.nationalRegulation = nationalRegulation
      if (regulationItem) {
        finding.finding.regulationItem = regulationItem
      }
    }

    const icaoReference = safeString(row?.reference?.normativa?.ICAOref || row?.reference?.icaoReference)
    if (icaoReference) {
      finding.finding.icaoReference = icaoReference
    }

    const usoapPqReference = Array.isArray(row?.reference?.normativa?.usoapPqReference)
      ? row.reference.normativa.usoapPqReference
      : row?.reference?.usoapPqReference
    if (Array.isArray(usoapPqReference) && usoapPqReference.length > 0) {
      finding.finding.usoapPqReference = usoapPqReference
    }

    finding.finding.dateIssued = dateIssued
    finding.finding.lastStatusChange = dateIssued

    const riskLevel = normalizeRiskLevel(
      response?.nonConformityDetails?.riskLevel || row?.riskLevel
    )
    if (riskLevel) {
      finding.finding.riskClassification = riskLevel
    }

    finding.finding.findingLevel = normalizeFindingLevel(
      response?.nonConformityDetails?.findingLevel || response?.findingLevel
    )

    finding.finding.findingSeverity = safeString(
      response?.nonConformityDetails?.findingSeverity
    ) || 'C'

    findings.push(finding)
  })

  return findings
}

const resolveResidualRisk = (response, finding) => {
  const validLevels = ['Low', 'Medium', 'High', 'Critical']
  const fromResponse = safeString(response?.currentResidualRisk)
  if (fromResponse && validLevels.includes(fromResponse)) return fromResponse
  const fromFinding = safeString(finding?.riskClassification)
  if (fromFinding && validLevels.includes(fromFinding)) return fromFinding
  return 'Low'
}

const mapFollowUpReportsPayload = ({ findingsObj, followUpSessionObj, operator }) => {
  const findings = Array.isArray(findingsObj) ? findingsObj : []
  const responses = followUpSessionObj?.responses || {}

  return Object.entries(responses).map(([findingId, response], index) => {
    const effectiveFindingId = safeString(response?.findingId, findingId)
    const findingEntry = findings.find((entry) => {
      const wrappedId = safeString(entry?.finding?.findingId)
      const flatId = safeString(entry?.findingId)
      return wrappedId === effectiveFindingId || flatId === effectiveFindingId
    })

    const finding = findingEntry?.finding || findingEntry
    if (!finding?.findingId) {
      throw new Error(`Could not find source finding for follow-up response ${effectiveFindingId}`)
    }

    const correctiveAction = finding?.correctiveAction

    // Compose followUpType and CAP logic. The vocabulary and the legacy
    // "Progress Verification" alias come from the shared domain-rule spec.
    const followUpType = normalizeFollowUpType(response?.followUpType)
    const capId = correctiveAction?.capId || null
    // Only allow CAP Verification if capId exists
    const allowedTypes = allowedFollowUpTypes({ hasCorrectiveAction: Boolean(capId) })
    const type = allowedTypes.includes(followUpType) ? followUpType : DEFAULT_FOLLOW_UP_TYPE

    // Effectiveness logic
    let effectivenessConfirmed = null
    if (type === CLOSURE_FOLLOW_UP_TYPE) {
      if (typeof response?.effectivenessConfirmed === 'boolean') {
        effectivenessConfirmed = response.effectivenessConfirmed
      } else {
        throw new Error('effectivenessConfirmed must be set for Closure Verification follow-up')
      }
    }

    const report = {
      schemaVersion: '1.0',
      followUpReport: {
        contentType: 'FollowUpReport',
        findingId: effectiveFindingId,
        providerId: safeString(finding.providerId),
        providerName: safeString(finding.providerName),
        locationId: safeString(finding.locationId),
        locationCode: safeString(finding.locationCode),
        locationName: safeString(finding.locationName),
        inspectionId: safeString(finding.inspectionId),
        followUpDate: safeString(
          response?.followUpDate,
          safeString(followUpSessionObj?.summary?.lastUpdated, new Date().toISOString())
        ),
        percentComplete: Math.max(0, Math.min(100, Number(response?.percentComplete || 0))),
        followUpType: type,
        effectivenessConfirmed,
        capId,
        currentResidualRisk: resolveResidualRisk(response, finding),
      },
    }

    const specialtyId = safeString(finding?.specialtyId)
    if (specialtyId) {
      report.followUpReport.specialtyId = specialtyId
    }
    const specialtyCode = safeString(finding?.specialtyCode)
    if (specialtyCode) {
      report.followUpReport.specialtyCode = specialtyCode
    }
    const specialtyName = safeString(finding?.specialtyName)
    if (specialtyName) {
      report.followUpReport.specialtyName = specialtyName
    }

    // Pre-verification attribution, as in mapChecklistPayload.
    if (operator?.userName) {
      report.followUpReport.declaredBy = operator.userName
    }
    if (operator?.inspectorId) {
      report.followUpReport.inspectorId = operator.inspectorId
    }

    const closureVerificationMethod = safeString(response?.closureVerificationMethod)
    if (closureVerificationMethod) {
      report.followUpReport.closureVerificationMethod = closureVerificationMethod
    }

    const comment = safeString(response?.comments)
    if (comment) {
      report.followUpReport.followUpComment = comment
    }

    if (type === 'Closure Verification' && response?.followUpClosureDate) {
      report.followUpReport.followUpClosureDate = asDateOnly(
        response?.followUpClosureDate || report.followUpReport.followUpDate
      )
    }

    // Evidence mapping with evidenceRole
    const evidenceList = Array.isArray(response?.evidence) ? response.evidence : []
    const normalizedEvidence = evidenceList.map((entry) => normalizeEvidenceEntry(entry)).filter(Boolean)
    if (normalizedEvidence.length > 0) {
      report.followUpReport.evidenceItems = normalizedEvidence.map((ev, evidenceIndex) => {
        const mapped = {
          evidenceId: `FUEV-${String(index + 1).padStart(4, '0')}-${String(evidenceIndex + 1).padStart(2, '0')}`,
          evidenceType: inferEvidenceType(ev.name),
          source: ev.name,
        }
        const collectionDate = safeString(ev.collectionDate)
        if (collectionDate) {
          mapped.collectionDate = asDateOnly(collectionDate)
        }
        if (ev.hashValue) mapped.hashValue = ev.hashValue
        if (ev.immutable) mapped.immutable = true
        if (ev.sealedDate) mapped.sealedDate = ev.sealedDate
        // Only allow Progress/Closure Evidence
        if (type === 'Closure Verification') {
          mapped.evidenceRole = 'Closure Evidence'
        } else {
          mapped.evidenceRole = 'Progress Evidence'
        }
        return mapped
      })
    }

    return report
  })
}

const normalizeFindingForFollowUpExport = (entry) => {
  const finding = {
    ...(entry?.finding || entry || {}),
  }

  if (!finding.riskClassification && finding.riskLevel) {
    finding.riskClassification = finding.riskLevel
  }
  delete finding.riskLevel

  if (!finding.requirementBreached && finding.regulationBreached) {
    finding.requirementBreached = finding.regulationBreached
  }
  delete finding.regulationBreached

  if (!finding.checklistItemCode) {
    finding.checklistItemCode = safeString(finding.itemCode, safeString(finding.itemId))
  }
  delete finding.itemId
  delete finding.itemCode

  if (!finding.checklistItemCode) {
    finding.checklistItemCode = 'UNKNOWN'
  }

  if (finding.comment && !finding.followUpComment) {
    finding.followUpComment = finding.comment
  }
  delete finding.comment

  delete finding.domain
  delete finding.capId

  const normalizeDateField = (fieldName) => {
    const value = safeString(finding[fieldName])
    if (!value) {
      delete finding[fieldName]
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      delete finding[fieldName]
      return
    }
    finding[fieldName] = value
  }

  normalizeDateField('dateIssued')
  normalizeDateField('submissionDeadline')
  normalizeDateField('findingClosureDate')
  normalizeDateField('lastStatusChange')
  normalizeDateField('resolutionDeadline')

  if (Array.isArray(finding.correctiveAction)) {
    finding.correctiveAction = finding.correctiveAction.find((item) => item && typeof item == 'object') || null
  }
  if (finding.correctiveAction && typeof finding.correctiveAction != 'object') {
    delete finding.correctiveAction
  }
  if (finding.correctiveAction === null) {
    delete finding.correctiveAction
  }

  const validRiskLevels = ['Low', 'Medium', 'High', 'Critical']
  if (finding.riskClassification && !validRiskLevels.includes(finding.riskClassification)) {
    delete finding.riskClassification
  }

  return {
    schemaVersion: '1.0',
    finding,
  }
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
      const dirPath = workspaceBase(filePath)
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
      const dirPath = workspaceBase(filePath)
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
      const dirPath = workspaceBase(filePath)
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
      const dirPath = workspaceBase(filePath)
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
      const dirPath = workspaceBase(filePath)
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
      const dirPath = workspaceBase(filePath)
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
      const dirPath = workspaceBase(filePath)
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

      const dirPath = workspaceBase(filePath)
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
      const dirPath = workspaceBase(filePath)
      const toFilePath = safeJoin(dirPath, pathLegs)
      const deleted = await deleteFile(toFilePath)
      return deleted
    } catch (err) {
      logger.error(`delete-file: Could not delete file ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('delete-path', async (event, filePath, pathLegs) => {
    try {
      const dirPath = workspaceBase(filePath)
      if (!Array.isArray(pathLegs) || pathLegs.length == 0) {
        throw new Error('Missing required path segments for delete-path')
      }
      const toDeletePath = safeJoin(dirPath, pathLegs)
      await fs.rm(toDeletePath, { recursive: true, force: true })
      return true
    } catch (err) {
      logger.error(`delete-path: Could not delete path ${filePath} ${pathLegs} : ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('generate-pdf', async (event, { checklistString, sessionString, specialty, outputPath, locale }) => {
    try {
      if (!checklistString || !sessionString || !specialty || !outputPath) {
        throw new Error('Missing required parameters: checklistString, sessionString, specialty, outputPath')
      }
      // Header branding lives in app.config.json (reportHeader), the checklist
      // app's own copy of the entity-profile idea — it never reads Alfresco's.
      const appConfig = await readAppConfig().catch(() => ({}))
      const result = await generateFindingsReport({
        checklistString,
        sessionString,
        specialty,
        outputPath: assertInsideWorkspace(outputPath, 'generate-pdf: outputPath'),
        locale,
        reportHeader: appConfig?.reportHeader || {},
      })
      return result
    } catch (err) {
      logger.error(`generate-pdf: Could not generate PDF: ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('settings:getLocale', async () => {
    try {
      return await getLocale()
    } catch (err) {
      logger.error(`settings:getLocale: Could not read locale: ${err.message}`)
      return 'en'
    }
  })

  ipcMain.handle('settings:setLocale', async (event, locale) => {
    try {
      return await setLocale(locale)
    } catch (err) {
      logger.error(`settings:setLocale: Could not save locale: ${err.message}`)
      throw err
    }
  })

  ipcMain.handle('open-file', async (event, filePath) => {
    if (!filePath) {
      logger.error('open-file: Missing required parameter: filePath')
      throw new Error('Missing required parameter: filePath')
    }

    // Only files inside the workspace may be handed to the operating system.
    const safeFilePath = assertInsideWorkspace(filePath, 'open-file: filePath')

    logger.info(`open-file: Opening file ${safeFilePath}`)

    try {
      // Fire-and-forget: shell.openPath() may not resolve until the application exits,
      // so we initiate the open but don't wait for it to complete.
      // Any errors opening the file will be handled by the OS.
      shell.openPath(safeFilePath).then(
        (errorMsg) => {
          if (errorMsg) {
            logger.error(`open-file: OS error opening ${safeFilePath}: ${errorMsg}`)
          } else {
            logger.info(`open-file: OS successfully opened ${safeFilePath}`)
          }
        },
        (err) => {
          logger.error(`open-file: Failed to open ${safeFilePath}: ${err?.message || String(err)}`)
        }
      )

      logger.info(`open-file: File open initiated for ${safeFilePath}`)
      return { success: true }
    } catch (err) {
      // Catch any synchronous errors (e.g., invalid path)
      const errMsg = err?.message || String(err)
      logger.error(`open-file: Error initiating file open for ${safeFilePath}: ${errMsg}`)
      throw new Error(`Could not open file: ${errMsg}`)
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

  ipcMain.handle('write-app-config', async (event, config) => {
    try {
      const configPath = writableAppConfigPath()
      const existing = await readAppConfig().catch(() => ({}))
      const merged = { ...existing, ...config }
      await saveFile(configPath, JSON.stringify(merged, null, 2))
      return true
    } catch (err) {
      logger.error(`write-app-config: Could not write app config: ${err.message}`)
      return false
    }
  })

  /**
   * Hash a list of evidence file names and return their SHA-256 digests.
   * Files are streamed so memory usage stays constant regardless of file size.
   *
   * @param {string[]} filePaths  Evidence file names relative to the resolved parent directory.
   * @param {string} filePath  Base directory path for the files.
   * @param {string[]} pathLegs  Additional path segments appended to filePath to resolve the parent directory.
   * @returns {Promise<Object>} Object mapping each evidence file name to its hash value.
   */
  ipcMain.handle('hash-evidence-files', async (event, filePaths, filePath, pathLegs) => {
    if (!Array.isArray(filePaths)) {
      throw new Error('hash-evidence-files: filePaths must be an array')
    }
    const dirPath = workspaceBase(filePath)
    const parentDir = safeJoin(dirPath, pathLegs)

    const resultObj = {}
    try {
      for (const evidencePath of filePaths) {
        const fullFilePath = safeJoin(parentDir, evidencePath)
        const hashValue = await hashFile(fullFilePath)
        resultObj[evidencePath] = hashValue
      }
      return resultObj
    } catch (err) {
      logger.warn(`hash-evidence-files: could not hash: ${err.message}`)
      throw err
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

  ipcMain.handle('read-api-key', async () => {
    const data = await readCredentialFile(API_KEY_FILE).catch(() => null)
    return typeof data?.key === 'string' ? data.key : null
  })

  ipcMain.handle('save-api-key', async (event, key) => {
    const trimmed = String(key || '').trim()
    const usingPublishedPlaceholder = trimmed === PUBLISHED_GATEWAY_KEY

    if (usingPublishedPlaceholder) {
      logger.warn(
        'Credentials: the saved gateway API key is the public placeholder committed to ' +
          'compliance_flow/.env.example. Everyone who has cloned the repositories knows it. ' +
          'This is expected against a demo stack and must not be used against a real one.'
      )
    }

    await writeCredentialFile(API_KEY_FILE, { key: trimmed })

    // Returned so the renderer can surface the warning; the previous contract
    // was a bare `true`, and every caller only awaits it, so an object is a
    // safe widening.
    return { saved: true, usingPublishedPlaceholder }
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

      // Sync-time operator sign-in: the workspace's confirmed operator signs in
      // here, the ticket authenticates the Alfresco writes and the identity is
      // carried on the payload. Nothing is persisted.
      const operatorInput = payload?.operator || null
      const operator = operatorInput ? await authenticateOperator(operatorInput) : null
      const attributedOperator = operator
        ? { ...operator, inspectorId: safeString(operatorInput?.inspectorId) }
        : null

      const checklistPayload = mapChecklistPayload({
        checklistObj,
        sessionObj,
        specialty,
        operator: attributedOperator,
      })
      const findingsPayload = mapFindingsPayload({
        checklistPayload,
        checklistObj,
        sessionObj,
        specialty,
        operator: attributedOperator,
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

      const dirPath = workspaceBase(filePath)
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
      const headers = {}
      if (payload?.apiKey) {
        headers['X-API-Key'] = payload.apiKey
      }
      if (operator?.ticket) {
        headers['X-Alfresco-Ticket'] = operator.ticket
      }
      const response = await fetch(targetUrl, {
        method: 'POST',
        body: form,
        headers,
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

      const normalizedFindingsObj = Array.isArray(findingsObj)
        ? findingsObj.map((entry) => normalizeFindingForFollowUpExport(entry))
        : []

      // Sync-time operator sign-in (see export-inspection-payload).
      const operatorInput = payload?.operator || null
      const operator = operatorInput ? await authenticateOperator(operatorInput) : null
      const attributedOperator = operator
        ? { ...operator, inspectorId: safeString(operatorInput?.inspectorId) }
        : null

      const followUpReportsPayload = mapFollowUpReportsPayload({
        findingsObj: normalizedFindingsObj,
        followUpSessionObj,
        operator: attributedOperator,
      })

      const validateFinding = ajv.compile(sourceFindingSchema)
      const validateFollowUpReport = ajv.compile(followUpReportSchema)

      normalizedFindingsObj.forEach((finding, index) => {
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

      const dirPath = workspaceBase(filePath)
      const workspaceFolder = locationId
        ? buildWorkspaceFolderName(locationId, specialty)
        : sanitizeWorkspaceLeg(String(specialty).toUpperCase())
      const workspacePath = safeJoin(dirPath, [workspaceFolder])
      const followUpEvidencePath = safeJoin(dirPath, [workspaceFolder, 'FollowUpEvidence'])
      await ensureDir(workspacePath)

      const zip = new JSZip()
      zip.file('prior-findings.json', JSON.stringify(normalizedFindingsObj, null, 2))
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
      const headers = {}
      if (payload?.apiKey) {
        headers['X-API-Key'] = payload.apiKey
      }
      if (operator?.ticket) {
        headers['X-Alfresco-Ticket'] = operator.ticket
      }
      const response = await fetch(targetUrl, {
        method: 'POST',
        body: form,
        headers,
      })

      const responseText = await response.text()
      if (!response.ok) {
        throw new Error(`Follow-up import API failed with status ${response.status}: ${responseText}`)
      }

      let uploadBodyJson = null
      try {
        uploadBodyJson = JSON.parse(responseText)
      } catch {
        uploadBodyJson = null
      }

      const followUpFiles = Array.isArray(uploadBodyJson?.followUpFiles)
        ? uploadBodyJson.followUpFiles
        : Array.isArray(uploadBodyJson?.followUpFilenames)
          ? uploadBodyJson.followUpFilenames
          : []

      return {
        zipPath,
        uploadStatus: response.status,
        uploadBody: responseText,
        followUpFiles,
        reportsCount: followUpReportsPayload.length,
      }
    } catch (err) {
      logger.error(`export-follow-up-payload: Could not create/upload payload: ${err.message}`)
      throw err
    }
  })
}
