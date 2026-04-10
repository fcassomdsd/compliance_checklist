import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../utils/fileServices.js'
import { useFollowUpStore } from '../stores/followUpStore.js'
import { useEvidenceStore } from '../stores/evidenceStore.js'

vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ value: refValue })),
  reactive: vi.fn(),
}))
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../utils/fileServices.js')
vi.mock('../stores/evidenceStore.js')

describe('Follow Up Store', () => {
  let pinia
  let store
  let mockFs
  let mockToast
  let mockEvidenceStore

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()

    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }))
    vi.mocked(reactive).mockImplementation((initialValue) => initialValue)

    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    mockEvidenceStore = {
      reset: vi.fn(),
      load: vi.fn().mockResolvedValue(undefined),
      updateCount: vi.fn(),
    }
    vi.mocked(useEvidenceStore).mockReturnValue(mockEvidenceStore)

    mockFs = {
      loadFollowUpSession: vi.fn(),
      saveFollowUpSession: vi.fn(),
      markWorkspaceTouched: vi.fn().mockResolvedValue(undefined),
    }
    createFileService.mockReturnValue(mockFs)

    store = useFollowUpStore()
  })

  it('loads an existing follow-up session', async () => {
    mockFs.loadFollowUpSession.mockResolvedValue({
      summary: { finalized: false },
      responses: { F1: { findingId: 'F1', percentComplete: 60 } },
    })

    await store.loadFollowUpSession('VIG', 'loc-001')

    expect(store.summary.value.specialty).toBe('VIG')
    expect(store.responses.F1.percentComplete).toBe(60)
    expect(mockToast.success).toHaveBeenCalledWith('Follow-up session loaded')
  })

  it('creates a new follow-up session when one does not exist', async () => {
    mockFs.loadFollowUpSession.mockResolvedValue(null)

    await store.loadFollowUpSession('VIG', 'loc-001')

    expect(store.summary.value.finalized).toBe(false)
    expect(mockToast.info).toHaveBeenCalledWith('New follow-up session created')
  })

  it('updates follow-up responses and marks workspace touched', async () => {
    store.summary.value.specialty = 'VIG'
    store.context.value.locationId = 'loc-001'

    store.updateFollowUp('F1', 'percentComplete', 100)

    expect(store.responses.F1.percentComplete).toBe(100)
    expect(mockFs.saveFollowUpSession).toHaveBeenCalled()
    expect(mockFs.markWorkspaceTouched).toHaveBeenCalledWith('VIG', 'loc-001', 'followUpTouched')
  })

  it('normalizes malformed nested follow-up sessions', async () => {
    mockFs.loadFollowUpSession.mockResolvedValue({
      summary: { finalized: true },
      responses: {
        summary: { finalized: true },
        responses: {
          summary: { finalized: false },
          responses: {
            F1: {
              findingId: 'F1',
              percentComplete: 50,
              findingClosed: false,
              evidence: ['proof.jpg'],
            },
          },
        },
      },
    })

    await store.loadFollowUpSession('VIG', 'loc-001')

    expect(store.responses.summary).toBeUndefined()
    expect(store.responses.responses).toBeUndefined()
    expect(store.responses.F1).toEqual({
      findingId: 'F1',
      percentComplete: 50,
      effectivenessConfirmed: false,
      findingClosed: false,
      evidence: ['proof.jpg'],
    })
  })

  it('finalizes follow-up session and persists it', () => {
    store.summary.value.specialty = 'VIG'
    store.context.value.locationId = 'loc-001'

    store.finalize()

    expect(store.summary.value.finalized).toBe(true)
    expect(mockFs.saveFollowUpSession).toHaveBeenCalled()
  })

  it('handles invalid specialty input', async () => {
    await store.loadFollowUpSession('', 'loc-001')

    expect(store.summary.value.finalized).toBe(true)
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid specialty value'))
  })

  it('returns early for NONE specialty', async () => {
    await store.loadFollowUpSession('NONE', 'loc-001')

    expect(mockFs.loadFollowUpSession).not.toHaveBeenCalled()
  })

  it('normalizes optional fields and clamps percent complete', async () => {
    mockFs.loadFollowUpSession.mockResolvedValue({
      summary: { finalized: false, generalComments: 123 },
      responses: {
        F2: {
          percentComplete: 120,
          effectivenessConfirmed: true,
          findingClosed: true,
          comments: 'done',
          closureVerificationMethod: 'onsite',
          followUpDate: '2026-04-01',
          followUpClosureDate: '2026-04-05',
          evidence: ['a.jpg', 9],
        },
      },
    })

    await store.loadFollowUpSession('VIG', 'loc-001')

    expect(store.summary.value.generalComments).toBe('')
    expect(store.responses.F2).toEqual({
      findingId: 'F2',
      percentComplete: 100,
      effectivenessConfirmed: true,
      findingClosed: true,
      comments: 'done',
      closureVerificationMethod: 'onsite',
      followUpDate: '2026-04-01',
      followUpClosureDate: '2026-04-05',
      evidence: ['a.jpg'],
    })
  })

  it('shows toast when markWorkspaceTouched fails', async () => {
    mockFs.markWorkspaceTouched.mockRejectedValue(new Error('touch failed'))
    store.summary.value.specialty = 'VIG'
    store.context.value.locationId = 'loc-001'

    store.updateFollowUp('F1', 'percentComplete', 25)
    await Promise.resolve()

    expect(mockToast.error).toHaveBeenCalledWith(
      'Could not update workspace touched state: touch failed'
    )
  })
})
