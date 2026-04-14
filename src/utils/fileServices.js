import { parseChecklist } from './checklist.js'
import { parseFindings } from './findings.js'
import { parseSession } from './session.js'

export const createFileService = () => {
  // Default maximum file upload size
  const EVIDENCE_MAX_SIZE = getSizeAndSuffix('10MB')
  const DEFAULT_ROOT = null

  let saveTimer

  const WORKSPACE_META_FILE = 'workspace.json'
  const WORKSPACES_FILE = 'workspaces.json'

  const INSPECTION_PAYLOAD_PREFIX = 'inspection_payload_'
  const FOLLOWUP_PAYLOAD_PREFIX = 'followup_payload_'
  const FINDINGS_REPORT_PREFIX = 'reporte_hallazgos_'

  const ensureWorkspaceLeg = (value, label) => {
    if (typeof value != 'string' || value.trim().length == 0) {
      throw new Error(`Invalid ${label}: ${value}`)
    }
    return value.trim()
  }

  const sanitizeWorkspaceLeg = (value) => value.replace(/[^A-Za-z0-9_-]/g, '_')

  const normalizeSpecialty = (entry) => {
    if (!entry || typeof entry != 'object') {
      return null
    }
    const code = ensureWorkspaceLeg(String(entry.code || ''), 'specialty.code').toUpperCase()
    return {
      id: entry.id || code,
      code,
      name: entry.name || code,
    }
  }

  const normalizeLocation = (entry) => {
    if (!entry || typeof entry != 'object') {
      return null
    }
    const icaoCode = ensureWorkspaceLeg(String(entry.icaoCode || entry.locationId || ''), 'location.icaoCode').toUpperCase()
    return {
      id: entry.id || icaoCode,
      name: entry.name || icaoCode,
      icaoCode,
    }
  }

  const getWorkspaceKey = (locationId, specialtyCode) => {
    const safeLocationId = sanitizeWorkspaceLeg(ensureWorkspaceLeg(locationId, 'locationId'))
    const safeSpecialtyCode = sanitizeWorkspaceLeg(
      ensureWorkspaceLeg(specialtyCode, 'specialtyCode').toUpperCase()
    )
    return `${safeLocationId}__${safeSpecialtyCode}`
  }

  const getWorkspaceLegs = (specialtyCode, locationId) => {
    const safeSpecialtyCode = ensureWorkspaceLeg(specialtyCode, 'specialtyCode').toUpperCase()
    if (!locationId) {
      return [safeSpecialtyCode]
    }
    const locationShortName = sanitizeWorkspaceLeg(ensureWorkspaceLeg(locationId, 'locationId').toUpperCase())
    return [`${locationShortName}_${sanitizeWorkspaceLeg(safeSpecialtyCode)}`]
  }

  const getWorkspacePaths = (specialtyCode, locationId) => {
    const legs = getWorkspaceLegs(specialtyCode, locationId)
    return {
      legs,
      metadata: [...legs, WORKSPACE_META_FILE],
      checklist: [...legs, 'checklist.json'],
      findings: [...legs, 'findings.json'],
      session: [...legs, 'session.json'],
      followUpSession: [...legs, 'followup.session.json'],
      evidenceDir: [...legs, 'Evidence'],
      followUpEvidenceDir: [...legs, 'FollowUpEvidence'],
      audioDir: [...legs, 'Audio'],
    }
  }

  function getSizeAndSuffix(sizeString) {
    const suffix = [
      { finder: 'B', power: 0, base: 1 },
      { finder: 'KB', power: 1, base: 1000, label: 'kB' },
      { finder: 'MB', power: 2, base: 1000 },
      { finder: 'GB', power: 3, base: 1000 },
      { finder: 'KIB', power: 1, base: 1024, label: 'KiB' },
      { finder: 'MIB', power: 2, base: 1024, label: 'MiB' },
      { finder: 'GIB', power: 3, base: 1024, label: 'GiB' },
    ]

    // separate the size and the suffix
    const ss = sizeString.match(/^([0-9]+([.][0-9]+){0,1})|([kmg]i{0,1}){0,1}b$/gi)
    if (!ss) {
      throw new Error('Invalid file size format: ' + sizeString)
    }

    // get information about the suffix
    const suffixInfo = suffix.find((x) => x.finder == ss[1].toUpperCase())

    const totalSize = Number.parseFloat(ss[0]) * Math.pow(suffixInfo.base, suffixInfo.power)
    const sizeLabel = 'label' in suffixInfo ? suffixInfo.label : suffixInfo.finder

    return { size: totalSize, label: ss[0] + sizeLabel }
  }

  const defaultPathExists = async () => {
    try {
      return await window.electronAPI.checkPath(DEFAULT_ROOT)
    } catch (error) {
      throw new Error('defaultPathExists: could not check default path: ' + error.message)
    }
  }

  const setSavePath = async (specialty, locationId = null) => {
    try {
      const workspaceLegs = getWorkspaceLegs(specialty, locationId)
      const filePath = window.electronAPI.getPath(DEFAULT_ROOT, ...workspaceLegs)
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...workspaceLegs)) {
        return filePath
      } else {
        return null
      }
    } catch (error) {
      throw new Error(
        `setSavePath: could not save path ${specialty}${locationId ? `/${locationId}` : ''} : ` +
          error.message
      )
    }
  }

  const createDefaultPath = async (filePath) => {
    try {
      await window.electronAPI.createDir(DEFAULT_ROOT, filePath, 'Evidence')
    } catch (error) {
      throw new Error(`createDefaultPath: could not create path ${filePath} : ` + error.message)
    }
  }

  const saveEvidence = async (specialty, fileName, buffer, locationId = null, evidenceContext = 'inspection') => {
    try {
      if (buffer === undefined) {
        throw new Error('Buffer is undefined')
      }
      const fileSize = buffer.byteLength
      if (fileSize > EVIDENCE_MAX_SIZE.size) {
        throw new Error(`File size exceeds ${EVIDENCE_MAX_SIZE.label} limit`)
      }
      if (fileSize == 0) {
        throw new Error('File is empty')
      }

      const paths = getWorkspacePaths(specialty, locationId)
      const evidenceDir = evidenceContext == 'followUp' ? paths.followUpEvidenceDir : paths.evidenceDir

      // save if file doesn't exist or the size is different
      const stats = await window.electronAPI.getStats(DEFAULT_ROOT, ...evidenceDir, fileName)
      if (!stats || fileSize != stats.size) {
        const savedPath = await window.electronAPI.saveFile(buffer, DEFAULT_ROOT, ...evidenceDir, fileName)
        return savedPath
      } else {
        return null
      }
    } catch (error) {
      throw new Error(
        `saveEvidence: could not save evidence for ${specialty}/${fileName} : ` + error.message
      )
    }
  }

  const deleteEvidence = async (specialty, fileName, locationId = null, evidenceContext = 'inspection') => {
    try {
      const paths = getWorkspacePaths(specialty, locationId)
      const evidenceDir = evidenceContext == 'followUp' ? paths.followUpEvidenceDir : paths.evidenceDir
      const deleted = await window.electronAPI.deleteFile(DEFAULT_ROOT, ...evidenceDir, fileName)
      return deleted
    } catch (error) {
      throw new Error(
        `deleteEvidence: could not delete evidence ${specialty}/${fileName} : ` + error.message
      )
    }
  }

  const loadChecklist = async (specialty, locationId = null) => {
    try {
      const paths = getWorkspacePaths(specialty, locationId)

      // check that the path exists
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.legs) == false) {
        await window.electronAPI.createDir(DEFAULT_ROOT, ...paths.evidenceDir)
        // create dummy checklist.json
        const dummyChecklist = {
          specialtyName: 'Demo Specialty',
          inspection: 'DEMO001',
          location: 'Demo Location',
          startDate: new Date().toISOString().split('T')[0],
          questions: [
            {
              id: 'demo-q1',
              topic: 'Getting Started',
              reference: 'REF001',
              question: 'Is this your first time using the Compliance Checklist application?',
              verification:
                'Review the application features and documentation to understand how to use it effectively.',
            }],
        }
        await window.electronAPI.saveFile(
          JSON.stringify(dummyChecklist, null, 2),
          DEFAULT_ROOT,
          ...paths.checklist
        )
      }

      const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, ...paths.checklist)
      return parseChecklist(fileContents)
    } catch (error) {
      throw new Error(
        `loadChecklist: could not load checklist for ${specialty}${locationId ? `/${locationId}` : ''} : ` +
          error.message
      )
    }
  }

  const getChecklistImportState = async (specialty, locationId = null) => {
    try {
      if (typeof specialty != 'string' || specialty.length == 0) {
        throw new Error('Invalid specialty value: ' + specialty)
      }

      const paths = getWorkspacePaths(specialty, locationId)

      const hasChecklist = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.checklist)
      const hasSession = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.session)

      let sessionFinalized = null
      if (hasSession) {
        const sessionContents = await window.electronAPI.readFile(DEFAULT_ROOT, ...paths.session)
        const sessionObj = parseSession(sessionContents)
        sessionFinalized = Boolean(sessionObj?.summary?.finalized)
      }

      return { hasChecklist, hasSession, sessionFinalized }
    } catch (error) {
      throw new Error(
        `getChecklistImportState: could not check import state for ${specialty}${locationId ? `/${locationId}` : ''} : ${error.message}`
      )
    }
  }

  const fetchChecklistFromApi = async (inspection, specialty) => {
    try {
      if (!inspection || !specialty) {
        throw new Error('Missing required parameters: inspection, specialty')
      }

      const config = await window.electronAPI.getAppConfig()
      const host = config?.api?.importHost || config?.api?.host || 'http://localhost:1880'

      const url = new URL(`${host}/checklist`)
      url.searchParams.set('inspection', inspection)
      url.searchParams.set('specialty', specialty)

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`Import failed with status ${response.status}`)
      }

      const data = await response.json()
      return parseChecklist(JSON.stringify(data))
    } catch (error) {
      throw new Error(`fetchChecklistFromApi: could not fetch checklist: ${error.message}`)
    }
  }

  const fetchFindingsFromApi = async (specialty, locationId, inspection = null) => {
    try {
      if (!specialty || !locationId) {
        throw new Error('Missing required parameters: specialty, locationId')
      }

      const config = await window.electronAPI.getAppConfig()
      const host = config?.api?.importHost || config?.api?.host || 'http://localhost:1880'

      const url = new URL(`${host}/findings/open`)
      url.searchParams.set('specialtyCode', specialty)
      url.searchParams.set('locationCode', locationId)
      if (inspection) {
        url.searchParams.set('inspection', inspection)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`Findings import failed with status ${response.status}`)
      }

      const data = await response.json()
      return parseFindings(JSON.stringify(data))
    } catch (error) {
      throw new Error(`fetchFindingsFromApi: could not fetch findings: ${error.message}`)
    }
  }

  const ensureSpecialtyEntry = async (specialty, specialtyName) => {
    try {
      if (!specialty) {
        throw new Error('Missing specialty code')
      }

      // Specialties are now sourced from API/app.config.json.
      // Keep this function for call-site compatibility without persisting user.config.json.
      return {
        code: specialty,
        name: specialtyName || specialty,
      }
    } catch (error) {
      throw new Error(`ensureSpecialtyEntry: could not update specialties: ${error.message}`)
    }
  }

  const replaceJsonFileSafely = async (payload, ...pathLegs) => {
    try {
      const normalizedPayload = typeof payload == 'string' ? JSON.parse(payload) : payload
      const jsonPayload = JSON.stringify(normalizedPayload, null, 2)
      return await window.electronAPI.saveFile(jsonPayload, DEFAULT_ROOT, ...pathLegs)
    } catch (error) {
      throw new Error(`replaceJsonFileSafely: could not replace ${pathLegs.join('/')} : ${error.message}`)
    }
  }

  const loadFindings = async (specialty, locationId = null) => {
    try {
      const { findings } = getWorkspacePaths(specialty, locationId)
      const found = await window.electronAPI.checkPath(DEFAULT_ROOT, ...findings)
      if (!found) {
        return null
      }

      const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, ...findings)
      return parseFindings(fileContents)
    } catch (error) {
      throw new Error(
        `loadFindings: could not load findings for ${specialty}${locationId ? `/${locationId}` : ''} : ${error.message}`
      )
    }
  }

  const saveFindings = async (specialty, findingsObj, locationId = null) => {
    try {
      if (!specialty || !findingsObj) {
        throw new Error('Missing required parameters: specialty, findingsObj')
      }

      const paths = getWorkspacePaths(specialty, locationId)
      await window.electronAPI.createDir(DEFAULT_ROOT, ...paths.legs)
      return await replaceJsonFileSafely(findingsObj, ...paths.findings)
    } catch (error) {
      throw new Error(`saveFindings: could not save findings: ${error.message}`)
    }
  }

  const getFindingsImportState = async (specialty, locationId = null) => {
    try {
      if (typeof specialty != 'string' || specialty.length == 0) {
        throw new Error('Invalid specialty value: ' + specialty)
      }

      const paths = getWorkspacePaths(specialty, locationId)
      const hasFindings = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.findings)
      const hasFollowUpSession = await window.electronAPI.checkPath(
        DEFAULT_ROOT,
        ...paths.followUpSession
      )

      let followUpFinalized = null
      if (hasFollowUpSession) {
        const sessionContents = await window.electronAPI.readFile(DEFAULT_ROOT, ...paths.followUpSession)
        const sessionObj = typeof sessionContents == 'string' ? JSON.parse(sessionContents) : sessionContents
        followUpFinalized = Boolean(sessionObj?.summary?.finalized)
      }

      return { hasFindings, hasFollowUpSession, followUpFinalized }
    } catch (error) {
      throw new Error(
        `getFindingsImportState: could not check findings import state for ${specialty}${locationId ? `/${locationId}` : ''} : ${error.message}`
      )
    }
  }

  const joinChecklistWithFindings = (checklist, findingsPayload) => {
    const baseChecklist = typeof checklist == 'string' ? parseChecklist(checklist) : checklist
    const findingsList =
      typeof findingsPayload == 'string' ? parseFindings(findingsPayload) : findingsPayload || []

    if (!baseChecklist || !Array.isArray(baseChecklist.questions)) {
      throw new Error('joinChecklistWithFindings: invalid checklist payload')
    }

    const findingMap = new Map()
    findingsList.forEach((entry) => {
      const findingId = entry?.findingId
      if (findingId) {
        findingMap.set(findingId, entry)
      }
    })

    const linkedFindingIds = new Set()
    const enrichedQuestions = baseChecklist.questions.map((question) => {
      const priorFindingId = question?.priorFindingId
      if (!priorFindingId) {
        return question
      }

      const priorFinding = findingMap.get(priorFindingId) || null
      if (priorFinding) {
        linkedFindingIds.add(priorFindingId)
      }

      return {
        ...question,
        priorFinding,
      }
    })

    const unmatchedFindings = findingsList.filter((entry) => {
      const findingId = entry?.findingId
      return findingId && !linkedFindingIds.has(findingId)
    })

    return {
      checklist: {
        ...baseChecklist,
        questions: enrichedQuestions,
      },
      unmatchedFindings,
    }
  }

  const saveChecklist = async (specialty, checklistObj, locationId = null) => {
    try {
      if (!specialty || !checklistObj) {
        throw new Error('Missing required parameters: specialty, checklistObj')
      }

      const paths = getWorkspacePaths(specialty, locationId)
      await window.electronAPI.createDir(DEFAULT_ROOT, ...paths.evidenceDir)
      const payload = JSON.stringify(checklistObj, null, 2)
      await window.electronAPI.saveFile(payload, DEFAULT_ROOT, ...paths.checklist)
    } catch (error) {
      throw new Error(`saveChecklist: could not save checklist: ${error.message}`)
    }
  }

  const loadSession = async (specialty, locationId = null) => {
    try {
      const paths = getWorkspacePaths(specialty, locationId)
      const found = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.session)
      if (found) {
        const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, ...paths.session)
        return parseSession(fileContents)
      } else {
        return null
      }
    } catch (error) {
      throw new Error(
        `loadSession: could not load session for ${specialty}${locationId ? `/${locationId}` : ''} : ` +
          error.message
      )
    }
  }

  const readEvidence = async (specialty, locationId = null, evidenceContext = 'inspection') => {
    try {
      const paths = getWorkspacePaths(specialty, locationId)
      const evidenceDir = evidenceContext == 'followUp' ? paths.followUpEvidenceDir : paths.evidenceDir
      const dirList = await window.electronAPI.listPath(DEFAULT_ROOT, ...evidenceDir)
      return dirList
    } catch (error) {
      throw new Error(
        `readEvidence: could not read evidence for ${specialty}${locationId ? `/${locationId}` : ''} : ` +
          error.message
      )
    }
  }

  const saveSession = (summary, responses, displayError, locationId = null) => {
    // make sure they are objects and not strings
    const newSummary = typeof summary == 'string' ? JSON.parse(summary) : summary
    const newResponses = typeof responses == 'string' ? JSON.parse(responses) : responses

    let sessionObj = { summary: newSummary, responses: newResponses }
    sessionObj.summary.lastUpdated = new Date().toISOString()

    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const sessionString = JSON.stringify(sessionObj, null, 2)
        const paths = getWorkspacePaths(newSummary.specialty, locationId)
        window.electronAPI.saveFile(
          sessionString,
          DEFAULT_ROOT,
          ...paths.session
        )
        return true
      } catch (err) {
        displayError(err.message)
      }
    }, 1000)

    return true
  }

  const loadFollowUpSession = async (specialty, locationId = null) => {
    try {
      const paths = getWorkspacePaths(specialty, locationId)
      const found = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.followUpSession)
      if (!found) {
        return null
      }

      const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, ...paths.followUpSession)
      return typeof fileContents == 'string' ? JSON.parse(fileContents) : fileContents
    } catch (error) {
      throw new Error(
        `loadFollowUpSession: could not load follow-up session for ${specialty}${locationId ? `/${locationId}` : ''} : ${error.message}`
      )
    }
  }

  const saveFollowUpSession = (summary, responses, displayError, locationId = null) => {
    const newSummary = typeof summary == 'string' ? JSON.parse(summary) : summary
    const newResponses = typeof responses == 'string' ? JSON.parse(responses) : responses

    const sessionObj = { summary: newSummary, responses: newResponses }
    sessionObj.summary.lastUpdated = new Date().toISOString()

    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const sessionString = JSON.stringify(sessionObj, null, 2)
        const paths = getWorkspacePaths(newSummary.specialty, locationId)
        window.electronAPI.saveFile(sessionString, DEFAULT_ROOT, ...paths.followUpSession)
        return true
      } catch (err) {
        displayError(err.message)
      }
    }, 1000)

    return true
  }

  const saveExportFile = async (csvContent, specialty) => {
    try {
      if (!csvContent || csvContent.length == 0) {
        throw new Error('Empty checklist detected')
      }
      const fileName = 'compliance_export.csv'
      await window.electronAPI.saveFile(csvContent, DEFAULT_ROOT, specialty, fileName)
    } catch (error) {
      throw new Error('saveExportFile: could not save file: ' + error.message)
    }
  }

  const loadSpecialties = async () => {
    const parseSpecialties = (entries) => {
      if (!Array.isArray(entries)) {
        return []
      }
      const seen = new Set()
      const normalized = []
      entries.forEach((entry) => {
        try {
          const specialty = normalizeSpecialty(entry)
          if (specialty && !seen.has(specialty.code)) {
            seen.add(specialty.code)
            normalized.push(specialty)
          }
        } catch {
          // ignore malformed records from external sources
        }
      })
      return normalized
    }

    try {
      const appConfig = await window.electronAPI.getAppConfig()
      const host = appConfig?.api?.importHost || appConfig?.api?.host || 'http://localhost:1880'

      try {
        const url = new URL(`${host}/specialties`)
        url.searchParams.set('option', 'leaf')
        const response = await fetch(url.toString())
        if (response.ok) {
          const specialties = parseSpecialties(await response.json())
          if (specialties.length > 0) {
            return specialties
          }
        }
      } catch {
        // fallback below
      }

      const fallback = parseSpecialties(appConfig?.fallback?.specialties)
      if (fallback.length > 0) {
        return fallback
      }

      throw new Error('No specialty data available from API or fallback config')
    } catch (error) {
      throw new Error(`loadSpecialties: could not load specialties : ` + error.message)
    }
  }

  const loadLocations = async () => {
    const parseLocations = (entries) => {
      if (!Array.isArray(entries)) {
        return []
      }
      const seen = new Set()
      const normalized = []
      entries.forEach((entry) => {
        try {
          const location = normalizeLocation(entry)
          if (location && !seen.has(location.icaoCode)) {
            seen.add(location.icaoCode)
            normalized.push(location)
          }
        } catch {
          // ignore malformed records from external sources
        }
      })
      return normalized
    }

    try {
      const appConfig = await window.electronAPI.getAppConfig()
      const host = appConfig?.api?.importHost || appConfig?.api?.host || 'http://localhost:1880'

      try {
        const response = await fetch(`${host}/location`)
        if (response.ok) {
          const locations = parseLocations(await response.json())
          if (locations.length > 0) {
            return locations
          }
        }
      } catch {
        // fallback below
      }

      const fallback = parseLocations(appConfig?.fallback?.locations)
      if (fallback.length > 0) {
        return fallback
      }

      throw new Error('No location data available from API or fallback config')
    } catch (error) {
      throw new Error(`loadLocations: could not load locations : ${error.message}`)
    }
  }

  const saveAudio = async (specialty, fileName, buffer, locationId = null) => {
    try {
      if (buffer === undefined) {
        throw new Error('Buffer is undefined')
      }
      const fileSize = buffer.byteLength
      if (fileSize == 0) {
        throw new Error('Audio file is empty')
      }

      const paths = getWorkspacePaths(specialty, locationId)
      const savedPath = await window.electronAPI.saveFile(
        buffer,
        DEFAULT_ROOT,
        ...paths.audioDir,
        fileName
      )
      return savedPath
    } catch (error) {
      throw new Error(
        `saveAudio: could not save audio for ${specialty}/${fileName} : ` + error.message
      )
    }
  }

  const deleteAudio = async (specialty, fileName, locationId = null) => {
    try {
      const paths = getWorkspacePaths(specialty, locationId)
      const deleted = await window.electronAPI.deleteFile(
        DEFAULT_ROOT,
        ...paths.audioDir,
        fileName
      )
      return deleted
    } catch (error) {
      throw new Error(
        `deleteAudio: could not delete audio ${specialty}/${fileName} : ` + error.message
      )
    }
  }

  const readAudio = async (specialty, locationId = null) => {
    try {
      const paths = getWorkspacePaths(specialty, locationId)
      const dirList = await window.electronAPI.listPath(DEFAULT_ROOT, ...paths.audioDir)
      return dirList
    } catch (error) {
      throw new Error(`readAudio: could not read audio for ${specialty} : ` + error.message)
    }
  }

  const loadWorkspaceRegistry = async () => {
    try {
      const found = await window.electronAPI.checkPath(DEFAULT_ROOT, WORKSPACES_FILE)
      if (!found) {
        return []
      }

      const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, WORKSPACES_FILE)
      const registry = typeof fileContents == 'string' ? JSON.parse(fileContents) : fileContents
      if (!Array.isArray(registry)) {
        return []
      }
      return registry
    } catch (error) {
      throw new Error(`loadWorkspaceRegistry: could not read workspace registry: ${error.message}`)
    }
  }

  const saveWorkspaceRegistry = async (registry) => {
    try {
      if (!Array.isArray(registry)) {
        throw new Error('Registry payload must be an array')
      }

      return await replaceJsonFileSafely(registry, WORKSPACES_FILE)
    } catch (error) {
      throw new Error(`saveWorkspaceRegistry: could not save workspace registry: ${error.message}`)
    }
  }

  const upsertWorkspaceRegistryEntry = async (entry) => {
    try {
      const specialtyCode = ensureWorkspaceLeg(entry?.specialtyCode, 'specialtyCode').toUpperCase()
      const locationId = ensureWorkspaceLeg(entry?.locationId, 'locationId')
      const workspaceKey = getWorkspaceKey(locationId, specialtyCode)

      const registry = await loadWorkspaceRegistry()
      const existingIndex = registry.findIndex((x) => x.workspaceKey == workspaceKey)
      const existingEntry = existingIndex >= 0 ? registry[existingIndex] : null

      const resolveBoolean = (fieldName, fallback = false) => {
        if (typeof entry?.[fieldName] == 'boolean') {
          return entry[fieldName]
        }
        if (typeof existingEntry?.[fieldName] == 'boolean') {
          return existingEntry[fieldName]
        }
        return fallback
      }

      const normalizedEntry = {
        workspaceKey,
        specialtyCode,
        specialtyName: entry?.specialtyName || existingEntry?.specialtyName || specialtyCode,
        locationId,
        locationName: entry?.locationName || existingEntry?.locationName || locationId,
        draftStatus: entry?.draftStatus || existingEntry?.draftStatus || 'draft',
        checklistTouched: resolveBoolean('checklistTouched', false),
        followUpTouched: resolveBoolean('followUpTouched', false),
        checklistUploaded: resolveBoolean('checklistUploaded', false),
        followUpUploaded: resolveBoolean('followUpUploaded', false),
        checklistPresent: resolveBoolean('checklistPresent', false),
        findingsPresent: resolveBoolean('findingsPresent', false),
        updatedAt: new Date().toISOString(),
      }

      if (existingIndex >= 0) {
        registry[existingIndex] = {
          ...registry[existingIndex],
          ...normalizedEntry,
        }
      } else {
        registry.push(normalizedEntry)
      }

      await saveWorkspaceRegistry(registry)
      return normalizedEntry
    } catch (error) {
      throw new Error(`upsertWorkspaceRegistryEntry: could not update workspace registry: ${error.message}`)
    }
  }

  const removeWorkspaceRegistryEntry = async (specialtyCode, locationId) => {
    try {
      const workspaceKey = getWorkspaceKey(locationId, specialtyCode)
      const registry = await loadWorkspaceRegistry()
      const filtered = registry.filter((entry) => entry.workspaceKey != workspaceKey)
      if (filtered.length != registry.length) {
        await saveWorkspaceRegistry(filtered)
      }
      return true
    } catch (error) {
      throw new Error(`removeWorkspaceRegistryEntry: could not update workspace registry: ${error.message}`)
    }
  }

  const loadWorkspaceMetadata = async (specialtyCode, locationId) => {
    try {
      const paths = getWorkspacePaths(specialtyCode, locationId)
      const found = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.metadata)
      if (!found) {
        return null
      }

      const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, ...paths.metadata)
      return typeof fileContents == 'string' ? JSON.parse(fileContents) : fileContents
    } catch (error) {
      throw new Error(
        `loadWorkspaceMetadata: could not read metadata for ${specialtyCode}/${locationId} : ${error.message}`
      )
    }
  }

  const saveWorkspaceMetadata = async (specialtyCode, locationId, metadata) => {
    try {
      const paths = getWorkspacePaths(specialtyCode, locationId)
      await window.electronAPI.createDir(DEFAULT_ROOT, ...paths.legs)
      return await replaceJsonFileSafely(metadata, ...paths.metadata)
    } catch (error) {
      throw new Error(
        `saveWorkspaceMetadata: could not save metadata for ${specialtyCode}/${locationId} : ${error.message}`
      )
    }
  }

  const markWorkspaceTouched = async (specialtyCode, locationId, touchedKey = 'checklistTouched') => {
    try {
      if (!locationId) {
        return null
      }

      const metadata = (await loadWorkspaceMetadata(specialtyCode, locationId)) || {}
      metadata[touchedKey] = true
      if (touchedKey == 'checklistTouched') {
        metadata.checklistUploaded = false
      }
      if (touchedKey == 'followUpTouched') {
        metadata.followUpUploaded = false
      }
      metadata.updatedAt = new Date().toISOString()
      await saveWorkspaceMetadata(specialtyCode, locationId, metadata)

      const registryEntry = await upsertWorkspaceRegistryEntry({
        specialtyCode,
        specialtyName: metadata.specialtyName || specialtyCode,
        locationId,
        locationName: metadata.locationName || locationId,
        draftStatus: metadata.draftStatus || 'draft',
        checklistTouched: touchedKey == 'checklistTouched' ? true : Boolean(metadata.checklistTouched),
        followUpTouched: touchedKey == 'followUpTouched' ? true : Boolean(metadata.followUpTouched),
        checklistUploaded: Boolean(metadata.checklistUploaded),
        followUpUploaded: Boolean(metadata.followUpUploaded),
      })

      return registryEntry
    } catch (error) {
      throw new Error(`markWorkspaceTouched: could not update touched state: ${error.message}`)
    }
  }

  const getWorkspaceTouchedState = async (specialtyCode, locationId) => {
    try {
      if (!locationId) {
        return { checklistTouched: false, followUpTouched: false }
      }

      const metadata = await loadWorkspaceMetadata(specialtyCode, locationId)
      if (metadata) {
        return {
          checklistTouched: Boolean(metadata?.checklistTouched),
          followUpTouched: Boolean(metadata?.followUpTouched),
        }
      }

      const registry = await loadWorkspaceRegistry()
      const workspaceKey = getWorkspaceKey(locationId, specialtyCode)
      const registryEntry = registry.find((entry) => entry.workspaceKey == workspaceKey)

      return {
        checklistTouched: Boolean(registryEntry?.checklistTouched),
        followUpTouched: Boolean(registryEntry?.followUpTouched),
      }
    } catch (error) {
      throw new Error(`getWorkspaceTouchedState: could not check touched state: ${error.message}`)
    }
  }

  const saveFindingsReport = async (checklist, session, specialty, locationId = null) => {
    try {
      if (!checklist || !session || !specialty) {
        throw new Error('Missing required parameters: checklist, session, specialty')
      }
      const fileName = `reporte_hallazgos_${new Date().toISOString().split('T')[0]}.pdf`
      const paths = getWorkspacePaths(specialty, locationId)
      const filePath = await window.electronAPI.getFullPath(DEFAULT_ROOT, ...paths.legs, fileName)
      const checklistString = JSON.stringify(checklist)
      const sessionString = JSON.stringify(session)
      const result = await window.electronAPI.generatePDF({
        checklistString,
        sessionString,
        specialty,
        outputPath: filePath,
      })
      return result
    } catch (error) {
      throw new Error(
        `saveFindingsReport: could not generate PDF` + (error.message ? `: ${error.message}` : '')
      )
    }
  }

  const exportInspectionPayload = async (checklist, session, specialty, locationId = null) => {
    try {
      if (!checklist || !session || !specialty) {
        throw new Error('Missing required parameters: checklist, session, specialty')
      }

      const resolvedLocationId = locationId || checklist?.locationId || checklist?.location || null
      const payload = {
        checklistString: JSON.stringify(checklist),
        sessionString: JSON.stringify(session),
        specialty,
      }
      if (resolvedLocationId) {
        payload.locationId = resolvedLocationId
      }

      const result = await window.electronAPI.exportInspectionPayload(payload)

      if (resolvedLocationId) {
        const metadata = (await loadWorkspaceMetadata(specialty, resolvedLocationId)) || {}
        metadata.specialtyCode = metadata.specialtyCode || specialty
        metadata.specialtyName = metadata.specialtyName || specialty
        metadata.locationId = metadata.locationId || resolvedLocationId
        metadata.locationName = metadata.locationName || resolvedLocationId
        metadata.checklistUploaded = true
        metadata.updatedAt = new Date().toISOString()
        await saveWorkspaceMetadata(specialty, resolvedLocationId, metadata)

        await upsertWorkspaceRegistryEntry({
          specialtyCode: specialty,
          specialtyName: metadata.specialtyName,
          locationId: resolvedLocationId,
          locationName: metadata.locationName,
          draftStatus: metadata.draftStatus || 'draft',
          checklistTouched: Boolean(metadata.checklistTouched),
          followUpTouched: Boolean(metadata.followUpTouched),
          checklistUploaded: true,
          followUpUploaded: Boolean(metadata.followUpUploaded),
          checklistPresent: metadata.checklistPresent,
          findingsPresent: metadata.findingsPresent,
        })
      }

      console.log('exportInspectionPayload: payload exported and uploaded successfully')
      return result
    } catch (error) {
      throw new Error(
        `exportInspectionPayload: could not export and upload payload` +
          (error.message ? `: ${error.message}` : '')
      )
    }
  }

  const exportFollowUpPayload = async (findings, followUpSession, specialty, locationId = null) => {
    try {
      if (!findings || !followUpSession || !specialty) {
        throw new Error('Missing required parameters: findings, followUpSession, specialty')
      }

      const result = await window.electronAPI.exportFollowUpPayload({
        findingsString: JSON.stringify(findings),
        followUpSessionString: JSON.stringify(followUpSession),
        specialty,
        locationId,
      })

      if (locationId) {
        const metadata = (await loadWorkspaceMetadata(specialty, locationId)) || {}
        metadata.specialtyCode = metadata.specialtyCode || specialty
        metadata.specialtyName = metadata.specialtyName || specialty
        metadata.locationId = metadata.locationId || locationId
        metadata.locationName = metadata.locationName || locationId
        metadata.followUpUploaded = true
        metadata.updatedAt = new Date().toISOString()
        await saveWorkspaceMetadata(specialty, locationId, metadata)

        await upsertWorkspaceRegistryEntry({
          specialtyCode: specialty,
          specialtyName: metadata.specialtyName,
          locationId,
          locationName: metadata.locationName,
          draftStatus: metadata.draftStatus || 'draft',
          checklistTouched: Boolean(metadata.checklistTouched),
          followUpTouched: Boolean(metadata.followUpTouched),
          checklistUploaded: Boolean(metadata.checklistUploaded),
          followUpUploaded: true,
          checklistPresent: metadata.checklistPresent,
          findingsPresent: metadata.findingsPresent,
        })
      }

      console.log('exportFollowUpPayload: payload exported and uploaded successfully')
      return result
    } catch (error) {
      throw new Error(
        `exportFollowUpPayload: could not export and upload follow-up payload` +
          (error.message ? `: ${error.message}` : '')
      )
    }
  }

  const notifyImportCanonical = async (inspection, specialtyName) => {
    if (!inspection || !specialtyName) {
      throw new Error('notifyImportCanonical: Missing required parameters: inspection, specialtyName')
    }

    const config = await window.electronAPI.getAppConfig()
    const host = config?.api?.host || 'http://localhost:1880'
    const delay = config?.api?.importCanonicalDelay ?? 3000
    const maxRetries = config?.api?.importCanonicalRetries ?? 3

    const url = new URL(`${host}/importCanonical`)
    url.searchParams.set('inspection', inspection)
    url.searchParams.set('specialty', specialtyName)

    // Wait for the previous Alfresco write to commit before triggering the import
    await new Promise((resolve) => setTimeout(resolve, delay))

    let lastError
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`importCanonical API failed with status ${response.status}`)
        }
        const data = await response.json().catch(() => null)
        if (data && data.success === false) {
          throw new Error(data.error || 'importCanonical reported failure')
        }
        return data
      } catch (error) {
        lastError = error
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`notifyImportCanonical: ${lastError.message}`)
  }

  const checkServiceHealth = async (serviceType) => {
    try {
      if (!serviceType || (serviceType != 'import' && serviceType != 'upload')) {
        throw new Error(`Unsupported service type: ${serviceType}`)
      }

      const config = await window.electronAPI.getAppConfig()
      const importHost = config?.api?.importHost || config?.api?.host || 'http://localhost:1880'
      const uploadHost = config?.api?.uploadHost || 'http://localhost:8000'
      const timeoutMs = config?.api?.serviceStatusTimeoutMs || 2500
      const baseUrl = serviceType == 'import' ? importHost : uploadHost

      return await window.electronAPI.checkServiceHealth({
        baseUrl,
        timeoutMs,
      })
    } catch (error) {
      return {
        online: false,
        baseUrl: null,
        status: 0,
        error: error.message,
      }
    }
  }

  const createDefaultRoot = async () => {
    // Ensure the default root exists
    await window.electronAPI.createDir(DEFAULT_ROOT)

      // Create the dummy specialty directory with Evidence subdirectory
      await window.electronAPI.createDir(DEFAULT_ROOT, 'DEMO', 'Evidence')
      
      // Create a dummy checklist.json for the DEMO specialty
      const dummyChecklist = {
        specialtyName: 'Demo Specialty',
        inspection: 'DEMO001',
        location: 'Demo Location',
        startDate: new Date().toISOString().split('T')[0],
        questions: [
          {
            id: 'demo-q1',
            topic: 'Getting Started',
            reference: 'REF001',
            question: 'Is this your first time using the Compliance Checklist application?',
            verification: 'Review the application features and documentation to understand how to use it effectively.'
          },
          {
            id: 'demo-q2',
            topic: 'Getting Started',
            reference: 'REF002',
            question: 'Have you reviewed the specialties available in the application?',
            verification: 'Check the specialty dropdown to see available options and create your own as needed.'
          },
          {
            id: 'demo-q3',
            topic: 'Getting Started',
            reference: 'REF003',
            question: 'Do you understand how to add evidence and audio files?',
            verification: 'Review the Evidence and Audio buttons in the checklist interface to understand the process.'
          }
        ]
      }
      await window.electronAPI.saveFile(JSON.stringify(dummyChecklist, null, 2), DEFAULT_ROOT, 'DEMO', 'checklist.json')
      
      return { success: true, message: 'Default root created successfully' }
  }

  const getWorkspaceSessionState = async (specialtyCode, locationId) => {
    const metadata = (await loadWorkspaceMetadata(specialtyCode, locationId)) || {}
    const registry = await loadWorkspaceRegistry()
    const workspaceKey = getWorkspaceKey(locationId, specialtyCode)
    const registryEntry = registry.find((entry) => entry.workspaceKey == workspaceKey) || {}

    const resolveBool = (key, fallback = false) => {
      if (typeof metadata?.[key] == 'boolean') {
        return metadata[key]
      }
      if (typeof registryEntry?.[key] == 'boolean') {
        return registryEntry[key]
      }
      return fallback
    }

    return {
      metadata,
      checklistTouched: resolveBool('checklistTouched', false),
      followUpTouched: resolveBool('followUpTouched', false),
      checklistUploaded: resolveBool('checklistUploaded', false),
      followUpUploaded: resolveBool('followUpUploaded', false),
    }
  }

  const removeWorkspaceArtifactsByPrefix = async (workspaceLegs, prefixes) => {
    try {
      const workspaceFiles = await window.electronAPI.listPath(DEFAULT_ROOT, ...workspaceLegs)
      const targets = workspaceFiles.filter(
        (entry) =>
          typeof entry?.name == 'string' &&
          prefixes.some((prefix) => entry.name.startsWith(prefix))
      )

      await Promise.all(
        targets.map((entry) => window.electronAPI.deleteFile(DEFAULT_ROOT, ...workspaceLegs, entry.name))
      )
    } catch {
      // Ignore list/delete errors for optional artifacts.
    }
  }

  const removeInspectionSession = async (specialtyCode, locationId = null) => {
    try {
      if (!specialtyCode || !locationId) {
        throw new Error('Missing required parameters: specialtyCode, locationId')
      }

      const paths = getWorkspacePaths(specialtyCode, locationId)
      const state = await getWorkspaceSessionState(specialtyCode, locationId)
      const canRemove = state.checklistUploaded || !state.checklistTouched
      if (!canRemove) {
        throw new Error('Inspection session cannot be removed until it is uploaded or remains untouched')
      }

      if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.session)) {
        await window.electronAPI.deleteFile(DEFAULT_ROOT, ...paths.session)
      }
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.evidenceDir)) {
        await window.electronAPI.deletePath(DEFAULT_ROOT, ...paths.evidenceDir)
      }
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.audioDir)) {
        await window.electronAPI.deletePath(DEFAULT_ROOT, ...paths.audioDir)
      }

      await removeWorkspaceArtifactsByPrefix(paths.legs, [
        INSPECTION_PAYLOAD_PREFIX,
        FINDINGS_REPORT_PREFIX,
      ])

      const hasInspectionSession = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.session)
      const hasFollowUpSession = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.followUpSession)

      if (!hasInspectionSession && !hasFollowUpSession) {
        if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.legs)) {
          await window.electronAPI.deletePath(DEFAULT_ROOT, ...paths.legs)
        }
        await removeWorkspaceRegistryEntry(specialtyCode, locationId)
        return { removed: true, workspaceDeleted: true }
      }

      const metadata = {
        ...state.metadata,
        specialtyCode: state.metadata?.specialtyCode || specialtyCode,
        specialtyName: state.metadata?.specialtyName || specialtyCode,
        locationId: state.metadata?.locationId || locationId,
        locationName: state.metadata?.locationName || locationId,
        checklistTouched: false,
        checklistUploaded: false,
        updatedAt: new Date().toISOString(),
      }

      await saveWorkspaceMetadata(specialtyCode, locationId, metadata)
      await upsertWorkspaceRegistryEntry({
        specialtyCode,
        specialtyName: metadata.specialtyName,
        locationId,
        locationName: metadata.locationName,
        draftStatus: metadata.draftStatus || 'draft',
        checklistTouched: false,
        followUpTouched: state.followUpTouched,
        checklistUploaded: false,
        followUpUploaded: state.followUpUploaded,
        checklistPresent: metadata.checklistPresent,
        findingsPresent: metadata.findingsPresent,
      })

      return { removed: true, workspaceDeleted: false }
    } catch (error) {
      throw new Error(`removeInspectionSession: could not remove inspection session: ${error.message}`)
    }
  }

  const removeFollowUpSession = async (specialtyCode, locationId = null) => {
    try {
      if (!specialtyCode || !locationId) {
        throw new Error('Missing required parameters: specialtyCode, locationId')
      }

      const paths = getWorkspacePaths(specialtyCode, locationId)
      const state = await getWorkspaceSessionState(specialtyCode, locationId)
      const canRemove = state.followUpUploaded || !state.followUpTouched
      if (!canRemove) {
        throw new Error('Follow-up session cannot be removed until it is uploaded or remains untouched')
      }

      if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.followUpSession)) {
        await window.electronAPI.deleteFile(DEFAULT_ROOT, ...paths.followUpSession)
      }
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.followUpEvidenceDir)) {
        await window.electronAPI.deletePath(DEFAULT_ROOT, ...paths.followUpEvidenceDir)
      }

      await removeWorkspaceArtifactsByPrefix(paths.legs, [FOLLOWUP_PAYLOAD_PREFIX])

      const hasInspectionSession = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.session)
      const hasFollowUpSession = await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.followUpSession)

      if (!hasInspectionSession && !hasFollowUpSession) {
        if (await window.electronAPI.checkPath(DEFAULT_ROOT, ...paths.legs)) {
          await window.electronAPI.deletePath(DEFAULT_ROOT, ...paths.legs)
        }
        await removeWorkspaceRegistryEntry(specialtyCode, locationId)
        return { removed: true, workspaceDeleted: true }
      }

      const metadata = {
        ...state.metadata,
        specialtyCode: state.metadata?.specialtyCode || specialtyCode,
        specialtyName: state.metadata?.specialtyName || specialtyCode,
        locationId: state.metadata?.locationId || locationId,
        locationName: state.metadata?.locationName || locationId,
        followUpTouched: false,
        followUpUploaded: false,
        updatedAt: new Date().toISOString(),
      }

      await saveWorkspaceMetadata(specialtyCode, locationId, metadata)
      await upsertWorkspaceRegistryEntry({
        specialtyCode,
        specialtyName: metadata.specialtyName,
        locationId,
        locationName: metadata.locationName,
        draftStatus: metadata.draftStatus || 'draft',
        checklistTouched: state.checklistTouched,
        followUpTouched: false,
        checklistUploaded: state.checklistUploaded,
        followUpUploaded: false,
        checklistPresent: metadata.checklistPresent,
        findingsPresent: metadata.findingsPresent,
      })

      return { removed: true, workspaceDeleted: false }
    } catch (error) {
      throw new Error(`removeFollowUpSession: could not remove follow-up session: ${error.message}`)
    }
  }
  
  return {
    getWorkspaceKey,
    getWorkspaceLegs,
    getWorkspacePaths,
    replaceJsonFileSafely,
    defaultPathExists,
    setSavePath,
    createDefaultPath,
    saveEvidence,
    deleteEvidence,
    loadChecklist,
    getChecklistImportState,
    fetchChecklistFromApi,
    fetchFindingsFromApi,
    loadFindings,
    saveFindings,
    getFindingsImportState,
    joinChecklistWithFindings,
    loadWorkspaceRegistry,
    saveWorkspaceRegistry,
    upsertWorkspaceRegistryEntry,
    removeWorkspaceRegistryEntry,
    loadWorkspaceMetadata,
    saveWorkspaceMetadata,
    markWorkspaceTouched,
    getWorkspaceTouchedState,
    ensureSpecialtyEntry,
    saveChecklist,
    loadSession,
    readEvidence,
    saveExportFile,
    saveSession,
    loadFollowUpSession,
    saveFollowUpSession,
    loadSpecialties,
    loadLocations,
    saveAudio,
    deleteAudio,
    readAudio,
    saveFindingsReport,
    exportInspectionPayload,
    exportFollowUpPayload,
    removeInspectionSession,
    removeFollowUpSession,
    notifyImportCanonical,
    checkServiceHealth,
    createDefaultRoot,
  }
}
