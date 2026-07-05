import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../utils/fileServices.js'
import { useSessionStore } from './sessionStore.js'
import { useFollowUpStore } from './followUpStore.js'

export const useChecklistStore = defineStore('checklist', () => {
  const toast = useToast()
  const fs = createFileService()
  const sessionStore = useSessionStore()
  const followUpStore = useFollowUpStore()

  // State
  const specialty = ref('NONE')
  const checklist = ref(null)
  const checklistLoaded = ref(false)
  const currentPath = ref('')
  const showModal = ref(false)
  const tituloModal = ref('')
  const explanationModal = ref('')
  const accionModal = ref('')
  const generatedReportPath = ref('')
  const isImporting = ref(false)
  const isUploading = ref(false)
  const isImportingFindings = ref(false)
  const workspaceList = ref([])
  const activeWorkspaceKey = ref('')
  const activeWorkspace = ref(null)
  const findings = ref([])
  const findingsLoaded = ref(false)
  const uiMode = ref('inspection')
  const followUpFocusFindingId = ref('')
  const apiKeyPromptVisible = ref(false)
  const apiKeyInput = ref('')

  // modal window data
  const modalFinalizeTitle = 'Finalize Checklist'
  const modalFinalizeExplanation =
    'Finalizing the checklist will prevent further changes, and cannot be undone'
  const modalFinalizeAction = 'finalize the current checklist'
  const finalizeSuccess = 'Checklist finalized successfully!'

  const modalCreateDPTitle = 'Create default path'
  const modalCreateDPExplanation =
    'The default path for inspection data does not exist.  I can create it for you.'
  const modalCreateDPAction = 'create the default path'
  const createDPSuccess = 'Default path created successfully!'

  // specialty data - will be loaded from file
  const specialtyList = ref([])
  const locationList = ref([])
  const importServiceOnline = ref(true)
  const uploadServiceOnline = ref(true)

  const resolveLocationFromChecklist = (checklistObj) => {
    const checklistLocationId = checklistObj?.locationId
    const checklistLocationName = checklistObj?.locationName || checklistObj?.location
    const checklistLocationCode =
      checklistObj?.locationCode || checklistObj?.icaoCode || checklistObj?.locationIcao

    const resolved =
      locationList.value.find(
        (location) =>
          location.id == checklistLocationId ||
          location.icaoCode == checklistLocationId ||
          location.icaoCode == checklistLocationCode ||
          location.name == checklistLocationName
      ) || null

    if (resolved) {
      return {
        locationId: resolved.icaoCode,
        locationName: resolved.name,
      }
    }

    if (typeof checklistLocationCode == 'string' && checklistLocationCode.trim().length > 0) {
      return {
        locationId: checklistLocationCode.trim().toUpperCase(),
        locationName: checklistLocationName || checklistLocationCode.trim().toUpperCase(),
      }
    }

    if (typeof checklistLocationId == 'string' && checklistLocationId.trim().length > 0) {
      return {
        locationId: checklistLocationId.trim().toUpperCase(),
        locationName: checklistLocationName || checklistLocationId.trim().toUpperCase(),
      }
    }

    if (typeof checklistLocationName == 'string' && checklistLocationName.trim().length > 0) {
      return {
        locationId: checklistLocationName.trim().toUpperCase(),
        locationName: checklistLocationName.trim(),
      }
    }

    throw new Error('Imported inspection did not include a resolvable location identifier')
  }

  // Actions
  const loadSpecialties = async () => {
    try {
      specialtyList.value = await fs.loadSpecialties()
    } catch (error) {
      toast.error(`Failed to load specialties: ${error.message}`)
      // Provide empty array fallback
      specialtyList.value = []
    }
  }

  const loadLocations = async () => {
    try {
      locationList.value = await fs.loadLocations()
    } catch (error) {
      toast.error(`Failed to load locations: ${error.message}`)
      locationList.value = []
    }
  }

  const refreshServiceStatus = async () => {
    const [importStatus, uploadStatus] = await Promise.all([
      fs.checkServiceHealth('import'),
      fs.checkServiceHealth('upload'),
    ])

    importServiceOnline.value = Boolean(importStatus?.online)
    uploadServiceOnline.value = Boolean(uploadStatus?.online)

    return {
      import: importServiceOnline.value,
      upload: uploadServiceOnline.value,
    }
  }

  const getWorkspaceDisplayName = (workspace) => {
    const statusLabel = workspace?.draftStatus == 'finalized' ? 'Finalized' : 'Draft'
    return `${workspace?.locationId || workspace?.locationName || 'Unknown location'} - ${workspace?.specialtyCode || workspace?.specialtyName || 'Unknown specialty'} (${statusLabel})`
  }

  const loadWorkspaces = async () => {
    try {
      const workspaces = await fs.loadWorkspaceRegistry()
      workspaceList.value = workspaces.map((workspace) => ({
        ...workspace,
        displayName: getWorkspaceDisplayName(workspace),
      }))
      if (activeWorkspaceKey.value) {
        const refreshedActive = workspaceList.value.find(
          (workspace) => workspace.workspaceKey == activeWorkspaceKey.value
        )
        if (refreshedActive) {
          activeWorkspace.value = refreshedActive
        }
      }
    } catch (error) {
      workspaceList.value = []
      toast.error(`Failed to load workspaces: ${error.message}`)
    }
  }

  const loadChecklist = async () => {
    // initialize state
    checklist.value = null
    checklistLoaded.value = false

    try {
      if (specialty.value != 'NONE') {
        const locationId = activeWorkspace.value?.locationId || null
        // load checklist
        checklist.value = await fs.loadChecklist(specialty.value, locationId)
        checklistLoaded.value = true

        currentPath.value = await fs.setSavePath(specialty.value, locationId)
        toast.success('Checklist loaded')
      }
    } catch (error) {
      toast.error(error.message)
      checklistLoaded.value = false
    }
    return checklistLoaded.value
  }

  const loadFindings = async () => {
    findings.value = []
    findingsLoaded.value = false

    try {
      if (specialty.value != 'NONE') {
        const locationId = activeWorkspace.value?.locationId || null
        const loadedFindings = await fs.loadFindings(specialty.value, locationId)
        findings.value = loadedFindings || []
        findingsLoaded.value = Array.isArray(loadedFindings)
      }
    } catch (error) {
      toast.error(error.message)
      findingsLoaded.value = false
    }
    return findingsLoaded.value
  }

  const showFinalize = () => {
    tituloModal.value = modalFinalizeTitle
    explanationModal.value = modalFinalizeExplanation
    accionModal.value = modalFinalizeAction
    showModal.value = true
  }
  const confirmModal = async () => {
    try {
      showModal.value = false
      switch (tituloModal.value) {
        case modalFinalizeTitle: {
          await sessionStore.finalize(specialty.value, activeWorkspace.value?.locationId)
          toast.success(finalizeSuccess)
          break
        }
        case modalCreateDPTitle: {
          // Call the IPC handler to create the default root with user.config.json
          await fs.createDefaultRoot()
          // Reload specialties after creating the default root
          await loadSpecialties()
          toast.success(createDPSuccess)
          break
        }
        default: {
          break
        }
      }
    } catch (error) {
      console.log(error)
      toast.error(`Error in ${tituloModal.value} : ${error.message}`)
    }
  }
  const checkDefaultPath = async () => {
    try {
      if (!(await fs.defaultPathExists())) {
        tituloModal.value = modalCreateDPTitle
        explanationModal.value = modalCreateDPExplanation
        accionModal.value = modalCreateDPAction
        showModal.value = true
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const exportChecklist = async () => {
    try {
      if (checklist.value.questions.length == 0) {
        throw new Error('Empty checklist not exported')
      }

      // Generate PDF report of findings
      const sessionObj = { summary: sessionStore.summary, responses: sessionStore.responses }
      const locationId = activeWorkspace.value?.locationId || null
      const reportPath = await fs.saveFindingsReport(checklist.value, sessionObj, specialty.value, locationId)
      generatedReportPath.value = reportPath
      toast.success('Report generated successfully')
    } catch (error) {
      generatedReportPath.value = ''
      toast.error(error.message)
    }
  }

  const ensureApiKey = async () => {
    let key = await window.electronAPI.readApiKey()
    if (key) return key

    apiKeyInput.value = ''
    apiKeyPromptVisible.value = true

    return new Promise((resolve) => {
      const resolver = (savedKey) => {
        apiKeyPromptVisible.value = false
        resolve(savedKey || null)
      }
      _apiKeyResolver = resolver
    })
  }

  const submitApiKey = async () => {
    const key = apiKeyInput.value.trim()
    if (key) {
      await window.electronAPI.saveApiKey(key)
    }
    if (_apiKeyResolver) {
      _apiKeyResolver(key || null)
      _apiKeyResolver = null
    }
  }

  const cancelApiKeyPrompt = () => {
    if (_apiKeyResolver) {
      _apiKeyResolver(null)
      _apiKeyResolver = null
    }
    apiKeyPromptVisible.value = false
  }

  let _apiKeyResolver = null

  const exportUploadPayload = async () => {
    try {
      if (!uploadServiceOnline.value) {
        throw new Error('Upload service offline (localhost:8000)')
      }

      const apiKey = await ensureApiKey()
      if (!apiKey) {
        return
      }

      isUploading.value = true

      if (uiMode.value == 'followUp') {
        if (!Array.isArray(findings.value) || findings.value.length == 0) {
          throw new Error('Empty follow-up not exported')
        }

        const followUpSessionObj = {
          summary: followUpStore.summary,
          responses: followUpStore.responses,
        }
        await fs.exportFollowUpPayload(
          findings.value,
          followUpSessionObj,
          specialty.value,
          activeWorkspace.value?.locationId || null
        )
        await loadWorkspaces()
        toast.success('Follow-up payload exported and uploaded successfully')
      } else {
        if (checklist.value.questions.length == 0) {
          throw new Error('Empty checklist not exported')
        }

        const sessionObj = { summary: sessionStore.summary, responses: sessionStore.responses }
        await fs.exportInspectionPayload(
          checklist.value,
          sessionObj,
          specialty.value,
          activeWorkspace.value?.locationId || null
        )
        await fs.notifyImportCanonical(checklist.value.inspection, checklist.value.specialtyName)
        await loadWorkspaces()
        toast.success('Payload exported and uploaded successfully')
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      isUploading.value = false
    }
  }

  const importChecklist = async (inspection, specialtyCode) => {
    try {
      if (!inspection || !specialtyCode) {
        throw new Error('Inspection and specialty are required')
      }

      if (!importServiceOnline.value) {
        throw new Error('Import service offline (localhost:1880)')
      }

      isImporting.value = true

      const importedChecklist = await fs.fetchChecklistFromApi(inspection, specialtyCode)
      const specialtyName =
        importedChecklist.specialtyName ||
        specialtyList.value.find((item) => item.code == specialtyCode)?.name ||
        specialtyCode
      const { locationId, locationName } = resolveLocationFromChecklist(importedChecklist)

      const touchedState = await fs.getWorkspaceTouchedState(specialtyCode, locationId)
      if (touchedState.checklistTouched) {
        throw new Error('Cannot import checklist because local checklist edits already exist')
      }

      const importState = await fs.getChecklistImportState(specialtyCode, locationId)
      if (importState.hasChecklist && importState.hasSession && importState.sessionFinalized === false) {
        throw new Error('Cannot import checklist while an active session is in progress')
      }
      await fs.ensureSpecialtyEntry(specialtyCode, specialtyName)
      await fs.saveChecklist(specialtyCode, importedChecklist, locationId)
      await fs.saveWorkspaceMetadata(specialtyCode, locationId, {
        specialtyCode,
        specialtyName,
        locationId,
        locationName,
        draftStatus: 'draft',
        checklistTouched: false,
        followUpTouched: false,
        checklistUploaded: false,
        followUpUploaded: false,
        checklistPresent: true,
        findingsPresent: false,
        updatedAt: new Date().toISOString(),
      })
      const workspaceEntry = await fs.upsertWorkspaceRegistryEntry({
        specialtyCode,
        specialtyName,
        locationId,
        locationName,
        draftStatus: 'draft',
        checklistTouched: false,
        followUpTouched: false,
        checklistUploaded: false,
        followUpUploaded: false,
        checklistPresent: true,
        findingsPresent: false,
      })

      await loadSpecialties()
      await loadWorkspaces()
      specialty.value = specialtyCode
      activeWorkspaceKey.value = workspaceEntry.workspaceKey
      activeWorkspace.value = workspaceEntry
      generatedReportPath.value = ''

      if (await loadChecklist()) {
        await sessionStore.loadSession(specialtyCode, locationId)
      }
      await loadFindings()

      toast.success('Checklist imported successfully')
    } catch (error) {
      toast.error(error.message)
    } finally {
      isImporting.value = false
    }
  }

  const selectWorkspace = async (workspaceKey) => {
    try {
      const targetWorkspace = workspaceList.value.find((workspace) => workspace.workspaceKey == workspaceKey)
      if (!targetWorkspace) {
        throw new Error('Workspace not found')
      }

      activeWorkspaceKey.value = workspaceKey
      activeWorkspace.value = targetWorkspace
      specialty.value = targetWorkspace.specialtyCode
      currentPath.value = (await fs.setSavePath(specialty.value, targetWorkspace.locationId)) || ''
      generatedReportPath.value = ''

      let hasChecklist = targetWorkspace.checklistPresent !== false
      if (!hasChecklist) {
        const importState = await fs.getChecklistImportState(specialty.value, targetWorkspace.locationId)
        if (importState?.hasChecklist) {
          hasChecklist = true
          await fs.saveWorkspaceMetadata(specialty.value, targetWorkspace.locationId, {
            specialtyCode: targetWorkspace.specialtyCode,
            specialtyName: targetWorkspace.specialtyName || targetWorkspace.specialtyCode,
            locationId: targetWorkspace.locationId,
            locationName: targetWorkspace.locationName || targetWorkspace.locationId,
            draftStatus: targetWorkspace.draftStatus || 'draft',
            checklistTouched: Boolean(targetWorkspace.checklistTouched),
            followUpTouched: Boolean(targetWorkspace.followUpTouched),
            checklistUploaded: Boolean(targetWorkspace.checklistUploaded),
            followUpUploaded: Boolean(targetWorkspace.followUpUploaded),
            checklistPresent: true,
            findingsPresent: Boolean(targetWorkspace.findingsPresent),
            updatedAt: new Date().toISOString(),
          })
          await fs.upsertWorkspaceRegistryEntry({
            specialtyCode: targetWorkspace.specialtyCode,
            specialtyName: targetWorkspace.specialtyName || targetWorkspace.specialtyCode,
            locationId: targetWorkspace.locationId,
            locationName: targetWorkspace.locationName || targetWorkspace.locationId,
            draftStatus: targetWorkspace.draftStatus || 'draft',
            checklistTouched: Boolean(targetWorkspace.checklistTouched),
            followUpTouched: Boolean(targetWorkspace.followUpTouched),
            checklistUploaded: Boolean(targetWorkspace.checklistUploaded),
            followUpUploaded: Boolean(targetWorkspace.followUpUploaded),
            checklistPresent: true,
            findingsPresent: Boolean(targetWorkspace.findingsPresent),
          })
          await loadWorkspaces()
        }
      }

      if (hasChecklist) {
        const loaded = await loadChecklist()
        if (loaded) {
          await sessionStore.loadSession(specialty.value, targetWorkspace.locationId)
        }
      } else {
        checklist.value = null
        checklistLoaded.value = false
      }
      await loadFindings()
    } catch (error) {
      toast.error(`Could not switch workspace: ${error.message}`)
    }
  }

  const importFindings = async (specialtyCode, locationId, inspection = null) => {
    try {
      if (!locationId || !specialtyCode) {
        throw new Error('Location and specialty are required')
      }

      if (!importServiceOnline.value) {
        throw new Error('Import service offline (localhost:1880)')
      }

      isImportingFindings.value = true

      const importedFindings = await fs.fetchFindingsFromApi(specialtyCode, locationId, inspection)
      if (!Array.isArray(importedFindings) || importedFindings.length == 0) {
        throw new Error('No findings were returned for this location and specialty')
      }

      const locationName =
        locationList.value.find((location) => location.icaoCode == locationId)?.name ||
        importedFindings[0]?.locationName ||
        locationId
      const specialtyName =
        specialtyList.value.find((item) => item.code == specialtyCode)?.name || specialtyCode

      const touchedState = await fs.getWorkspaceTouchedState(specialtyCode, locationId)
      if (touchedState.followUpTouched) {
        throw new Error('Cannot import findings because local follow-up edits already exist')
      }

      await fs.saveFindings(specialtyCode, importedFindings, locationId)
      await fs.saveWorkspaceMetadata(specialtyCode, locationId, {
        specialtyCode,
        specialtyName,
        locationId,
        locationName,
        draftStatus: 'draft',
        checklistTouched: touchedState.checklistTouched,
        followUpTouched: false,
        checklistUploaded: false,
        followUpUploaded: false,
        checklistPresent: false,
        findingsPresent: true,
        updatedAt: new Date().toISOString(),
      })

      const workspaceEntry = await fs.upsertWorkspaceRegistryEntry({
        specialtyCode,
        specialtyName,
        locationId,
        locationName,
        draftStatus: 'draft',
        checklistTouched: touchedState.checklistTouched,
        followUpTouched: false,
        checklistUploaded: false,
        followUpUploaded: false,
        checklistPresent: false,
        findingsPresent: true,
      })

      await loadWorkspaces()
      specialty.value = specialtyCode
      activeWorkspaceKey.value = workspaceEntry.workspaceKey
      activeWorkspace.value = workspaceEntry
      generatedReportPath.value = ''
      await loadFindings()
      uiMode.value = 'followUp'

      toast.success('Findings imported successfully')
    } catch (error) {
      toast.error(error.message)
    } finally {
      isImportingFindings.value = false
    }
  }

  const goToFollowUpFinding = (findingId = '') => {
    uiMode.value = 'followUp'
    followUpFocusFindingId.value = findingId || ''
  }

  const viewGeneratedReport = async () => {
    try {
      if (!generatedReportPath.value) {
        throw new Error('No report has been generated yet')
      }
      await window.electronAPI.openFile(generatedReportPath.value)
    } catch (error) {
      toast.error('Could not open report: ' + error.message)
    }
  }

  const removeInspectionSession = async () => {
    try {
      if (!activeWorkspace.value?.locationId || !specialty.value || specialty.value == 'NONE') {
        throw new Error('No active workspace selected')
      }

      const result = await fs.removeInspectionSession(specialty.value, activeWorkspace.value.locationId)
      await loadWorkspaces()

      if (result.workspaceDeleted) {
        activeWorkspaceKey.value = ''
        activeWorkspace.value = null
        checklist.value = null
        checklistLoaded.value = false
        findings.value = []
        findingsLoaded.value = false
        specialty.value = 'NONE'
        currentPath.value = ''
        toast.success('Inspection session removed and workspace deleted')
        return result
      }

      sessionStore.reset(false)
      toast.success('Inspection session removed')
      return result
    } catch (error) {
      toast.error(error.message)
      throw error
    }
  }

  const removeFollowUpSession = async () => {
    try {
      if (!activeWorkspace.value?.locationId || !specialty.value || specialty.value == 'NONE') {
        throw new Error('No active workspace selected')
      }

      const result = await fs.removeFollowUpSession(specialty.value, activeWorkspace.value.locationId)
      await loadWorkspaces()

      if (result.workspaceDeleted) {
        activeWorkspaceKey.value = ''
        activeWorkspace.value = null
        checklist.value = null
        checklistLoaded.value = false
        findings.value = []
        findingsLoaded.value = false
        specialty.value = 'NONE'
        currentPath.value = ''
        toast.success('Follow-up session removed and workspace deleted')
        return result
      }

      followUpStore.reset(false)
      toast.success('Follow-up session removed')
      return result
    } catch (error) {
      toast.error(error.message)
      throw error
    }
  }

  return {
    specialty,
    specialtyList,
    locationList,
    checklist,
    checklistLoaded,
    currentPath,
    showModal,
    tituloModal,
    explanationModal,
    accionModal,
    generatedReportPath,
    isImporting,
    isImportingFindings,
    isUploading,
    workspaceList,
    activeWorkspaceKey,
    activeWorkspace,
    findings,
    findingsLoaded,
    uiMode,
    importServiceOnline,
    uploadServiceOnline,
    followUpFocusFindingId,
    apiKeyPromptVisible,
    apiKeyInput,
    loadChecklist,
    loadFindings,
    loadSpecialties,
    loadLocations,
    loadWorkspaces,
    refreshServiceStatus,
    showFinalize,
    checkDefaultPath,
    confirmModal,
    exportChecklist,
    exportUploadPayload,
    removeInspectionSession,
    removeFollowUpSession,
    viewGeneratedReport,
    importChecklist,
    importFindings,
    selectWorkspace,
    goToFollowUpFinding,
    ensureApiKey,
    submitApiKey,
    cancelApiKeyPrompt,
  }
})
