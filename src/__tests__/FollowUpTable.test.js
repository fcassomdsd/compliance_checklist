import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FollowUpTable from '../components/FollowUpTable.vue'
import { useChecklistStore } from '../stores/checklistStore'
import { useFollowUpStore } from '../stores/followUpStore'

vi.mock('../stores/checklistStore')
vi.mock('../stores/followUpStore')

describe('FollowUpTable.vue', () => {
  let pinia
  let mockChecklistStore
  let mockFollowUpStore

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    mockChecklistStore = {
      findings: [
        {
          finding: {
            findingId: 'F-1',
            description: 'Sample finding',
          },
        },
      ],
    }
    vi.mocked(useChecklistStore).mockReturnValue(mockChecklistStore)

    mockFollowUpStore = {
      summary: { finalized: false },
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

  it('auto-closes finding when percent=100 and effectiveness=true', async () => {
    const wrapper = mount(FollowUpTable, {
      global: { plugins: [pinia] },
    })

    const numberInput = wrapper.find('input[type="number"]')
    await numberInput.setValue('100')

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0].setValue(true)

    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'percentComplete', 100)
    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'effectivenessConfirmed', true)
    expect(mockFollowUpStore.updateFollowUp).toHaveBeenCalledWith('F-1', 'findingClosed', true)
  })
})
