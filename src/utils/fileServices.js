import { parseChecklist } from './checklist.js'
import { parseSession } from './session.js'

export const createFileService = () => {
  // Default maximum file upload size
  const EVIDENCE_MAX_SIZE = getSizeAndSuffix('10MB')
  const DEFAULT_ROOT = null

  let saveTimer

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

  const setSavePath = async (specialty) => {
    try {
      const filePath = window.electronAPI.getPath(DEFAULT_ROOT, specialty)
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, specialty)) {
        return filePath
      } else {
        return null
      }
    } catch (error) {
      throw new Error(`setSavePath: could not save path ${specialty} : ` + error.message)
    }
  }

  const createDefaultPath = async (filePath) => {
    try {
      await window.electronAPI.createDir(DEFAULT_ROOT, filePath, 'Evidence')
    } catch (error) {
      throw new Error(`createDefaultPath: could not create path ${filePath} : ` + error.message)
    }
  }

  const saveEvidence = async (specialty, fileName, buffer) => {
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

      // save if file doesn't exist or the size is different
      const stats = await window.electronAPI.getStats(DEFAULT_ROOT, specialty, 'Evidence', fileName)
      if (!stats || fileSize != stats.size) {
        const savedPath = await window.electronAPI.saveFile(
          buffer,
          DEFAULT_ROOT,
          specialty,
          'Evidence',
          fileName
        )
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

  const deleteEvidence = async (specialty, fileName) => {
    try {
      const deleted = await window.electronAPI.deleteFile(
        DEFAULT_ROOT,
        specialty,
        'Evidence',
        fileName
      )
      return deleted
    } catch (error) {
      throw new Error(
        `deleteEvidence: could not delete evidence ${specialty}/${fileName} : ` + error.message
      )
    }
  }

  const loadChecklist = async (specialty) => {
    try {
      // check that the path exists
      if (await window.electronAPI.checkPath(DEFAULT_ROOT, specialty) == false) {
        await window.electronAPI.createDir(DEFAULT_ROOT, specialty, 'Evidence')
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
        await window.electronAPI.saveFile(JSON.stringify(dummyChecklist, null, 2), DEFAULT_ROOT, specialty, 'checklist.json')
      }

      const fileContents = await window.electronAPI.readFile(
        DEFAULT_ROOT,
        specialty,
        'checklist.json'
      )
      return parseChecklist(fileContents)
    } catch (error) {
      throw new Error(`loadChecklist: could not load checklist for ${specialty} : ` + error.message)
    }
  }

  const getChecklistImportState = async (specialty) => {
    try {
      if (typeof specialty != 'string' || specialty.length == 0) {
        throw new Error('Invalid specialty value: ' + specialty)
      }

      const hasChecklist = await window.electronAPI.checkPath(
        DEFAULT_ROOT,
        specialty,
        'checklist.json'
      )
      const hasSession = await window.electronAPI.checkPath(
        DEFAULT_ROOT,
        specialty,
        'session.json'
      )

      let sessionFinalized = null
      if (hasSession) {
        const sessionContents = await window.electronAPI.readFile(
          DEFAULT_ROOT,
          specialty,
          'session.json'
        )
        const sessionObj = parseSession(sessionContents)
        sessionFinalized = Boolean(sessionObj?.summary?.finalized)
      }

      return { hasChecklist, hasSession, sessionFinalized }
    } catch (error) {
      throw new Error(
        `getChecklistImportState: could not check import state for ${specialty} : ${error.message}`
      )
    }
  }

  const fetchChecklistFromApi = async (inspection, specialty) => {
    try {
      if (!inspection || !specialty) {
        throw new Error('Missing required parameters: inspection, specialty')
      }

      const url = new URL('http://localhost:1880/checklist')
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

  const ensureSpecialtyEntry = async (specialty, specialtyName) => {
    try {
      if (!specialty) {
        throw new Error('Missing specialty code')
      }

      let config = { specialties: [] }
      const hasConfig = await window.electronAPI.checkPath(DEFAULT_ROOT, 'user.config.json')
      if (hasConfig) {
        const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, 'user.config.json')
        config = typeof fileContents === 'string' ? JSON.parse(fileContents) : fileContents
      }

      if (!Array.isArray(config.specialties)) {
        config.specialties = []
      }

      const exists = config.specialties.some((entry) => entry.code === specialty)
      if (!exists) {
        config.specialties.push({
          code: specialty,
          name: specialtyName || specialty,
        })
        await window.electronAPI.saveFile(
          JSON.stringify(config, null, 2),
          DEFAULT_ROOT,
          'user.config.json'
        )
      }
    } catch (error) {
      throw new Error(`ensureSpecialtyEntry: could not update specialties: ${error.message}`)
    }
  }

  const saveChecklist = async (specialty, checklistObj) => {
    try {
      if (!specialty || !checklistObj) {
        throw new Error('Missing required parameters: specialty, checklistObj')
      }

      await window.electronAPI.createDir(DEFAULT_ROOT, specialty, 'Evidence')
      const payload = JSON.stringify(checklistObj, null, 2)
      await window.electronAPI.saveFile(payload, DEFAULT_ROOT, specialty, 'checklist.json')
    } catch (error) {
      throw new Error(`saveChecklist: could not save checklist: ${error.message}`)
    }
  }

  const loadSession = async (specialty) => {
    try {
      const found = await window.electronAPI.checkPath(DEFAULT_ROOT, specialty, 'session.json')
      if (found) {
        const fileContents = await window.electronAPI.readFile(
          DEFAULT_ROOT,
          specialty,
          'session.json'
        )
        return parseSession(fileContents)
      } else {
        return null
      }
    } catch (error) {
      throw new Error(`loadSession: could not load session for ${specialty} : ` + error.message)
    }
  }

  const readEvidence = async (specialty) => {
    try {
      const dirList = await window.electronAPI.listPath(DEFAULT_ROOT, specialty, 'Evidence')
      return dirList
    } catch (error) {
      throw new Error(`readEvidence: could not read evidence for ${specialty} : ` + error.message)
    }
  }

  const saveSession = (summary, responses, displayError) => {
    // make sure they are objects and not strings
    const newSummary = typeof summary == 'string' ? JSON.parse(summary) : summary
    const newResponses = typeof summary == 'string' ? JSON.parse(responses) : responses

    let sessionObj = { summary: newSummary, responses: newResponses }
    sessionObj.summary.lastUpdated = new Date().toISOString()

    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const sessionString = JSON.stringify(sessionObj, null, 2)
        window.electronAPI.saveFile(
          sessionString,
          DEFAULT_ROOT,
          newSummary.specialty,
          'session.json'
        )
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
    try {
      const fileContents = await window.electronAPI.readFile(DEFAULT_ROOT, 'user.config.json')
      const config = typeof fileContents === 'string' ? JSON.parse(fileContents) : fileContents
      return config.specialties
    } catch (error) {
      throw new Error(`loadSpecialties: could not load specialties : ` + error.message)
    }
  }

  const saveAudio = async (specialty, fileName, buffer) => {
    try {
      if (buffer === undefined) {
        throw new Error('Buffer is undefined')
      }
      const fileSize = buffer.byteLength
      if (fileSize == 0) {
        throw new Error('Audio file is empty')
      }

      const savedPath = await window.electronAPI.saveFile(
        buffer,
        DEFAULT_ROOT,
        specialty,
        'Audio',
        fileName
      )
      return savedPath
    } catch (error) {
      throw new Error(
        `saveAudio: could not save audio for ${specialty}/${fileName} : ` + error.message
      )
    }
  }

  const deleteAudio = async (specialty, fileName) => {
    try {
      const deleted = await window.electronAPI.deleteFile(
        DEFAULT_ROOT,
        specialty,
        'Audio',
        fileName
      )
      return deleted
    } catch (error) {
      throw new Error(
        `deleteAudio: could not delete audio ${specialty}/${fileName} : ` + error.message
      )
    }
  }

  const readAudio = async (specialty) => {
    try {
      const dirList = await window.electronAPI.listPath(DEFAULT_ROOT, specialty, 'Audio')
      return dirList
    } catch (error) {
      throw new Error(`readAudio: could not read audio for ${specialty} : ` + error.message)
    }
  }

  const saveFindingsReport = async (checklist, session, specialty) => {
    try {
      if (!checklist || !session || !specialty) {
        throw new Error('Missing required parameters: checklist, session, specialty')
      }
      const fileName = `reporte_hallazgos_${new Date().toISOString().split('T')[0]}.pdf`
      const filePath = await window.electronAPI.getFullPath(DEFAULT_ROOT, specialty, fileName)
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

  const createDefaultRoot = async () => {
    // Ensure the default root exists
    await window.electronAPI.createDir(DEFAULT_ROOT)
      
      // Create user.config.json with a dummy specialty
      const userConfig = {
        specialties: [
          { 
            code: 'DEMO', 
            name: 'Demo Specialty'
          }
        ]
      }
      await window.electronAPI.saveFile(JSON.stringify(userConfig, null, 2), 
                                        DEFAULT_ROOT, 
                                        'user.config.json'
                                      )
      
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
  
  return {
    defaultPathExists,
    setSavePath,
    createDefaultPath,
    saveEvidence,
    deleteEvidence,
    loadChecklist,
    getChecklistImportState,
    fetchChecklistFromApi,
    ensureSpecialtyEntry,
    saveChecklist,
    loadSession,
    readEvidence,
    saveExportFile,
    saveSession,
    loadSpecialties,
    saveAudio,
    deleteAudio,
    readAudio,
    saveFindingsReport,
    createDefaultRoot,
  }
}
