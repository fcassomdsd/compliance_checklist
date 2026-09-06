import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../utils/fileServices.js'
import { useSessionStore } from '../stores/sessionStore.js'
import { useEvidenceStore } from '../stores/evidenceStore.js'
import { useAudioStore } from '../stores/audioStore.js'

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ value: refValue })),
  reactive: vi.fn(),
}))
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../utils/fileServices.js')
vi.mock('../stores/evidenceStore.js')
vi.mock('../stores/audioStore.js')

// timers
vi.useFakeTimers()

describe('Session Store', () => {
  let pinia
  let sessionStore
  let mockFs
  let mockToast
  let mockEvidence
  let mockAudio

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
      hashEvidence: vi.fn().mockImplementation(async (_ctx, evidence) => evidence),
      markWorkspaceTouched: vi.fn().mockResolvedValue(undefined),
    }
    createFileService.mockReturnValue(mockFs)

    mockEvidence = {
      load: vi.fn(),
      reset: vi.fn(),
      updateCount: vi.fn(),
    }
    vi.mocked(useEvidenceStore).mockReturnValue(mockEvidence)

    mockAudio = {
      load: vi.fn(),
      reset: vi.fn(),
      updateCount: vi.fn(),
    }
    vi.mocked(useAudioStore).mockReturnValue(mockAudio)

    // Initialize store
    sessionStore = useSessionStore()
  })

  it('initializes state correctly', () => {
    expect(sessionStore.responses).toEqual({})
    expect(sessionStore.summary).toEqual({ value: { finalized: true, generalComments: '', interviewee: '' } })
  })

  describe('loadSession', () => {
    it('resets state and does nothing for specialty NONE', async () => {
      await sessionStore.loadSession('NONE')

      expect(sessionStore.summary.value.finalized).toBe(true)
      expect(sessionStore.responses).toEqual({})

      expect(mockFs.loadSession).not.toHaveBeenCalled()
      expect(mockEvidence.reset).toHaveBeenCalled()
      expect(mockAudio.reset).toHaveBeenCalled()
    })

    it('loads session and evidence for valid specialty', async () => {
      mockFs.loadSession.mockResolvedValue({
        summary: {},
        responses: { 1: { id: '1' } },
      })
      mockEvidence.load.mockResolvedValue([{ name: 'file.txt', URL: '/path/file.txt', count: 1 }])
      mockAudio.load.mockResolvedValue([{ name: 'audio.webm', URL: 'blob:audio.webm', count: 1 }])

      await sessionStore.loadSession('SUR')

      expect(mockToast.success).toHaveBeenCalledWith('Session loaded')
      expect(sessionStore.summary.value).toEqual({
        finalized: false,
        generalComments: '',
        interviewee: '',
        specialty: 'SUR',
      })
      expect(sessionStore.responses).toEqual({ 1: { id: '1' } })

      expect(mockFs.loadSession).toHaveBeenCalledWith('SUR', null)
      expect(mockEvidence.load).toHaveBeenCalledWith('SUR', null, 'inspection')
      expect(mockAudio.load).toHaveBeenCalledWith('SUR', null)
    })

    it('correctly creates session summary when file doesnt exist', async () => {
      mockFs.loadSession.mockResolvedValue(null)

      await expect(sessionStore.loadSession('SUR')).resolves.toBe(undefined)

      expect(mockToast.info).toHaveBeenCalledWith('New session created')
      expect(sessionStore.summary.value).toEqual({
        finalized: false,
        specialty: 'SUR',
        generalComments: '',
        interviewee: '',
      })
      expect(sessionStore.responses).toEqual({})

      expect(mockFs.loadSession).toHaveBeenCalledWith('SUR', null)
      expect(mockEvidence.load).not.toHaveBeenCalledWith()
    })

    it('rebinds summary specialty/location when switching workspaces', async () => {
      mockFs.loadSession.mockResolvedValue(null)

      await sessionStore.loadSession('SUR', 'MDPP')
      expect(mockFs.saveSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ specialty: 'SUR', locationId: 'MDPP' }),
        expect.any(Object),
        expect.any(Function),
        'MDPP'
      )

      await sessionStore.loadSession('FAU', 'MDPP')
      expect(mockFs.saveSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ specialty: 'FAU', locationId: 'MDPP' }),
        expect.any(Object),
        expect.any(Function),
        'MDPP'
      )
    })

    it('handles invalid specialty value errors with toast', async () => {
      await sessionStore.loadSession('')
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session: Invalid specialty value: '
      )

      await sessionStore.loadSession(null)
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session: Invalid specialty value: null'
      )

      await sessionStore.loadSession(undefined)
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session: Invalid specialty value: undefined'
      )

      await sessionStore.loadSession({})
      expect(mockToast.error).toHaveBeenCalledWith(
        'Could not create session: Invalid specialty value: [object Object]'
      )
    })

    it('handles load errors with toast', async () => {
      mockFs.loadSession.mockRejectedValue(new Error('Load failed'))

      await sessionStore.loadSession('SUR')
      expect(mockToast.error).toHaveBeenCalledWith('Could not create session: Load failed')
    })

    it('updates evidence counts after loading', async () => {
      mockFs.loadSession.mockResolvedValue({
        summary: { location: '/path' },
        responses: { 1: { evidence: [{ name: 'file.txt' }] } },
      })

      await sessionStore.loadSession('SUR')

      expect(mockEvidence.load).toHaveBeenCalledWith('SUR', null, 'inspection')
      expect(mockEvidence.updateCount).toHaveBeenCalledWith({ 1: { evidence: [{ name: 'file.txt' }] } })
    })

    it('updates audio counts after loading', async () => {
      mockFs.loadSession.mockResolvedValue({
        summary: { location: '/path' },
        responses: { 1: { audioComments: ['audio.webm'] } },
      })

      await sessionStore.loadSession('SUR')

      expect(mockAudio.load).toHaveBeenCalledWith('SUR', null)
      expect(mockAudio.updateCount).toHaveBeenCalledWith({ 1: { audioComments: ['audio.webm'] } })
    })

    it('removes dangling non-conformity entries', async () => {
      const loadedResponses = {
        1: {
          id: '1',
          compliance: 'Compliant',
          nonConformityDetails: { description: 'bla bla bla' },
        },
        2: {
          id: '2',
          compliance: 'Non-Compliant',
          nonConformityDetails: { description: 'bla bla bla', riskLevel: 'High' },
        },
      }

      mockFs.loadSession.mockResolvedValue({
        summary: { location: '/path' },
        responses: loadedResponses,
      })
      mockEvidence.load.mockResolvedValue([{ name: 'file.txt', URL: '/path/file.txt', count: 1 }])

      await sessionStore.loadSession('SUR')

      expect(sessionStore.responses['2'].nonConformityDetails).toBeDefined()
      expect(sessionStore.responses['1'].nonConformityDetails).toBeUndefined()
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
    it('sets finalized to true, saves session, and hashes evidence', async () => {
      sessionStore.summary.value = {
        specialty: 'SUR',
        finalized: false,
        lastUpdated: new Date().toISOString(),
        generalComments: '',
      }
      sessionStore.responses['1'] = {
        id: '1',
        compliance: 'Compliant',
        comments: 'Test comments',
        nonConformityDetails: { description: 'bla bla bla' },
        evidence: [{ name: 'file1.txt' }],
      }

      await sessionStore.finalize()

      expect(sessionStore.summary.value.finalized).toBe(true)
      expect(mockFs.saveSession).toBeCalled()
      expect(mockFs.hashEvidence).toHaveBeenCalled()
    })

    it('removes dangling non-conformity entries', async () => {
      sessionStore.summary.value = {
        specialty: 'SUR',
        finalized: false,
        lastUpdated: new Date().toISOString(),
        generalComments: '',
      }
      sessionStore.responses['1'] = {
        id: '1',
        compliance: 'Compliant',
        comments: 'Test comments',
        nonConformityDetails: { description: 'bla bla bla' },
        evidence: [{ name: 'file1.txt' }],
      }
      sessionStore.responses['2'] = {
        id: '2',
        compliance: 'Non-Compliant',
        nonConformityDetails: { description: 'bla bla bla' },
        comments: 'Test comments',
        evidence: [{ name: 'file2.txt' }],
      }
      sessionStore.responses['3'] = {
        id: '2',
        comments: 'Test comments',
        nonConformityDetails: { description: 'bla bla bla' },
        evidence: [{ name: 'file2.txt' }],
      }
      sessionStore.responses['4'] = {
        id: '2',
        compliance: 'Non-Compliant',
        comments: 'Test comments',
        evidence: [{ name: 'file2.txt' }],
      }

      await sessionStore.finalize()

      expect(sessionStore.responses['1'].nonConformityDetails).toBeUndefined()
      expect(sessionStore.responses['2'].nonConformityDetails).toBeDefined()
      expect(sessionStore.responses['3'].nonConformityDetails).toBeUndefined()
    })
  })
})
