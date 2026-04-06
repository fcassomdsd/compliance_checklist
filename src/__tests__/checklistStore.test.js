import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../utils/fileServices.js'
import { useChecklistStore } from '../stores/checklistStore.js'
import { useSessionStore } from '../stores/sessionStore.js'
import { useFollowUpStore } from '../stores/followUpStore.js'

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ value: refValue })),
  reactive: vi.fn(),
}))
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../utils/fileServices.js')
vi.mock('../stores/sessionStore.js')
vi.mock('../stores/followUpStore.js')

// timers
vi.useFakeTimers()

describe('Checklist Store', () => {
  let pinia
  let store
  let mockFs
  let mockToast
  let mockSession
  let mockFollowUp
  //const displayToast = (msg) => msg;

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    vi.clearAllTimers()

    // Mock ref and reactive
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }))
    vi.mocked(reactive).mockImplementation((initialValue) => initialValue)

    // Mock useToast
    mockToast = { success: vi.fn(), error: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    // Mock createFileService
    mockFs = {
      loadChecklist: vi.fn(),
      defaultPathExists: vi.fn(),
      createDefaultPath: vi.fn(),
      readEvidence: vi.fn(),
      setSavePath: vi.fn(),
      getChecklistImportState: vi.fn().mockResolvedValue({ hasChecklist: false }),
      saveExportFile: vi.fn(),
      saveFindingsReport: vi.fn().mockResolvedValue('report.pdf'),
      exportInspectionPayload: vi.fn().mockResolvedValue({ zipPath: 'payload.zip' }),
      exportFollowUpPayload: vi.fn().mockResolvedValue({ zipPath: 'followup.zip' }),
      notifyImportCanonical: vi.fn().mockResolvedValue(null),
      updateEvidenceCount: vi.fn(),
      loadSpecialties: vi.fn(),
      loadLocations: vi.fn(),
      checkServiceHealth: vi.fn().mockResolvedValue({ online: true }),
      createDefaultRoot: vi.fn(),
      loadWorkspaceRegistry: vi.fn().mockResolvedValue([]),
      saveWorkspaceRegistry: vi.fn(),
      upsertWorkspaceRegistryEntry: vi.fn().mockResolvedValue({
        workspaceKey: 'loc-001__VIG',
        specialtyCode: 'VIG',
        locationId: 'loc-001',
      }),
      loadFindings: vi.fn().mockResolvedValue([]),
      fetchFindingsFromApi: vi.fn(),
      saveFindings: vi.fn(),
      getWorkspaceTouchedState: vi.fn().mockResolvedValue({
        checklistTouched: false,
        followUpTouched: false,
      }),
      saveWorkspaceMetadata: vi.fn().mockResolvedValue(undefined),
    }
    createFileService.mockReturnValue(mockFs)

    mockSession = {
      summary: { value: {} },
      responses: {},
      loadSession: vi.fn(),
      updateSession: vi.fn(),
      finalize: vi.fn(),
    }
    vi.mocked(useSessionStore).mockReturnValue(mockSession)

    mockFollowUp = {
      summary: { finalized: true, specialty: 'VIG' },
      responses: {},
    }
    vi.mocked(useFollowUpStore).mockReturnValue(mockFollowUp)

    // Initialize store
    store = useChecklistStore()

    // Setup window.electronAPI mock
    window.electronAPI = {
      openFile: vi.fn(),
    }
  })

  it('initializes state correctly', () => {
    expect(store.specialty).toEqual({ value: 'NONE' })
    expect(store.checklist).toEqual({ value: null })
    expect(store.checklistLoaded).toEqual({ value: false })
    expect(store.currentPath).toEqual({ value: '' })
    expect(store.showModal).toEqual({ value: false })
    expect(store.tituloModal).toEqual({ value: '' })
    expect(store.explanationModal).toEqual({ value: '' })
    expect(store.accionModal).toEqual({ value: '' })

    // Verify specialtyList starts empty (will be loaded via loadSpecialties)
    expect(store.specialtyList).toEqual({ value: [] })
  })

  describe('loadSpecialties', () => {
    it('loads specialties from file service', async () => {
      const mockSpecialties = [
        { code: 'VIG', name: 'Vigilancia Radar' },
        { code: 'COM', name: 'Comunicaciones de Radio' },
        { code: 'RNA', name: 'Radioayudas' },
        { code: 'EEM', name: 'Energia y Equipos MET' },
        { code: 'FAU', name: 'Control de Fauna Silvestre' },
      ]
      mockFs.loadSpecialties.mockResolvedValue(mockSpecialties)

      await store.loadSpecialties()

      expect(mockFs.loadSpecialties).toHaveBeenCalled()
      expect(store.specialtyList.value).toEqual(mockSpecialties)
      expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('handles load errors gracefully', async () => {
      mockFs.loadSpecialties.mockRejectedValue(new Error('Load failed'))

      await store.loadSpecialties()

      expect(store.specialtyList.value).toEqual([])
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load specialties: Load failed')
    })
  })

  describe('loadChecklist', () => {
    it('resets state and does nothing for specialty NONE', async () => {
      store.specialty.value = 'NONE'
      await store.loadChecklist()

      expect(store.checklist.value).toBe(null)
      expect(store.checklistLoaded.value).toBe(false)

      expect(mockFs.loadChecklist).not.toHaveBeenCalled()
    })

    it('loads checklist, session, and evidence for valid specialty', async () => {
      store.specialty.value = 'VIG'
      let mockChecklist = {
        specialty: 'VIG',
        questions: [
          {
            id: '1',
            question: 'question 1',
            verification: 'verification 1',
            topic: 'topic 1',
            sequence: '0010',
            reference: 'reference 1',
          },
        ],
      }
      mockFs.loadChecklist.mockResolvedValue(mockChecklist)
      mockFs.setSavePath.mockResolvedValue('/path/VIG/Evidence')

      await store.loadChecklist()

      expect(mockToast.error).not.toHaveBeenCalled()
      expect(store.checklist.value).toEqual(mockChecklist)
      expect(store.checklistLoaded.value).toBe(true)
      expect(store.currentPath.value).toBe('/path/VIG/Evidence')

      expect(mockFs.loadChecklist).toHaveBeenCalledWith('VIG', null)
    })

    it('handles load errors with toast', async () => {
      store.specialty.value = 'VIG'
      mockFs.loadChecklist.mockRejectedValue(new Error('Load failed'))

      await store.loadChecklist()

      expect(store.checklistLoaded.value).toBe(false)
      expect(mockToast.error).toHaveBeenCalledWith('Load failed')
    })
  })

  describe('showFinalize', () => {
    it('sets modal state', () => {
      store.showFinalize()

      expect(store.tituloModal.value).toBe('Finalize Checklist')
      expect(store.explanationModal.value).toBe(
        'Finalizing the checklist will prevent further changes, and cannot be undone'
      )
      expect(store.accionModal.value).toBe('finalize the current checklist')
      expect(store.showModal.value).toBe(true)
    })
  })

  describe('confirmModal', () => {
    it('handles finalize modal', async () => {
      store.tituloModal.value = 'Finalize Checklist'
      store.confirmModal()
      await vi.waitFor(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(mockToast.success).toHaveBeenCalledWith('Checklist finalized successfully!')
      expect(mockSession.finalize).toHaveBeenCalled()
    })

    it('handles create default path modal', async () => {
      store.tituloModal.value = 'Create default path'
      store.specialtyList.value = [
        { code: 'VIG', name: 'Vigilancia Radar' },
        { code: 'COM', name: 'Comunicaciones de Radio' },
        { code: 'RNA', name: 'Radioayudas' },
        { code: 'EEM', name: 'Energia y Equipos MET' },
      ]
      mockFs.createDefaultRoot.mockResolvedValue({ success: true })
      mockFs.loadSpecialties.mockResolvedValue(store.specialtyList.value)

      await store.confirmModal()

      expect(mockFs.createDefaultRoot).toHaveBeenCalled()
      expect(mockFs.loadSpecialties).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Default path created successfully!')
    })

    it('handles unknown modal', () => {
      store.tituloModal.value = 'Unknown'
      store.confirmModal()

      expect(mockToast.success).not.toHaveBeenCalled()
    })
  })

  describe('checkDefaultPath', () => {
    it('shows create default path modal', async () => {
      await store.checkDefaultPath()

      expect(mockFs.defaultPathExists).toHaveBeenCalled()
      expect(store.tituloModal.value).toBe('Create default path')
      expect(store.explanationModal.value).toBe(
        'The default path for inspection data does not exist.  I can create it for you.'
      )
      expect(store.accionModal.value).toBe('create the default path')
      expect(store.showModal.value).toBe(true)
    })
  })

  describe('export', () => {
    beforeEach(() => {
      store.specialty.value = 'VIG'
      store.checklist.value = {
        specialtyName: 'Sistemas de Vigilancia',
        inspection: '0224',
        startDate: '2024-01-01',
        location: 'Location 1',
        questions: [
          {
            id: '1',
            question: 'question 1',
            verification: 'verification 1',
            topic: 'topic 1',
            sequence: '0010',
            reference: 'reference 1',
          },
          {
            id: '2',
            question: 'question 2',
            verification: 'verification 2',
            topic: 'topic 1',
            sequence: '0020',
            reference: 'reference 2',
          },
          {
            id: '3',
            question: 'question 3',
            verification: 'verification 3',
            topic: 'topic 2',
            sequence: '0010',
            reference: 'reference 3',
          },
          {
            id: '4',
            question: 'question 4',
            verification: 'verification 4',
            topic: 'topic 2',
            sequence: '0020',
            reference: 'reference 4',
          },
          {
            id: '5',
            question: 'question 5',
            verification: 'verification 5',
            topic: 'topic 3',
            sequence: '0010',
            reference: 'reference 5',
          },
          {
            id: '6',
            question: 'question 6',
            verification: 'verification 6',
            topic: 'topic 3',
            sequence: '0020',
            reference: 'reference 6',
          },
        ],
      }

      mockSession.summary.value = {
        specialty: 'VIG',
        finalized: true,
        lastUpdated: new Date().toISOString(),
        generalComments: '',
      }

      mockSession.responses['1'] = {
        id: '1',
        compliance: 'Compliant',
        comments: 'Test "comments"',
      }

      mockSession.responses['3'] = {
        id: '2',
        comments: 'Multiline\nTest comments',
      }

      mockSession.responses['4'] = {
        id: '3',
        compliance: 'Non-compliant',
        comments: 'Multiline\nTest comments',
        nonConformity: 'Non-conformity details 1',
      }

      mockSession.responses['5'] = {
        id: '4',
        compliance: 'Non-compliant',
        nonConformity: 'Non-conformity details 2',
      }

      mockSession.responses['6'] = {
        id: '5',
        compliance: 'Not applicable',
        comments: 'comments 6',
      }
    })

    it('creates export string correctly', async () => {
      mockFs.saveFindingsReport = vi.fn().mockResolvedValue('report.pdf')

      await store.exportChecklist()

      expect(mockToast.error).not.toHaveBeenCalled()

      // The store creates a sessionObj with summary and responses
      const expectedSessionObj = {
        summary: mockSession.summary,
        responses: mockSession.responses,
      }
      expect(mockFs.saveFindingsReport).toHaveBeenCalledWith(
        store.checklist.value,
        expectedSessionObj,
        'VIG'
      )
      expect(mockToast.success).toHaveBeenCalledWith('Report generated successfully')
      expect(store.generatedReportPath.value).toBe('report.pdf')
    })

    it('handles an emtpy checklist', async () => {
      store.checklist.value.questions = []

      store.exportChecklist()

      expect(mockToast.error).toHaveBeenCalledWith('Empty checklist not exported')
    })

    it('exports and uploads payload through separate action', async () => {
      mockFs.exportInspectionPayload = vi.fn().mockResolvedValue({ zipPath: 'payload.zip' })
      mockFs.notifyImportCanonical = vi.fn().mockResolvedValue(null)

      expect(store.isUploading.value).toBe(false)

      await store.exportUploadPayload()

      const expectedSessionObj = {
        summary: mockSession.summary,
        responses: mockSession.responses,
      }
      expect(mockFs.exportInspectionPayload).toHaveBeenCalledWith(
        store.checklist.value,
        expectedSessionObj,
        'VIG'
      )
      expect(mockToast.success).toHaveBeenCalledWith('Payload exported and uploaded successfully')
      expect(store.isUploading.value).toBe(false)
    })

    it('exports and uploads follow-up payload in follow-up mode', async () => {
      store.uiMode.value = 'followUp'
      store.findings.value = [{ finding: { findingId: 'F-1', locationId: 'loc-1' } }]
      store.findingsLoaded.value = true
      store.activeWorkspace.value = { locationId: 'loc-1' }
      mockFollowUp.summary = { finalized: true, specialty: 'VIG' }
      mockFollowUp.responses = { 'F-1': { findingId: 'F-1', percentComplete: 100 } }

      await store.exportUploadPayload()

      expect(mockFs.exportFollowUpPayload).toHaveBeenCalledWith(
        store.findings.value,
        {
          summary: mockFollowUp.summary,
          responses: mockFollowUp.responses,
        },
        'VIG',
        'loc-1'
      )
      expect(mockFs.notifyImportCanonical).not.toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Follow-up payload exported and uploaded successfully')
    })
  })

  describe('viewGeneratedReport', () => {
    it('opens the generated report file', async () => {
      // Setup: set a generated report path
      store.generatedReportPath.value = 'path/to/report.pdf'
      window.electronAPI.openFile = vi.fn().mockResolvedValue({ success: true })

      await store.viewGeneratedReport()

      expect(window.electronAPI.openFile).toHaveBeenCalledWith('path/to/report.pdf')
      expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('shows error when no report has been generated', async () => {
      store.generatedReportPath.value = ''
      window.electronAPI.openFile = vi.fn()

      await store.viewGeneratedReport()

      expect(window.electronAPI.openFile).not.toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('No report has been generated'))
    })

    it('handles errors when opening file fails', async () => {
      store.generatedReportPath.value = 'path/to/report.pdf'
      window.electronAPI.openFile = vi.fn().mockRejectedValue(new Error('File not found'))

      await store.viewGeneratedReport()

      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Could not open report'))
    })
  })

  describe('importChecklist', () => {
    beforeEach(() => {
      mockFs.getChecklistImportState = vi.fn()
      mockFs.fetchChecklistFromApi = vi.fn()
      mockFs.ensureSpecialtyEntry = vi.fn()
      mockFs.saveChecklist = vi.fn()
      mockFs.loadSpecialties = vi.fn()
    })

    it('imports checklist successfully when no session exists', async () => {
      const mockImportedChecklist = {
        specialtyName: 'Imported Specialty',
        inspection: '0224',
        location: 'Test Location',
        startDate: '2024-01-01',
        questions: [{ id: 'q1', topic: 'T1', reference: 'R1', question: 'Q1?', verification: 'V1' }]
      }

      mockFs.getChecklistImportState.mockResolvedValue({
        hasChecklist: false,
        hasSession: false,
        sessionFinalized: null
      })
      mockFs.fetchChecklistFromApi.mockResolvedValue(mockImportedChecklist)
      mockFs.ensureSpecialtyEntry.mockResolvedValue(undefined)
      mockFs.saveChecklist.mockResolvedValue(undefined)
      mockFs.loadSpecialties.mockResolvedValue([{ code: 'VIG', name: 'Imported Specialty' }])
      mockFs.loadChecklist.mockResolvedValue(mockImportedChecklist)
      mockFs.setSavePath.mockResolvedValue('/path/VIG/Evidence')

      await store.importChecklist('0224', 'VIG')

      expect(mockFs.getChecklistImportState).toHaveBeenCalledWith('VIG', 'TEST LOCATION')
      expect(mockFs.fetchChecklistFromApi).toHaveBeenCalledWith('0224', 'VIG')
      expect(mockFs.saveWorkspaceMetadata).toHaveBeenCalled()
      expect(mockFs.ensureSpecialtyEntry).toHaveBeenCalledWith('VIG', 'Imported Specialty')
      expect(mockFs.saveChecklist).toHaveBeenCalledWith('VIG', mockImportedChecklist, 'TEST LOCATION')
      expect(mockFs.loadSpecialties).toHaveBeenCalled()
      expect(store.specialty.value).toBe('VIG')
      expect(mockSession.loadSession).toHaveBeenCalledWith('VIG', 'TEST LOCATION')
      expect(mockToast.success).toHaveBeenCalledWith('Checklist imported successfully')
      expect(store.isImporting.value).toBe(false)
    })

    it('imports checklist when session is finalized (re-import)', async () => {
      const mockImportedChecklist = {
        specialtyName: 'Re-imported Specialty',
        inspection: '0224',
        location: 'Test Location',
        startDate: '2024-01-01',
        questions: [{ id: 'q1', topic: 'T1', reference: 'R1', question: 'Q1?', verification: 'V1' }]
      }

      mockFs.getChecklistImportState.mockResolvedValue({
        hasChecklist: true,
        hasSession: true,
        sessionFinalized: true
      })
      mockFs.fetchChecklistFromApi.mockResolvedValue(mockImportedChecklist)
      mockFs.ensureSpecialtyEntry.mockResolvedValue(undefined)
      mockFs.saveChecklist.mockResolvedValue(undefined)
      mockFs.loadSpecialties.mockResolvedValue([{ code: 'VIG', name: 'Re-imported Specialty' }])
      mockFs.loadChecklist.mockResolvedValue(mockImportedChecklist)
      mockFs.setSavePath.mockResolvedValue('/path/VIG/Evidence')

      await store.importChecklist('0224', 'VIG')

      expect(mockFs.fetchChecklistFromApi).toHaveBeenCalledWith('0224', 'VIG')
      expect(mockToast.success).toHaveBeenCalledWith('Checklist imported successfully')
      expect(store.isImporting.value).toBe(false)
    })

    it('blocks import when active session exists', async () => {
      mockFs.fetchChecklistFromApi.mockResolvedValue({
        specialtyName: 'VIG',
        location: 'Test Location',
        questions: [],
      })
      mockFs.getChecklistImportState.mockResolvedValue({
        hasChecklist: true,
        hasSession: true,
        sessionFinalized: false
      })

      await store.importChecklist('0224', 'VIG')

      expect(mockFs.fetchChecklistFromApi).toHaveBeenCalledWith('0224', 'VIG')
      expect(mockToast.error).toHaveBeenCalledWith('Cannot import checklist while an active session is in progress')
      expect(store.isImporting.value).toBe(false)
    })

    it('handles missing inspection parameter', async () => {
      await store.importChecklist('', 'VIG')

      expect(mockFs.getChecklistImportState).not.toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalledWith('Inspection and specialty are required')
      expect(store.isImporting.value).toBe(false)
    })

    it('handles missing specialty parameter', async () => {
      await store.importChecklist('0224', '')

      expect(mockFs.getChecklistImportState).not.toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalledWith('Inspection and specialty are required')
      expect(store.isImporting.value).toBe(false)
    })

    it('handles API fetch errors', async () => {
      mockFs.getChecklistImportState.mockResolvedValue({
        hasChecklist: false,
        hasSession: false,
        sessionFinalized: null
      })
      mockFs.fetchChecklistFromApi.mockRejectedValue(new Error('API is down'))

      await store.importChecklist('0224', 'VIG')

      expect(mockToast.error).toHaveBeenCalledWith('API is down')
      expect(store.isImporting.value).toBe(false)
    })

    it('blocks checklist re-import when workspace is touched', async () => {
      mockFs.fetchChecklistFromApi.mockResolvedValue({
        specialtyName: 'Imported Specialty',
        location: 'Test Location',
        questions: [],
      })
      mockFs.getWorkspaceTouchedState.mockResolvedValue({
        checklistTouched: true,
        followUpTouched: false,
      })

      await store.importChecklist('0224', 'VIG')

      expect(mockFs.getChecklistImportState).not.toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalledWith(
        'Cannot import checklist because local checklist edits already exist'
      )
    })

    it('sets isImporting flag during import', async () => {
      const mockImportedChecklist = {
        specialtyName: 'Test',
        inspection: '0224',
        location: 'Test',
        startDate: '2024-01-01',
        questions: []
      }

      mockFs.getChecklistImportState.mockResolvedValue({
        hasChecklist: false,
        hasSession: false,
        sessionFinalized: null
      })
      mockFs.fetchChecklistFromApi.mockImplementation(async () => {
        expect(store.isImporting.value).toBe(true)
        return mockImportedChecklist
      })
      mockFs.ensureSpecialtyEntry.mockResolvedValue(undefined)
      mockFs.saveChecklist.mockResolvedValue(undefined)
      mockFs.loadSpecialties.mockResolvedValue([{ code: 'VIG', name: 'Test' }])
      mockFs.loadChecklist.mockResolvedValue(mockImportedChecklist)
      mockFs.setSavePath.mockResolvedValue('/path/VIG/Evidence')

      await store.importChecklist('0224', 'VIG')

      expect(store.isImporting.value).toBe(false)
    })
  })

  describe('selectWorkspace', () => {
    it('loads checklist from disk even when registry checklistPresent is false', async () => {
      store.workspaceList.value = [
        {
          workspaceKey: 'loc-001__VIG',
          specialtyCode: 'VIG',
          specialtyName: 'Vigilancia',
          locationId: 'loc-001',
          locationName: 'Location 1',
          checklistPresent: false,
          findingsPresent: false,
          checklistTouched: true,
          followUpTouched: false,
          draftStatus: 'draft',
        },
      ]
      mockFs.getChecklistImportState.mockResolvedValue({ hasChecklist: true })
      mockFs.loadChecklist.mockResolvedValue({ questions: [{ id: 'q1' }] })
      mockFs.setSavePath.mockResolvedValue('/path/LOC-001_VIG')

      await store.selectWorkspace('loc-001__VIG')

      expect(mockFs.getChecklistImportState).toHaveBeenCalledWith('VIG', 'loc-001')
      expect(mockFs.loadChecklist).toHaveBeenCalledWith('VIG', 'loc-001')
      expect(mockSession.loadSession).toHaveBeenCalledWith('VIG', 'loc-001')
      expect(store.currentPath.value).toBe('/path/LOC-001_VIG')
      expect(mockFs.upsertWorkspaceRegistryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          specialtyCode: 'VIG',
          locationId: 'loc-001',
          checklistPresent: true,
        })
      )
    })
  })
})

