import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../App.vue'
import { useChecklistStore } from '../stores/checklistStore.js'
import { useSessionStore } from '../stores/sessionStore.js'
import { useFollowUpStore } from '../stores/followUpStore.js'
import { useToast } from 'vue-toastification'

vi.mock('../components/ChecklistTable.vue', () => ({
  default: { template: '<div id="checklist-table-stub" />' },
}))
vi.mock('../components/FollowUpTable.vue', () => ({
  default: { template: '<div id="followup-table-stub" />' },
}))
vi.mock('../components/ModalWindow.vue', () => ({
  default: { template: '<div id="modal-stub" />' },
}))
vi.mock('../stores/checklistStore.js')
vi.mock('../stores/sessionStore.js')
vi.mock('../stores/followUpStore.js')
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../assets/images/compliance-logo.png', () => ({ default: 'mock-logo-url' }))

describe('App.vue', () => {
  let wrapper
  let pinia
  let mockStore
  let mockSession
  let mockFollowUp
  let mockToast

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    mockStore = {
      specialty: 'NONE',
      specialtyList: [
        { code: 'VIG', name: 'Sistemas de Vigilancia' },
        { code: 'COM', name: 'Comunicaciones' },
      ],
      locationList: [{ id: 'loc-1', icaoCode: 'MDSD', name: 'Las Americas' }],
      workspaceList: [{ workspaceKey: 'MDSD__VIG', displayName: 'MDSD - VIG (Draft)' }],
      activeWorkspaceKey: '',
      activeWorkspace: null,
      uiMode: 'inspection',
      importServiceOnline: true,
      uploadServiceOnline: true,
      checklistLoaded: false,
      findingsLoaded: false,
      checklist: null,
      generatedReportPath: '',
      showModal: false,
      tituloModal: '',
      explanationModal: '',
      accionModal: '',
      isImporting: false,
      isImportingFindings: false,
      isUploading: false,
      loadSpecialties: vi.fn(),
      loadLocations: vi.fn(),
      loadWorkspaces: vi.fn(),
      refreshServiceStatus: vi.fn(),
      selectWorkspace: vi.fn(),
      importChecklist: vi.fn(),
      importFindings: vi.fn(),
      showFinalize: vi.fn(),
      exportChecklist: vi.fn(),
      exportUploadPayload: vi.fn(),
      viewGeneratedReport: vi.fn(),
      checkDefaultPath: vi.fn(),
      confirmModal: vi.fn(),
    }
    vi.mocked(useChecklistStore).mockReturnValue(mockStore)

    mockSession = {
      summary: { finalized: false, generalComments: '' },
      updateGeneralComments: vi.fn(),
      loadSession: vi.fn(),
    }
    vi.mocked(useSessionStore).mockReturnValue(mockSession)

    mockFollowUp = {
      summary: { finalized: false },
      loadFollowUpSession: vi.fn(),
      finalize: vi.fn(),
    }
    vi.mocked(useFollowUpStore).mockReturnValue(mockFollowUp)

    mockToast = { error: vi.fn(), success: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  it('renders dual service indicators', () => {
    expect(wrapper.text()).toContain('Import')
    expect(wrapper.text()).toContain('Upload')
  })

  it('loads specialties, locations and workspaces on mount', async () => {
    await flushPromises()
    expect(mockStore.loadSpecialties).toHaveBeenCalledTimes(1)
    expect(mockStore.loadLocations).toHaveBeenCalledTimes(1)
    expect(mockStore.loadWorkspaces).toHaveBeenCalledTimes(1)
    expect(mockStore.refreshServiceStatus).toHaveBeenCalledTimes(1)
  })

  it('calls inspection import with inspection + specialty', async () => {
    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.find('#importInspection').setValue('0224')
    await wrapper.find('#importSpecialty').setValue('VIG')
    await wrapper.find('#importDataBtn').trigger('click')

    expect(mockStore.importChecklist).toHaveBeenCalledWith('0224', 'VIG')
    expect(mockStore.importFindings).not.toHaveBeenCalled()
  })

  it('switches to follow-up mode and imports by location + specialty', async () => {
    mockStore.uiMode = 'followUp'
    wrapper.unmount()
    wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()

    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.find('#importLocation').setValue('MDSD')
    await wrapper.find('#importSpecialty').setValue('COM')
    await wrapper.find('#importDataBtn').trigger('click')

    expect(mockStore.importFindings).toHaveBeenCalledWith('COM', 'MDSD')
    expect(mockStore.importChecklist).not.toHaveBeenCalled()
  })

  it('shows specific toast when import service is offline', async () => {
    mockStore.importServiceOnline = false
    wrapper = mount(App, { global: { plugins: [pinia] } })

    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.find('#importDataBtn').trigger('click')
    expect(mockToast.error).toHaveBeenCalledWith('Import service offline (localhost:1880)')
  })

  it('opens and closes import modal', async () => {
    expect(wrapper.find('#importDataBtn').exists()).toBe(false)

    await wrapper.find('#openImportModalBtn').trigger('click')
    expect(wrapper.find('#importDataBtn').exists()).toBe(true)

    await wrapper.find('#cancelImportModalBtn').trigger('click')
    expect(wrapper.find('#importDataBtn').exists()).toBe(false)
  })

  it('shows a compact import summary in modal', async () => {
    await wrapper.find('#openImportModalBtn').trigger('click')

    expect(wrapper.text()).toContain('Mode:')
    expect(wrapper.text()).toContain('Inspection:')
    expect(wrapper.text()).toContain('Specialty: Not selected')

    await wrapper.find('#importInspection').setValue('0224')
    await wrapper.find('#importSpecialty').setValue('VIG')
    expect(wrapper.text()).toContain('Inspection: 0224')
    expect(wrapper.text()).toContain('Specialty: VIG - Sistemas de Vigilancia')

    mockStore.uiMode = 'followUp'
    wrapper.unmount()
    wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.find('#importLocation').setValue('MDSD')
    await wrapper.find('#importSpecialty').setValue('COM')

    expect(wrapper.text()).toContain('Location: MDSD - Las Americas')
    expect(wrapper.text()).toContain('Specialty: COM - Comunicaciones')
  })

  it('shows upload follow-up label in follow-up mode', async () => {
    mockStore.uiMode = 'followUp'
    mockStore.findingsLoaded = true
    mockFollowUp.summary.finalized = true
    wrapper = mount(App, { global: { plugins: [pinia] } })

    expect(wrapper.find('#exportUploadBtn').text()).toBe('Upload Follow-up')
  })
})
