import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FollowUpTable from '../components/FollowUpTable.vue'
import { useToast } from 'vue-toastification'
import { useChecklistStore } from '../stores/checklistStore'
import { useFollowUpStore } from '../stores/followUpStore'
import { useEvidenceStore } from '../stores/evidenceStore'

vi.mock('../stores/checklistStore')
vi.mock('../stores/followUpStore')
vi.mock('../stores/evidenceStore')
vi.mock('vue-toastification', () => ({ useToast: vi.fn() }))

describe('FollowUpTable.vue', () => {
  let pinia
  let mockChecklistStore
  let mockFollowUpStore
  let mockEvidenceStore
  let mockToast

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    mockChecklistStore = {
      findings: [
        {
          findingId: 'F-1',
          description: 'Sample finding',
        },
      ],
    }
    vi.mocked(useChecklistStore).mockReturnValue(mockChecklistStore)

    mockEvidenceStore = {
      files: {},
      add: vi.fn(),
      addCount: vi.fn(),
      subtract: vi.fn(),
    }
    vi.mocked(useEvidenceStore).mockReturnValue(mockEvidenceStore)
    mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    mockFollowUpStore = {
      summary: { finalized: false, specialty: 'VIG' },
      context: { locationId: 'loc-001' },
      responses: {},
      updateFollowUp: vi.fn((findingId, field, value) => {
        if (!mockFollowUpStore.responses[findingId]) {
          mockFollowUpStore.responses[findingId] = {}
        }
        mockFollowUpStore.responses[findingId][field] = value
      }),
    }
    vi.mocked(useFollowUpStore).mockReturnValue(mockFollowUpStore)
  })

  it('updates follow-up type and effectiveness for Closure Verification', async () => {
    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const selects = wrapper.findAll('select')
    // First select is followUpType
    await selects[0].setValue('Closure Verification')

    // Second select is effectiveness (only visible for Closure Verification)
    const effectivenessSelects = wrapper.findAll('select').filter(s => s.element.value !== 'Closure Verification')
    if (effectivenessSelects.length > 0) {
      await effectivenessSelects[0].setValue('true')
    }

    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'followUpType', 'Closure Verification')
  })

  it('uploads follow-up evidence and updates response list', async () => {
    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['proof'], 'proof.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })

    await fileInput.trigger('change')

    expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', file, 'loc-001', 'followUp')
    expect(mockEvidenceStore.addCount).toHaveBeenCalledWith('proof.jpg')
    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'evidence', [{ name: 'proof.jpg' }])
  })

  it('removes follow-up evidence with trash icon control', async () => {
    mockFollowUpStore.responses['F-1'] = {
      findingId: 'F-1',
      evidence: [{ name: 'proof.jpg' }],
    }
    mockEvidenceStore.files = {
      'proof.jpg': { URL: 'file:///tmp/proof.jpg', count: 1 },
    }

    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const removeButton = wrapper.find('input[type="image"]')
    await removeButton.trigger('click')

    expect(mockEvidenceStore.subtract).toHaveBeenCalledWith('VIG', 'proof.jpg', 'loc-001', 'followUp')
    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'evidence', [])
  })

  it('shows toast error when evidence add fails', async () => {
    mockEvidenceStore.add.mockRejectedValue(new Error('Upload failed'))

    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['proof'], 'proof.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })

    await fileInput.trigger('change')

    expect(mockToast.error).toHaveBeenCalledWith('Upload failed')
  })

  it('does nothing on evidence change when no files are selected', async () => {
    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [],
      configurable: true,
    })

    await fileInput.trigger('change')

    expect(mockEvidenceStore.add).not.toHaveBeenCalled()
  })

  it('increments count for duplicate evidence already linked to finding', async () => {
    mockFollowUpStore.responses['F-1'] = {
      findingId: 'F-1',
      evidence: ['proof.jpg'],
    }
    mockEvidenceStore.files = {
      'proof.jpg': { URL: 'file:///tmp/proof.jpg', count: 0 },
    }

    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['proof'], 'proof.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })

    await fileInput.trigger('change')

    expect(mockEvidenceStore.addCount).toHaveBeenCalledWith('proof.jpg')
    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'evidence', ['proof.jpg'])
  })

  it('shows toast error when evidence remove fails', async () => {
    mockFollowUpStore.responses['F-1'] = {
      findingId: 'F-1',
      evidence: ['proof.jpg'],
    }
    mockEvidenceStore.files = {
      'proof.jpg': { URL: 'file:///tmp/proof.jpg', count: 1 },
    }
    mockEvidenceStore.subtract.mockRejectedValue(new Error('Remove failed'))

    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    await wrapper.find('input[type="image"]').trigger('click')

    expect(mockToast.error).toHaveBeenCalledWith('Remove failed')
  })

  it('handles rows without finding id safely', async () => {
    mockChecklistStore.findings = [{ description: 'No id row' }]

    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const numberInput = wrapper.find('input[type="number"]')
    await numberInput.setValue('40')

    expect(mockFollowUpStore.updateFollowUp).not.toHaveBeenCalled()
  })
})
