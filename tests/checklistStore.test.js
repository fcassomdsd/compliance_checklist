import { describe, it, test, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../src/fileServices.js'
import { useChecklistStore } from '../src/stores/checklistStore.js'
import { useSessionStore } from '../src/stores/sessionStore.js'

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ value: refValue })),
  reactive: vi.fn(),
}))
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../src/fileServices.js')
vi.mock('../src/stores/sessionStore.js')

// timers
vi.useFakeTimers()

describe('Checklist Store', () => {
  let pinia
  let store
  let mockFs
  let mockToast
  let mockSession
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
      saveExportFile: vi.fn(),
      updateEvidenceCount: vi.fn(),
      loadSpecialties: vi.fn(),
    }
    vi.mocked(createFileService).mockReturnValue(mockFs)

    mockSession = {
      summary: { value: {} },
      responses: {},
      loadSession: vi.fn(),
      updateSession: vi.fn(),
      finalize: vi.fn(),
    }
    vi.mocked(useSessionStore).mockReturnValue(mockSession)

    // Initialize store
    store = useChecklistStore()
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

      expect(mockFs.loadChecklist).toHaveBeenCalledWith('VIG')
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

    it('handles create default path modal', () => {
      store.tituloModal.value = 'Create default path'
      store.specialtyList.value = [
        { code: 'VIG', name: 'Vigilancia Radar' },
        { code: 'COM', name: 'Comunicaciones de Radio' },
        { code: 'RNA', name: 'Radioayudas' },
        { code: 'EEM', name: 'Energia y Equipos MET' },
      ]
      mockFs.createDefaultPath.mockImplementation((code) => true)

      store.confirmModal()

      expect(mockFs.createDefaultPath).toHaveBeenCalledTimes(4) // For each specialty
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
      const exportedString =
        '"property"|"Location"|"Location 1"\n' +
        '"property"|"Start Date"|"2024-01-01"\n' +
        '"property"|"Specialty"|"Sistemas de Vigilancia"\n' +
        '"property"|"Inspection"|"0224"\n' +
        '"property"|"Total Questions"|"6"\n' +
        'topic 2\n' +
        '4|"reference 4"|"question 4"|"Non-compliant"|"Non-conformity details 1"\n' +
        'topic 3\n' +
        '5|\"reference 5\"|\"question 5\"|\"Non-compliant\"|\"Non-conformity details 2\"'

      store.exportChecklist()

      expect(mockToast.error).not.toHaveBeenCalled()
      await expect(mockFs.saveExportFile).toHaveBeenCalledWith(exportedString, 'VIG')
      expect(mockToast.success).toHaveBeenCalledWith('Checklist exported')
    })

    it('handles an emtpy checklist', async () => {
      store.checklist.value.questions = []

      store.exportChecklist()

      await expect(mockFs.saveExportFile).not.toBeCalledWith('abc', 'VIG')
      expect(mockToast.error).toHaveBeenCalledWith('Empty checklist not exported')
    })
  })
})
