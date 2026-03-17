import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../App.vue'
import ChecklistTable from '../components/ChecklistTable.vue'
import ModalWindow from '../components/ModalWindow.vue'
import { useChecklistStore } from '../stores/checklistStore.js'
import { useSessionStore } from '../stores/sessionStore'
import { useToast } from 'vue-toastification'

// Mock dependencies
vi.mock('../components/ChecklistTable.vue')
vi.mock('../components/ModalWindow.vue')
vi.mock('../stores/checklistStore.js')
vi.mock('../stores/sessionStore.js')
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../assets/images/compliance-logo.png', () => ({ default: 'mock-logo-url' }))

describe('App.vue', () => {
  let wrapper
  let pinia
  let mockStore
  let mockSession
  let mockToast

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock store
    mockStore = {
      specialty: 'NONE',
      specialtyList: [
        { code: 'VIG', name: 'Vigilancia Radar' },
        { code: 'COM', name: 'Comunicaciones de Radio' },
      ],
      checklistLoaded: false,
      currentPath: '',
      showModal: false,
      tituloModal: '',
      explanationModal: '',
      accionModal: '',
      modalFinalizeTitle: 'Finalize Checklist',
      modalFinalizeExplanation:
        'Finalizing the checklist will prevent further changes, and cannot be undone',
      modalFinalizeAction: 'finalize the current checklist',
      loadChecklist: vi.fn(),
      loadSpecialties: vi.fn(),
      showFinalize: vi.fn(),
      confirmModal: vi.fn(),
      checkDefaultPath: vi.fn(),
      exportChecklist: vi.fn(),
      viewGeneratedReport: vi.fn(),
      importChecklist: vi.fn(),
      // default empty checklist object; tests will override when needed
      checklist: null,
    }
    vi.mocked(useChecklistStore).mockReturnValue(mockStore)

    // Mock sesison store
    mockSession = {
      summary: { finalized: false, generalComments: '' },
      loadSession: vi.fn(),
      updateGeneralComments: vi.fn(),
      finalize: vi.fn(),
    }
    vi.mocked(useSessionStore).mockReturnValue(mockSession)

    mockToast = { error: vi.fn(), success: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    // Mount component
    wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  it('renders correctly', () => {
    expect(wrapper.find('h2').text()).toBe('Operational Safety Compliance Checklist')
    expect(wrapper.find('img').attributes('src')).toBe('mock-logo-url')
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.findComponent(ModalWindow).exists()).toBe(true)
    expect(wrapper.findComponent(ChecklistTable).exists()).toBe(false) // Not loaded initially
  })

  it('displays session summary location', () => {
    // location now comes from checklist.json in the checklist store
    mockStore.checklist = { inspection: 'INS', startDate: '2025-09-01', location: '/mock/location' }
    wrapper = mount(App, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('Location: /mock/location')
  })

  it('displays providerName from checklist', () => {
    mockStore.checklist = {
      inspection: 'INS',
      startDate: '2025-09-01',
      location: '/mock/location',
      providerName: 'DTIC IDAC',
    }
    wrapper = mount(App, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('Provider: DTIC IDAC')
  })

  it('displays empty providerName when not set', () => {
    mockStore.checklist = { inspection: 'INS', startDate: '2025-09-01', location: '/loc' }
    wrapper = mount(App, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('Provider:')
  })

  it('renders specialty options from store', () => {
    const select = wrapper.find('select')
    const options = select.findAll('option')
    expect(options.length).toBe(mockStore.specialtyList.length + 1) // +1 for NONE
    expect(options[1].text()).toBe('Vigilancia Radar')
    expect(options[1].attributes('value')).toBe('VIG')
  })

  it('binds specialty to store and calls loadChecklist and loadSession on change', async () => {
    mockStore.loadChecklist.mockResolvedValue(true)
    const select = wrapper.find('select')
    await select.setValue('VIG')
    expect(mockStore.specialty).toBe('VIG')
    expect(mockStore.loadChecklist).toHaveBeenCalledTimes(1)
    expect(mockSession.loadSession).toHaveBeenCalledTimes(1)
  })

  it('handles checklist load errors correctly', async () => {
    mockStore.loadChecklist.mockResolvedValue(false)
    const select = wrapper.find('select')
    await select.setValue('VIG')
    expect(mockStore.specialty).toBe('VIG')
    expect(mockStore.loadChecklist).toHaveBeenCalledTimes(1)
    expect(mockSession.loadSession).not.toHaveBeenCalled()
  })

  it('renders finalize button disabled when finalized', async () => {
    mockSession.summary.finalized = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#finalizeBtn')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Finalize inspection')
  })

  it('renders finalize button enabled when not finalized', async () => {
    mockSession.summary.finalized = false
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#finalizeBtn')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('calls showFinalize on finalize button click', async () => {
    mockSession.summary.finalized = false
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#finalizeBtn')
    await button.trigger('click')
    expect(mockStore.showFinalize).toHaveBeenCalled()
  })

  it('renders export button enabled when finalized and checklist loaded', () => {
    mockSession.summary.finalized = true
    mockStore.checklistLoaded = true

    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#exportBtn')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.text()).toBe('Report Findings')
  })

  it('renders export button disabled when not finalized and checklist loaded', async () => {
    mockSession.summary.finalized = false
    mockStore.checklistLoaded = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#exportBtn')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('renders export button disabled when finalized and checklist not loaded', async () => {
    mockSession.summary.finalized = true
    mockStore.checklistLoaded = false
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#exportBtn')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('renders export button disabled when not finalized and checklist not loaded', async () => {
    mockSession.summary.finalized = false
    mockStore.checklistLoaded = false
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#exportBtn')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('calls exportChecklist on export button click', async () => {
    mockSession.summary.finalized = true
    mockStore.checklistLoaded = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#exportBtn')
    await button.trigger('click')
    expect(mockStore.exportChecklist).toHaveBeenCalled()
  })

  it('calls viewGeneratedReport on view report button click', async () => {
    mockStore.generatedReportPath = '/tmp/report.pdf'
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#viewReportBtn')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(mockStore.viewGeneratedReport).toHaveBeenCalledTimes(1)
  })

  it('renders general comments button enabled when checklist loaded', () => {
    mockStore.checklistLoaded = true
    mockStore.checklist = { inspection: 'INS', startDate: '2025-09-01', location: '/loc' }
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#genCommentsToggle')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.text()).toBe('Show General Comments')
  })

  it('renders general comments button disabled when checklist not loaded', async () => {
    mockStore.checklistLoaded = false
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const button = wrapper.find('#genCommentsToggle')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('shows and hides general comments on button click', async () => {
    mockStore.checklistLoaded = true
    mockStore.checklist = { inspection: 'INS', startDate: '2025-09-01', location: '/loc' }
    wrapper = mount(App, { global: { plugins: [pinia] } })
    expect(wrapper.find('div[class="general-comments"]').exists()).toBe(false)
    const button = wrapper.find('#genCommentsToggle')
    await button.trigger('click')
    expect(button.text()).toBe('Hide General Comments')
    expect(wrapper.find('div[class="general-comments"]').exists()).toBe(true)
  })

  it('updates general comments on input', async () => {
    mockStore.checklistLoaded = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    await wrapper.find('#genCommentsToggle').trigger('click')
    const textarea = wrapper.find('#generalComments')
    await textarea.setValue('New general note')
    expect(mockSession.updateGeneralComments).toHaveBeenCalledWith('New general note')
  })

  it('clears general comments on clear button click', async () => {
    mockStore.checklistLoaded = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    await wrapper.find('#genCommentsToggle').trigger('click')
    await wrapper.find('#clearGeneralComments').trigger('click')
    expect(mockSession.updateGeneralComments).toHaveBeenCalledWith('')
  })

  it('passes props to ModalWindow', () => {
    mockStore.showModal = true
    mockStore.tituloModal = 'Test Title'
    mockStore.explanationModal = 'Test Explanation'
    mockStore.accionModal = 'Test Action'
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const modal = wrapper.findComponent(ModalWindow)
    expect(modal.props('show')).toBe(true)
    expect(modal.props('titulo')).toBe('Test Title')
    expect(modal.props('explanation')).toBe('Test Explanation')
    expect(modal.props('accion')).toBe('Test Action')
  })

  it('handles modal cancel event', async () => {
    mockStore.showModal = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const modal = wrapper.findComponent(ModalWindow)
    await modal.vm.$emit('cancel')
    expect(mockStore.showModal).toBe(false)
  })

  it('handles modal confirm event', async () => {
    mockStore.showModal = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const modal = wrapper.findComponent(ModalWindow)
    await modal.vm.$emit('confirm')
    expect(mockStore.confirmModal).toHaveBeenCalled()
  })

  it('renders currentPath', () => {
    mockStore.currentPath = '/mock/current/path'
    wrapper = mount(App, { global: { plugins: [pinia] } })
    expect(wrapper.find('#currentPath').text()).toBe('/mock/current/path')
  })

  it('conditionally renders ChecklistTable when checklistLoaded', async () => {
    mockStore.checklistLoaded = false
    wrapper = mount(App, { global: { plugins: [pinia] } })
    expect(wrapper.findComponent(ChecklistTable).exists()).toBe(false)

    mockStore.checklistLoaded = true
    wrapper = mount(App, { global: { plugins: [pinia] } })
    const ctable = wrapper.findComponent(ChecklistTable)
    expect(ctable.exists()).toBe(true)
  })

  describe('onMounted', () => {
    it('calls checkDefaultPath and shows modal when path does not exist', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            ChecklistTable: true,
            ModalWindow: true,
          },
        },
      })

      // Simulate onMounted
      await wrapper.vm.$nextTick()

      expect(mockStore.checkDefaultPath).toHaveBeenCalled()
      expect(mockStore.loadSpecialties).toHaveBeenCalled()
    })
  })

  it('shows toast when loadChecklistAndSession catches an error', async () => {
    mockStore.loadChecklist.mockRejectedValue(new Error('load failed'))
    const select = wrapper.find('select')
    await select.setValue('VIG')
    expect(mockToast.error).toHaveBeenCalledWith('Could not load session: load failed')
  })

  describe('import checklist controls', () => {
    beforeEach(() => {
      mockStore.importChecklist = vi.fn()
      mockStore.isImporting = false

      // Remount with import functionality
      wrapper = mount(App, {
        global: {
          plugins: [pinia],
        },
      })
    })

    it('renders import controls', () => {
      const importControls = wrapper.find('.import-controls')
      expect(importControls.exists()).toBe(true)

      const inspectionInput = wrapper.find('#importInspection')
      expect(inspectionInput.exists()).toBe(true)
      expect(inspectionInput.attributes('placeholder')).toContain('Inspection code')

      const specialtyInput = wrapper.find('#importSpecialty')
      expect(specialtyInput.exists()).toBe(true)
      expect(specialtyInput.attributes('placeholder')).toContain('Specialty code')

      const importButton = wrapper.find('#importChecklistBtn')
      expect(importButton.exists()).toBe(true)
      expect(importButton.text()).toBe('Import Checklist')
    })

    it('calls importChecklist with correct parameters on button click', async () => {
      const inspectionInput = wrapper.find('#importInspection')
      const specialtyInput = wrapper.find('#importSpecialty')
      const importButton = wrapper.find('#importChecklistBtn')

      await inspectionInput.setValue('0224')
      await specialtyInput.setValue('VIG')
      await importButton.trigger('click')

      expect(mockStore.importChecklist).toHaveBeenCalledWith('0224', 'VIG')
    })

    it('shows importing state on button when isImporting is true', async () => {
      mockStore.isImporting = true
      wrapper = mount(App, { global: { plugins: [pinia] } })

      const importButton = wrapper.find('#importChecklistBtn')
      expect(importButton.text()).toBe('Importing...')
      expect(importButton.attributes('disabled')).toBeDefined()
    })

    it('trims whitespace from input values before calling importChecklist', async () => {
      const inspectionInput = wrapper.find('#importInspection')
      const specialtyInput = wrapper.find('#importSpecialty')
      const importButton = wrapper.find('#importChecklistBtn')

      await inspectionInput.setValue('  0224  ')
      await specialtyInput.setValue('  VIG  ')
      await importButton.trigger('click')

      expect(mockStore.importChecklist).toHaveBeenCalledWith('0224', 'VIG')
    })

    it('shows validation toast when import fields are empty', async () => {
      const importButton = wrapper.find('#importChecklistBtn')
      await importButton.trigger('click')
      expect(mockStore.importChecklist).not.toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalledWith('Inspection and specialty are required to import')
    })
  })
})
