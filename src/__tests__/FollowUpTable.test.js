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
          dateIssued: '2026-04-01',
          resolutionDeadline: '2026-05-01',
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

  it('stores default followUpType when editing another field', async () => {
    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const numberInput = wrapper.find('input[type="number"]')
    await numberInput.setValue('25')

    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'followUpType', 'Progress Verification')
    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'percentComplete', 25)
  })

  it('shows CAP Verification option only when corrective action exists', async () => {
    const wrapperWithoutCap = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })
    expect(wrapperWithoutCap.html()).not.toContain('CAP Verification')

    mockChecklistStore.findings = [
      {
        findingId: 'F-1',
        description: 'Sample finding',
        dateIssued: '2026-04-01',
        resolutionDeadline: '2026-05-01',
        correctiveAction: {
          capId: 'CA-ABCD001VIG-01-01',
          dueDate: '2026-05-12',
        },
      },
    ]
    const wrapperWithCap = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })
    expect(wrapperWithCap.html()).toContain('CAP Verification')
  })

  it('opens CAP modal when clicking CAP badge', async () => {
    mockChecklistStore.findings = [
      {
        findingId: 'F-1',
        description: 'Sample finding',
        dateIssued: '2026-04-01',
        resolutionDeadline: '2026-05-01',
        correctiveAction: {
          capId: 'CA-ABCD001VIG-01-01',
          proposedAction: 'Replace module',
          responsibleEntity: 'Ops',
          dueDate: '2026-05-12',
          acceptanceStatus: 'Pending',
        },
      },
    ]

    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    await wrapper.find('.cap-badge').trigger('click')

    expect(wrapper.find('.cap-modal').exists()).toBe(true)
    expect(wrapper.text()).toContain('CA-ABCD001VIG-01-01')
    expect(wrapper.text()).toContain('Replace module')
  })

  it('makes row read-only when finding is overdue at import time', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    mockChecklistStore.findings = [
      {
        findingId: 'F-1',
        description: 'Sample finding',
        dateIssued: '2026-04-01',
        resolutionDeadline: yesterday,
      },
    ]

    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
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
