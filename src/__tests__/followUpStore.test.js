import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../utils/fileServices.js'
import { useFollowUpStore } from '../stores/followUpStore.js'

vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ value: refValue })),
  reactive: vi.fn(),
}))
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../utils/fileServices.js')

describe('Follow Up Store', () => {
  let pinia
  let store
  let mockFs
  let mockToast

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()

    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }))
    vi.mocked(reactive).mockImplementation((initialValue) => initialValue)

    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

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
})
