import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChecklistTable from '../components/ChecklistTable.vue'
import ChecklistRow from '../components/ChecklistRow.vue'
import { useChecklistStore } from '../stores/checklistStore'
import { useSessionStore } from '../stores/sessionStore'

// Mock ChecklistRow component
vi.mock('../components/ChecklistRow.vue')
vi.mock('../stores/checklistStore')
vi.mock('../stores/sessionStore')

describe('ChecklistTable.vue', () => {
  let wrapper
  let pinia
  let mockStore
  let mockSession

  beforeEach(() => {
    // Set up Pinia
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock store
    mockStore = {
      checklist: {
        questions: [
          {
            id: 'checklist-1',
            code: 'VIG-0001',
            topic: 'Topic 1',
            reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1' }, guidance: 'GM 1' },
            question: 'Question 1?',
            verification: 'Verify 1',
          },
          {
            id: 'checklist-2',
            code: 'VIG-0002',
            topic: 'Topic 1',
            reference: { normativa: {}, guidance: 'GM 2' },
            question: 'Question 2?',
            verification: 'Verify 2',
          },
          {
            id: 'checklist-3',
            code: 'VIG-0003',
            topic: 'Topic 2',
            reference: { normativa: { reglamento: 'RAD 20', articulo: '20.1' }, guidance: 'GM 3' },
            question: 'Question 3?',
            verification: 'Verify 3',
          },
        ],
      },
      goToFollowUpFinding: vi.fn(),
    }
    vi.mocked(useChecklistStore).mockReturnValue(mockStore)

    mockSession = {
      responses: {
        'VIG-0001': { compliance: 'Compliant', id: 'checklist-1', code: 'VIG-0001' },
        'VIG-0002': { compliance: 'Non-compliant', id: 'checklist-2', code: 'VIG-0002' },
        'VIG-0003': { compliance: 'Non-compliant', id: 'checklist-3', code: 'VIG-0003' },
      },
    }
    vi.mocked(useSessionStore).mockReturnValue(mockSession)

    // Mount component
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: {
          ChecklistRow: true,
        },
      },
    })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  it('renders table structure correctly', () => {
    expect(wrapper.find('table#cklTable').exists()).toBe(true)
    const headers = wrapper.findAll('thead tr th')
    expect(headers.length).toBe(7)
    expect(headers[0].text()).toBe('Code')
    expect(headers[1].text()).toBe('Reference')
    expect(headers[2].text()).toBe('Question')
    expect(headers[3].text()).toBe('Verification')
    expect(headers[4].text()).toBe('Compliance')
    expect(headers[5].text()).toBe('Comments')
    expect(headers[6].text()).toBe('Evidence')
  })

  it('applies correct CSS classes to headers', () => {
    expect(wrapper.find('th.question').exists()).toBe(true)
    expect(wrapper.find('th.verification').exists()).toBe(true)
    expect(wrapper.find('th.compliance').exists()).toBe(true)
    expect(wrapper.find('th.comments').exists()).toBe(true)
    expect(wrapper.find('th.evidence').exists()).toBe(true)
  })

  it('renders ChecklistRow components for each question', () => {
    const rows = wrapper.findAllComponents(ChecklistRow)
    expect(rows.length).toBe(3) // One for each question
  })

  it('passes correct props to ChecklistRow components', () => {
    const rows = wrapper.findAllComponents(ChecklistRow)
    expect(rows[0].props()).toEqual({
      newTopic: true,
      questionCode: 'VIG-0001',
      row: {
        id: 'checklist-1',
        code: 'VIG-0001',
        topic: 'Topic 1',
        reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1' }, guidance: 'GM 1' },
        question: 'Question 1?',
        verification: 'Verify 1',
      },
      session: { compliance: 'Compliant', id: 'checklist-1', code: 'VIG-0001' },
      readOnly: false,
      linkedFindingId: '',
    })
    expect(rows[1].props()).toEqual({
      newTopic: false,
      questionCode: 'VIG-0002',
      row: {
        id: 'checklist-2',
        code: 'VIG-0002',
        topic: 'Topic 1',
        reference: { normativa: {}, guidance: 'GM 2' },
        question: 'Question 2?',
        verification: 'Verify 2',
      },
      session: { compliance: 'Non-compliant', id: 'checklist-2', code: 'VIG-0002' },
      readOnly: false,
      linkedFindingId: '',
    })
    expect(rows[2].props()).toEqual({
      newTopic: true,
      questionCode: 'VIG-0003',
      row: {
        id: 'checklist-3',
        code: 'VIG-0003',
        topic: 'Topic 2',
        reference: { normativa: { reglamento: 'RAD 20', articulo: '20.1' }, guidance: 'GM 3' },
        question: 'Question 3?',
        verification: 'Verify 3',
      },
      session: { compliance: 'Non-compliant', id: 'checklist-3', code: 'VIG-0003' },
      readOnly: false,
      linkedFindingId: '',
    })
  })

  it('marks linked findings as read-only', () => {
    mockStore.checklist.questions[1].priorFindingId = 'F-100'
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: { ChecklistRow: true },
      },
    })

    const rows = wrapper.findAllComponents(ChecklistRow)
    expect(rows[1].props('readOnly')).toBe(true)
    expect(rows[1].props('linkedFindingId')).toBe('F-100')
  })

  it('calculates newTopic correctly with topicChange', () => {
    // Mount without stubbing to access topicChange
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
      },
    })
    const topicChange = wrapper.vm.topicChange
    expect(topicChange('Topic 1')).toBe(true) // First topic
    expect(topicChange('Topic 1')).toBe(false) // Same topic
    expect(topicChange('Topic 2')).toBe(true) // New topic
    expect(topicChange('')).toBe(true) // Empty topic
    expect(topicChange('Topic 2')).toBe(false) // Same topic again
  })

  it('handles empty questions array', () => {
    mockStore.checklist = { questions: [] }
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: { ChecklistRow: true },
      },
    })
    const rows = wrapper.findAllComponents(ChecklistRow)
    expect(rows.length).toBe(0)
    expect(wrapper.find('tbody').exists()).toBe(true)
  })

  it('handles missing session data for a row', () => {
    mockSession.responses = { 'VIG-0001': { compliance: 'Compliant' } } // Only session for first row
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: { ChecklistRow: true },
      },
    })
    const rows = wrapper.findAllComponents(ChecklistRow)
    expect(rows[1].props('session')).toEqual({}) // Empty object for missing session
    expect(rows[2].props('session')).toEqual({})
  })

  it('sets disabled attribute on table', () => {
    expect(wrapper.find('table#cklTable').attributes('disabled')).toBeDefined()
  })

  it('handles null checklist', () => {
    mockStore.checklist = null
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: { ChecklistRow: true },
      },
    })
    const rows = wrapper.findAllComponents(ChecklistRow)
    expect(rows.length).toBe(0)
    expect(wrapper.find('tbody').exists()).toBe(true)
  })
})
