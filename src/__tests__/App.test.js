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
vi.mock('../utils/fileServices.js', () => ({
  createFileService: vi.fn(() => ({
    fetchInspectionProviders: vi.fn().mockResolvedValue([
      { inspectionId: 'INS1', inspectedProviderId: 'IP1', siteVisitId: 'SV1', code: '0224', status: 'Planned', serviceProviderId: 'SP1', serviceProviderName: 'Provider A' },
    ]),
  })),
}))

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
      removeInspectionSession: vi.fn(),
      removeFollowUpSession: vi.fn(),
      viewGeneratedReport: vi.fn(),
      checkDefaultPath: vi.fn(),
      confirmModal: vi.fn(),
    }
    vi.mocked(useChecklistStore).mockReturnValue(mockStore)

    mockSession = {
      summary: { finalized: false, generalComments: '' },
      responses: {},
      updateGeneralComments: vi.fn(),
      loadSession: vi.fn(),
    }
    vi.mocked(useSessionStore).mockReturnValue(mockSession)

    mockFollowUp = {
      summary: { finalized: false },
      responses: {},
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
    await wrapper.vm.$nextTick()
    wrapper.vm.selectedInspectionProvider = JSON.stringify(wrapper.vm.inspectionProviderList[0])
    await wrapper.vm.$nextTick()
    await wrapper.find('#importSpecialty').setValue('VIG')
    await wrapper.find('#importDataBtn').trigger('click')

    expect(mockStore.importChecklist).toHaveBeenCalledWith('INS1', 'VIG', { inspectedProviderId: 'IP1', siteVisitId: 'SV1' })
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
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Mode:')
    expect(wrapper.text()).toContain('Inspection:')
    expect(wrapper.text()).toContain('Specialty: Not selected')

    wrapper.vm.selectedInspectionProvider = JSON.stringify(wrapper.vm.inspectionProviderList[0])
    await wrapper.vm.$nextTick()
    await wrapper.find('#importSpecialty').setValue('VIG')
    expect(wrapper.text()).toContain('0224 / Provider A')
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

  it('populates inspectionProviderList and renders dropdown options', async () => {
    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.inspectionProviderList).toHaveLength(1)
    expect(wrapper.vm.inspectionProviderList[0].code).toBe('0224')
    expect(wrapper.vm.inspectionProviderList[0].serviceProviderName).toBe('Provider A')

    const select = wrapper.find('#importInspection')
    const options = select.findAll('option')
    expect(options).toHaveLength(2) // default + 1 option
    expect(options[1].text()).toBe('0224 / Provider A')
  })

  it('passes providerId from selected option to importChecklist', async () => {
    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.vm.$nextTick()

    // Select an option with a serviceProviderId
    wrapper.vm.selectedInspectionProvider = JSON.stringify(
      wrapper.vm.inspectionProviderList[0],
    )
    await wrapper.vm.$nextTick()
    await wrapper.find('#importSpecialty').setValue('VIG')
    await wrapper.find('#importDataBtn').trigger('click')

    expect(mockStore.importChecklist).toHaveBeenCalledWith('INS1', 'VIG', { inspectedProviderId: 'IP1', siteVisitId: 'SV1' })
  })

  it('passes inspectedProviderId fallback when serviceProviderId is missing', async () => {
    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.vm.$nextTick()

    wrapper.vm.selectedInspectionProvider = JSON.stringify({
      inspectionId: 'INS2',
      inspectedProviderId: 'IP2',
      code: '0225',
      status: 'Assigned',
    })
    await wrapper.vm.$nextTick()
    await wrapper.find('#importSpecialty').setValue('VIG')
    await wrapper.find('#importDataBtn').trigger('click')

    expect(mockStore.importChecklist).toHaveBeenCalledWith('INS2', 'VIG', { inspectedProviderId: 'IP2', siteVisitId: undefined })
  })

  it('shows an error toast when selected inspection has no inspectionId', async () => {
    await wrapper.find('#openImportModalBtn').trigger('click')
    await wrapper.vm.$nextTick()

    wrapper.vm.selectedInspectionProvider = JSON.stringify({
      inspectedProviderId: 'IP3',
      siteVisitId: 'SV3',
    })
    await wrapper.vm.$nextTick()
    await wrapper.find('#importSpecialty').setValue('VIG')
    await wrapper.find('#importDataBtn').trigger('click')

    expect(mockToast.error).toHaveBeenCalledWith(
      'Selected inspection has no inspectionId — it may need to be recreated',
    )
    expect(mockStore.importChecklist).not.toHaveBeenCalled()
  })

  it('shows upload follow-up label in follow-up mode', async () => {
    mockStore.uiMode = 'followUp'
    mockStore.findingsLoaded = true
    mockFollowUp.summary.finalized = true
    wrapper = mount(App, { global: { plugins: [pinia] } })

    expect(wrapper.find('#exportUploadBtn').text()).toBe('Upload Follow-up')
  })

  it('disables remove button when inspection session is touched and not uploaded', async () => {
    mockStore.specialty = 'VIG'
    mockStore.activeWorkspace = {
      locationId: 'MDSD',
      checklistTouched: true,
      checklistUploaded: false,
      followUpTouched: false,
      followUpUploaded: false,
    }
    wrapper.unmount()
    wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.find('#removeSessionBtn').attributes('disabled')).toBeDefined()
  })

  it('enables and routes remove button for uploaded follow-up session', async () => {
    mockStore.uiMode = 'followUp'
    mockStore.specialty = 'VIG'
    mockStore.activeWorkspace = {
      locationId: 'MDSD',
      checklistTouched: false,
      checklistUploaded: false,
      followUpTouched: true,
      followUpUploaded: true,
    }
    wrapper.unmount()
    wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()

    const removeBtn = wrapper.find('#removeSessionBtn')
    expect(removeBtn.attributes('disabled')).toBeUndefined()
    expect(removeBtn.text()).toBe('Remove Follow-up Session')

    await removeBtn.trigger('click')
    expect(mockStore.removeFollowUpSession).toHaveBeenCalledTimes(1)
    expect(mockStore.removeInspectionSession).not.toHaveBeenCalled()
  })
})
