import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../src/fileServices.js'
import { useSessionStore } from '../src/stores/sessionStore.js'
import { useEvidenceStore } from '../src/stores/evidenceStore.js'

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ value: refValue })),
  reactive: vi.fn(),
}))
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../src/fileServices.js')
vi.mock('../src/stores/evidenceStore.js')

// timers
vi.useFakeTimers()

describe('Session Store', () => {
  let pinia
  let sessionStore
  let mockFs
  let mockToast
  let mockEvidence

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    vi.clearAllTimers()

    // Mock ref and reactive
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }))
    vi.mocked(reactive).mockImplementation((initialValue) => initialValue)

    // Mock useToast
    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    // Mock createFileService
    mockFs = {
      loadSession: vi.fn(),
      saveSession: vi.fn(),
    }
    vi.mocked(createFileService).mockReturnValue(mockFs)

    mockEvidence = {
      load: vi.fn(),
      reset: vi.fn(),
      updateCount: vi.fn(),
    }
    vi.mocked(useEvidenceStore).mockReturnValue(mockEvidence)

    // Initialize store
    sessionStore = useSessionStore()
  })

  it('initializes state correctly', () => {
    expect(sessionStore.responses).toEqual({})
    expect(sessionStore.summary).toEqual({ value: { location: '', finalized: true, generalComments: '' } })
  })

  describe('loadSession', () => {
    it('resets state and does nothing for specialty NONE', async () => {
      await sessionStore.loadSession('NONE')

      expect(sessionStore.summary.value.location).toBe('')
      expect(sessionStore.summary.value.finalized).toBe(true)
      expect(sessionStore.responses).toEqual({})

      expect(mockFs.loadSession).not.toHaveBeenCalled()
      expect(mockEvidence.reset).toHaveBeenCalled()
    })

    it('loads session and evidence for valid specialty', async () => {
      mockFs.loadSession.mockResolvedValue({
        summary: { location: '/path', generalComments: '' },
        responses: { 1: { id: '1' } },
      })
      mockEvidence.load.mockResolvedValue([{ name: 'file.txt', URL: '/path/file.txt', count: 1 }])

      await sessionStore.loadSession('VIG')

      expect(mockToast.success).toHaveBeenCalledWith('Session loaded')
      expect(sessionStore.summary.value).toEqual({
        location: '/path',
        finalized: false,
        specialty: 'VIG',
        generalComments: '',
      })
      expect(sessionStore.responses).toEqual({ 1: { id: '1' } })

      expect(mockFs.loadSession).toHaveBeenCalledWith('VIG')
      expect(mockEvidence.load).toHaveBeenCalledWith('VIG')
    })

    it('correctly creates session summary when file doesnt exist', async () => {
      mockFs.loadSession.mockResolvedValue(null)

      await expect(sessionStore.loadSession('VIG')).resolves.toBe(undefined)

      expect(mockToast.info).toHaveBeenCalledWith('New session created')
      expect(sessionStore.summary.value).toEqual({
        location: '',
        finalized: false,
        specialty: 'VIG',
        generalComments: '',
      })
      expect(sessionStore.responses).toEqual({})

      expect(mockFs.loadSession).toHaveBeenCalledWith('VIG')
      expect(mockEvidence.load).not.toHaveBeenCalledWith()
    })

    it('handles invalid specialty value errors with toast', async () => {
      await sessionStore.loadSession('')
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session:Invalid specialty value: '
      )

      await sessionStore.loadSession(null)
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session:Invalid specialty value: null'
      )

      await sessionStore.loadSession(undefined)
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session:Invalid specialty value: undefined'
      )

      await sessionStore.loadSession({})
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session:Invalid specialty value: [object Object]'
      )
    })

    it('handles load errors with toast', async () => {
      mockFs.loadSession.mockRejectedValue(new Error('Load failed'))

      await sessionStore.loadSession('VIG')
      expect(mockToast.error).toHaveBeenCalledWith('Could not create session:Load failed')
    })

    it('updates evidence counts after loading', async () => {
      mockFs.loadSession.mockResolvedValue({
        summary: { location: '/path' },
        responses: { 1: { evidence: ['file.txt'] } },
      })

      await sessionStore.loadSession('VIG')

      expect(mockEvidence.load).toHaveBeenCalledWith('VIG')
      expect(mockEvidence.updateCount).toHaveBeenCalledWith({ 1: { evidence: ['file.txt'] } })
    })

    it('removes dangling non-conformity entries', async () => {
      const loadedResponses = {
        1: {
          id: '1',
          compliance: 'Compliant',
          nonConformity: 'bla bla bla',
        },
        2: {
          id: '2',
          compliance: 'Non-compliant',
          nonConformity: 'bla bla bla',
        },
      }

      mockFs.loadSession.mockResolvedValue({
        summary: { location: '/path' },
        responses: loadedResponses,
      })
      mockEvidence.load.mockResolvedValue([{ name: 'file.txt', URL: '/path/file.txt', count: 1 }])

      await sessionStore.loadSession('VIG')

      expect(sessionStore.responses['2'].nonConformity).toBeDefined()
      expect(sessionStore.responses['1'].nonConformity).toBeUndefined()
    })
  })

  describe('updateSession', () => {
    it('updates session data and triggers saveSession', () => {
      sessionStore.updateSession('1', 'checklist-1', 'compliance', 'Compliant')
      expect(sessionStore.responses['1']).toEqual({ compliance: 'Compliant', id: 'checklist-1' })
      expect(mockFs.saveSession).toHaveBeenCalled()
    })
  })

  describe('calls to saveSession', () => {
    it('saves session after debounce', async () => {
      sessionStore.summary.value.lastUpdated = new Date().toISOString()

      sessionStore.updateSession('1', 'checklist-1', 'compliance', 'Compliant')
      await vi.waitFor(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(mockFs.saveSession).toHaveBeenCalled()
    })
  })

  describe('finalize', () => {
    it('sets finalized to true and triggers saveSession', () => {
      sessionStore.summary.value = {
        specialty: 'VIG',
        location: 'Location A',
        finalized: false,
        lastUpdated: new Date().toISOString(),
        generalComments: '',
      }
      sessionStore.responses['1'] = {
        id: '1',
        compliance: 'Compliant',
        comments: 'Test comments',
        nonConformity: 'bla bla bla',
        evidence: ['file1.txt'],
      }

      sessionStore.finalize()

      expect(sessionStore.summary.value.finalized).toBe(true)
      expect(mockFs.saveSession).toBeCalled()
    })

    it('removes dangling non-conformity entries', () => {
      sessionStore.summary.value = {
        specialty: 'VIG',
        location: 'Location A',
        finalized: false,
        lastUpdated: new Date().toISOString(),
        generalComments: '',
      }
      sessionStore.responses['1'] = {
        id: '1',
        compliance: 'Compliant',
        comments: 'Test comments',
        nonConformity: 'bla bla bla',
        evidence: ['file1.txt'],
      }
      sessionStore.responses['2'] = {
        id: '2',
        compliance: 'Non-compliant',
        nonConformity: 'bla bla bla',
        comments: 'Test comments',
        evidence: ['file2.txt'],
      }
      sessionStore.responses['3'] = {
        id: '2',
        comments: 'Test comments',
        nonConformity: 'bla bla bla',
        evidence: ['file2.txt'],
      }
      sessionStore.responses['4'] = {
        id: '2',
        compliance: 'Non-compliant',
        comments: 'Test comments',
        evidence: ['file2.txt'],
      }

      sessionStore.finalize()

      expect(sessionStore.responses['1'].nonConformity).toBeUndefined()
      expect(sessionStore.responses['2'].nonConformity).toBeDefined()
      expect(sessionStore.responses['3'].nonConformity).toBeUndefined()
    })
  })
})
