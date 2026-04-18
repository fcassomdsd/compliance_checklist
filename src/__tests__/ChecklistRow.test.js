import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChecklistRow from '../components/ChecklistRow.vue'
import { useSessionStore } from '../stores/sessionStore'
import { useEvidenceStore } from '../stores/evidenceStore'
import { useAudioStore } from '../stores/audioStore'
import { useToast } from 'vue-toastification'

// Global mocks for DOM APIs used in camera modal/photo tests
beforeAll(() => {
  // Mock getContext for all canvas elements
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({ drawImage: vi.fn() })),
    writable: true,
  })
  // Mock toBlob for all canvas elements
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: function (cb) {
      cb(new Blob(['test'], { type: 'image/jpeg' }))
    },
    writable: true,
  })
  // Mock videoWidth and videoHeight for all video elements
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    value: 100,
    configurable: true,
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    value: 100,
    configurable: true,
  })
  // Mock srcObject for all video elements
  Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
    set(val) {
      this._srcObject = val
    },
    get() {
      return this._srcObject
    },
    configurable: true,
  })
})

// Mock dependencies
vi.mock('../stores/sessionStore')
vi.mock('../stores/evidenceStore')
vi.mock('../stores/audioStore')
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../assets/images/trash.png', () => ({ default: 'mock-trash-url' }))

describe('ChecklistRow.vue', () => {
  let wrapper
  let pinia
  let mockSessionStore
  let mockEvidenceStore
  let mockAudioStore
  let mockToast

  beforeEach(() => {
    // Set up Pinia
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock checklist store
    mockSessionStore = {
      summary: { finalized: false, specialty: 'VIG', generalComments: '' }, // <-- added generalComments
      updateSession: vi.fn(),
    }
    vi.mocked(useSessionStore).mockReturnValue(mockSessionStore)

    // Mock evidence store
    mockEvidenceStore = {
      files: {
        'file1.jpg': { URL: '/path/file1.jpg', count: 1 },
        'file2.jpg': { URL: '/path/file2.jpg', count: 2 },
        'missing.jpg': { URL: '', count: 0 },
      },
      add: vi.fn(),
      addCount: vi.fn(),
      subtract: vi.fn(),
    }
    vi.mocked(useEvidenceStore).mockReturnValue(mockEvidenceStore)

    // Mock audio store
    mockAudioStore = {
      files: {
        'audio1.webm': { URL: 'blob:audio1.webm', count: 1 },
        'audio2.webm': { URL: 'blob:audio2.webm', count: 1 },
      },
      add: vi.fn().mockResolvedValue('blob:audio1.webm'),
      addCount: vi.fn(),
      subtract: vi.fn().mockResolvedValue(true),
    }
    vi.mocked(useAudioStore).mockReturnValue(mockAudioStore)

    // Mock toast
    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    // Mount component with default props
    wrapper = mount(ChecklistRow, {
      props: {
        newTopic: false,
        questionCode: 'VIG-0001',
        row: {
          id: 'checklist-1',
          code: 'VIG-0001',
          topic: 'Topic 1',
          reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Sample texto', ICAOref: 'A10 PI 1.1' }, guidance: 'Manual 1.2' },
          question: 'Question 1?',
          verification: 'Verify 1',
        },
        session: {
          compliance: 'Compliant',
          comments: 'Looks good',
          evidence: ['file1.jpg'],
        },
      },
      global: {
        plugins: [pinia],
      },
    })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  it('renders topic row when newTopic is true', () => {
    wrapper = mount(ChecklistRow, {
      props: {
        newTopic: true,
        questionCode: 'VIG-0001',
        row: {
          id: 'checklist-1',
          code: 'VIG-0001',
          topic: 'Topic 1',
          reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Sample texto', ICAOref: 'A10 PI 1.1' }, guidance: 'Manual 1.2' },
          question: 'Question 1?',
          verification: 'Verify 1',
        },
        session: {},
      },
      global: { plugins: [pinia] },
    })

    const topicRow = wrapper.find('tr.full-span')
    expect(topicRow.exists()).toBe(true)
    expect(topicRow.find('td').attributes('colspan')).toBe('8')
    expect(topicRow.text()).toBe('Topic 1')
  })

  it('does not render topic row when newTopic is false', () => {
    const topicRow = wrapper.find('tr.full-span')
    expect(topicRow.exists()).toBe(false)
  })

  it('renders row data correctly', () => {
    expect(wrapper.find('td[id="qcode-VIG-0001"]').text()).toBe('VIG-0001')
    expect(wrapper.find('td:nth-child(1)').isVisible()).toBeFalsy
    const refCell = wrapper.find('td.reference')
    expect(refCell.text()).toContain('STD')
    expect(refCell.text()).toContain('RAD 10 10.1')
    expect(refCell.text()).toContain('GM')
    expect(refCell.text()).toContain('Manual 1.2')
    expect(wrapper.find('td.question').text()).toBe('Question 1?')
    expect(wrapper.find('td.verification').text()).toBe('Verify 1')
  })

  describe('Reference column', () => {
    it('shows STD block with clickable normativa link when normativa has fields', () => {
      const refCell = wrapper.find('td.reference')
      expect(refCell.find('.ref-label').text()).toBe('STD')
      const normBtn = refCell.find('button.normativa-link')
      expect(normBtn.exists()).toBe(true)
      expect(normBtn.text()).toBe('RAD 10 10.1')
      expect(normBtn.attributes('title')).toBe('Click to view ICAO reference and full text')
    })

    it('shows GM block when guidance is present', () => {
      const refCell = wrapper.find('td.reference')
      const labels = refCell.findAll('.ref-label')
      const gmLabel = labels.find((l) => l.text() === 'GM')
      expect(gmLabel).toBeTruthy()
      expect(refCell.text()).toContain('Manual 1.2')
    })

    it('hides STD block when normativa has no reglamento', () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          questionCode: 'VIG-0001',
          row: {
            id: 'checklist-1',
            code: 'VIG-0001',
            topic: 'Topic 1',
            reference: { normativa: {}, guidance: 'GM only' },
            question: 'Question 1?',
            verification: 'Verify 1',
          },
          session: {},
        },
        global: { plugins: [pinia] },
      })
      const refCell = wrapper.find('td.reference')
      expect(refCell.find('button.normativa-link').exists()).toBe(false)
      expect(refCell.text()).toContain('GM')
      expect(refCell.text()).toContain('GM only')
    })

    it('opens normativa modal on normativa link click', async () => {
      expect(wrapper.find('.normativa-modal-overlay').exists()).toBe(false)
      await wrapper.find('button.normativa-link').trigger('click')
      const modal = wrapper.find('.normativa-modal-overlay')
      expect(modal.exists()).toBe(true)
      expect(modal.text()).toContain('RAD 10 10.1')
      expect(modal.text()).toContain('A10 PI 1.1')
      expect(modal.text()).toContain('Sample texto')
    })

    it('closes normativa modal on close button click', async () => {
      await wrapper.find('button.normativa-link').trigger('click')
      expect(wrapper.find('.normativa-modal-overlay').exists()).toBe(true)
      await wrapper.find('.normativa-modal button').trigger('click')
      expect(wrapper.find('.normativa-modal-overlay').exists()).toBe(false)
    })

    it('closes normativa modal on overlay click', async () => {
      await wrapper.find('button.normativa-link').trigger('click')
      expect(wrapper.find('.normativa-modal-overlay').exists()).toBe(true)
      await wrapper.find('.normativa-modal-overlay').trigger('click')
      expect(wrapper.find('.normativa-modal-overlay').exists()).toBe(false)
    })
  })

  describe('Compliance', () => {
    it('renders compliance radio buttons', () => {
      const radios = wrapper.findAll('input[type="radio"]')
      expect(radios.length).toBe(3) // Not applicable, Compliant, Non-Compliant
      expect(radios[0].attributes('name')).toBe('compliance-VIG-0001')
      expect(radios[1].attributes('value')).toBe('Compliant')
      expect(radios[1].element.checked).toBe(true) // Matches session.compliance
      expect(wrapper.find('label').text()).toContain('Not applicable')
    })

    it('disables radio buttons when finalized', () => {
      mockSessionStore.summary.finalized = true
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      })
      const radios = wrapper.findAll('input[type="radio"]')
      radios.forEach((radio) => {
        expect(radio.attributes('disabled')).toBeDefined()
      })
    })

    it('triggers radioChange on compliance change', async () => {
      const radio = wrapper.find('input[value="Non-Compliant"]')
      await radio.setValue(true)
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
        'VIG-0001',
        'checklist-1',
        'compliance',
        'Non-Compliant',
        'VIG-0001'
      )
    })

    it('correctly changes style of radio button cell on compliance change', async () => {
      const cell = wrapper.find('td.compliance')
      expect(cell.attributes('style')).toBe('border: 3px solid rgb(85, 255, 85);')
      await wrapper.setProps({ session: { compliance: 'Non-Compliant' } })
      expect(wrapper.props().session.compliance).toBe('Non-Compliant')
      expect(cell.attributes('style')).toBe('border: 3px solid rgb(255, 85, 85);')
    })

    it('correctly shows or hides non-conformity text area', async () => {
      const cell = wrapper.find('div.non-conformity')
      expect(cell.attributes('hidden')).toBeDefined()
      await wrapper.setProps({ session: { compliance: 'Non-Compliant' } })
      expect(wrapper.props().session.compliance).toBe('Non-Compliant')
      expect(cell.attributes('hidden')).toBeUndefined()
    })

    it('renders finding level selector with default in non-conformity modal', async () => {
      await wrapper.setProps({
        session: {
          compliance: 'Non-Compliant',
          nonConformityDetails: {},
        },
      })

      wrapper.vm.openNonConformityModal()
      await wrapper.vm.$nextTick?.()

      const findingLevelSelect = wrapper.find('select[name="findingLevel-VIG-0001"]')
      expect(findingLevelSelect.exists()).toBe(true)
      expect(findingLevelSelect.element.value).toBe('Non-Compliance')
    })

    it('updates finding level from non-conformity modal selector', async () => {
      await wrapper.setProps({
        session: {
          compliance: 'Non-Compliant',
          nonConformityDetails: {},
        },
      })

      wrapper.vm.openNonConformityModal()
      await wrapper.vm.$nextTick?.()

      const findingLevelSelect = wrapper.find('select[name="findingLevel-VIG-0001"]')
      await findingLevelSelect.setValue('Observation')

      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
        'VIG-0001',
        'checklist-1',
        'nonConformityDetails',
        expect.objectContaining({ findingLevel: 'Observation' }),
        'VIG-0001'
      )
    })
  })

  describe('Comments', () => {
    it('renders comments textarea', () => {
      const textarea = wrapper.find('textarea[name="comments-1"]')
      expect(textarea.exists()).toBe(false)
      const codeTextarea = wrapper.find('textarea[name="comments-VIG-0001"]')
      expect(codeTextarea.element.value).toBe('Looks good')
    })

    it('disables textarea when finalized', () => {
      mockSessionStore.summary.finalized = true
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      })
      expect(wrapper.find('textarea[name="comments-VIG-0001"').attributes('disabled')).toBeDefined()
    })

    it('triggers textAreaChange on comments input', async () => {
      const textarea = wrapper.find('textarea[name="comments-VIG-0001"')
      await textarea.setValue('Updated comment')
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
        'VIG-0001',
        'checklist-1',
        'comments',
        'Updated comment',
        'VIG-0001'
      )
    })
  })

  describe('Evidence', () => {
    it('triggers hidden file input click from evidenceUpload helper', () => {
      const click = vi.fn()
      const getElementById = vi.spyOn(document, 'getElementById').mockReturnValue({ click })

      wrapper.vm.evidenceUpload('VIG-0001')

      expect(getElementById).toHaveBeenCalledWith('fileInput-VIG-0001')
      expect(click).toHaveBeenCalledTimes(1)
      getElementById.mockRestore()
    })

    it('renders evidence file input', () => {
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('name')).toBe('evidence-VIG-0001')
      expect(fileInput.attributes('multiple')).toBeDefined()
    })

    it('disables file input when finalized', () => {
      mockSessionStore.summary.finalized = true
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      })
      expect(wrapper.find('input[type="file"]').attributes('disabled')).toBeDefined()
    })

    it('renders evidence table with files', () => {
      const rows = wrapper.findAll('table.preview tr')
      expect(rows.length).toBe(1)
      expect(rows[0].find('input[type="image"]').attributes('src')).toBe('mock-trash-url')
      expect(rows[0].find('a').text()).toBe('1file1.jpg')
      expect(rows[0].find('a').attributes('href')).toBe('/path/file1.jpg')
      expect(rows[0].find('td.missing').exists()).toBe(false)
    })

    it('marks missing evidence files', () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          questionCode: 'VIG-0001',
          row: {
            id: 'checklist-1',
            code: 'VIG-0001',
            topic: 'Topic 1',
            reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Sample texto', ICAOref: 'A10 PI 1.1' }, guidance: 'Manual 1.2' },
            question: 'Question 1?',
            verification: 'Verify 1',
          },
          session: { evidence: ['missing.jpg'] },
        },
        global: { plugins: [pinia] },
      })
      const row = wrapper.find('table.preview tr')
      expect(row.find('td.missing').exists()).toBe(true)
      expect(row.find('a').text()).toBe('0missing.jpg')
    })

    it('handles evidenceChange with valid files', async () => {
      const fileInput = wrapper.find('input[type="file"]')
      const files = [
        { name: 'newfile.jpg' },
        { name: 'file1.jpg' }, // Already in evidence
      ]
      Object.defineProperty(fileInput.element, 'files', {
        value: files,
        writable: false,
      })

      await fileInput.trigger('change')

      expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[0])
      expect(mockEvidenceStore.addCount).toHaveBeenCalledWith('newfile.jpg')
      expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[1])
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith('VIG-0001', 'checklist-1', 'evidence', [
        'file1.jpg',
        { name: 'newfile.jpg' },
      ], 'VIG-0001')
      expect(mockToast.success).toHaveBeenCalledWith('Evidence updated')
    })

    it('handles evidenceChange with a missing file', async () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          questionCode: 'VIG-0001',
          row: {
            id: 'checklist-1',
            code: 'VIG-0001',
            topic: 'Topic 1',
            reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Sample texto', ICAOref: 'A10 PI 1.1' }, guidance: 'Manual 1.2' },
            question: 'Question 1?',
            verification: 'Verify 1',
          },
          session: { evidence: ['missing.jpg'] },
        },
        global: { plugins: [pinia] },
      })
      const row = wrapper.find('table.preview tr')
      expect(row.find('td.missing').exists()).toBe(true)
      expect(row.find('a').text()).toBe('0missing.jpg')

      const fileInput = wrapper.find('input[type="file"]')
      const files = [{ name: 'missing.jpg' }]
      Object.defineProperty(fileInput.element, 'files', {
        value: files,
        writable: false,
      })

      vi.mocked(mockEvidenceStore.addCount).mockImplementation(
        (fileName) => mockEvidenceStore.files[fileName].count++
      )
      await fileInput.trigger('change')

      expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[0])
      expect(mockEvidenceStore.addCount).toHaveBeenCalledWith('missing.jpg')
      expect(mockEvidenceStore.files['missing.jpg'].count).toBe(1)
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith('VIG-0001', 'checklist-1', 'evidence', [
        'missing.jpg',
      ], 'VIG-0001')
      expect(mockToast.success).toHaveBeenCalledWith('Evidence updated')
    })

    it('handles evidenceChange error', async () => {
      mockEvidenceStore.add.mockRejectedValue(new Error('Upload failed'))
      const fileInput = wrapper.find('input[type="file"]')
      const files = [{ name: 'newfile.jpg' }]
      Object.defineProperty(fileInput.element, 'files', {
        value: files,
        writable: false,
      })
      await fileInput.trigger('change')

      expect(mockToast.error).toHaveBeenCalledWith('Upload failed')
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith('VIG-0001', 'checklist-1', 'evidence', [
        'file1.jpg',
      ], 'VIG-0001')
    })

    it('handles removeEvidence', async () => {
      const trashButton = wrapper.findAll('input[type="image"]')
      await trashButton[2].trigger('click')

      expect(mockEvidenceStore.subtract).toHaveBeenCalledWith('VIG', 'file1.jpg')
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
        'VIG-0001',
        'checklist-1',
        'evidence',
        [],
        'VIG-0001'
      )
    })

    it('disables trash button when finalized', () => {
      mockSessionStore.summary.finalized = true
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      })
      expect(wrapper.find('input[type="image"]').attributes('disabled')).toBeDefined()
    })

    it('handles removeEvidence error', async () => {
      mockEvidenceStore.subtract.mockRejectedValue(new Error('Remove failed'))
      const trashButton = wrapper.findAll('input[type="image"]')
      await trashButton[2].trigger('click')

      expect(mockToast.error).toHaveBeenCalledWith('Remove failed')
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
        'VIG-0001',
        'checklist-1',
        'evidence',
        [],
        'VIG-0001'
      )
    })

    it('handles empty evidence array', () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          questionCode: 'VIG-0001',
          row: {
            id: 'checklist-1',
            code: 'VIG-0001',
            topic: 'Topic 1',
            reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Sample texto', ICAOref: 'A10 PI 1.1' }, guidance: 'Manual 1.2' },
            question: 'Question 1?',
            verification: 'Verify 1',
          },
          session: { evidence: [] },
        },
        global: { plugins: [pinia] },
      })
      expect(wrapper.find('table.preview tr').exists()).toBe(false)
    })
  })

  describe('Camera modal', () => {
    it('closes camera modal gracefully when no stream is attached', async () => {
      wrapper.vm.showCameraModal = true
      await wrapper.vm.$nextTick?.()
      wrapper.vm.closeCameraModal()
      expect(wrapper.vm.showCameraModal).toBe(false)
    })

    it('opens camera modal and sets video stream', async () => {
      const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
      globalThis.navigator.mediaDevices = { getUserMedia }
      // Show the camera modal so the video ref is rendered
      wrapper.vm.showCameraModal = true
      await wrapper.vm.$nextTick?.()
      // Replace $refs.video with a mock object
      const videoMock = { srcObject: null }
      wrapper.vm.$refs.video = videoMock
      wrapper.vm.video = { value: videoMock }
      await wrapper.vm.openCamera()
      expect(wrapper.vm.showCameraModal).toBe(true)
      expect(getUserMedia).toHaveBeenCalledWith({ video: true })
      expect(videoMock.srcObject).toBeDefined()
    })

    it('closes camera modal and stops video tracks', async () => {
      const stop = vi.fn()
      // Spy on getTracks globally
      const getTracksSpy = vi.fn(() => [{ stop }])
      Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
        set(val) {
          this._srcObject = val
        },
        get() {
          return { getTracks: getTracksSpy }
        },
        configurable: true,
      })
      wrapper.vm.showCameraModal = true
      await wrapper.vm.$nextTick?.()
      wrapper.vm.closeCameraModal()
      expect(wrapper.vm.showCameraModal).toBe(false)
      expect(getTracksSpy).toHaveBeenCalled()
      expect(stop).toHaveBeenCalled()
    })

    it('captures photo and updates evidence', async () => {
      wrapper.vm.showCameraModal = true
      await wrapper.vm.$nextTick?.()
      // Spy on getContext globally and ensure it returns the correct drawImage spy
      const drawImage = vi.fn()
      const getContextSpy = vi.fn(() => ({ drawImage }))
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: getContextSpy,
        writable: true,
      })
      // toBlob is already globally mocked
      wrapper.vm.evidenceStore = mockEvidenceStore //{ add, addCount, files: {} }
      wrapper.vm.sessionStore = mockSessionStore
      wrapper.vm.toast = mockToast
      wrapper.vm.props = wrapper.props()
      wrapper.vm.props.session = { evidence: [] }
      await wrapper.vm.capturePhoto()
      expect(getContextSpy).toHaveBeenCalledWith('2d')
      expect(drawImage).toHaveBeenCalled()
      expect(mockEvidenceStore.add).toHaveBeenCalled()
      expect(mockEvidenceStore.addCount).toHaveBeenCalled()
      expect(mockSessionStore.updateSession).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Evidence updated')
      expect(wrapper.vm.showCameraModal).toBe(false)
    })
  })

  describe('Audio Recording', () => {
    it('starts and stops comments recording through toggle helper', async () => {
      const stopTrack = vi.fn()
      const stream = { getTracks: () => [{ stop: stopTrack }] }
      const getUserMedia = vi.fn().mockResolvedValue(stream)
      globalThis.navigator.mediaDevices = { getUserMedia }

      class MockMediaRecorder {
        constructor() {
          this.state = 'inactive'
          this.ondataavailable = null
          this.onstop = null
        }

        start() {
          this.state = 'recording'
        }

        stop() {
          this.state = 'inactive'
          if (this.onstop) {
            this.onstop()
          }
        }
      }

      globalThis.MediaRecorder = MockMediaRecorder

      await wrapper.vm.toggleAudioRecordingComments()
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(wrapper.vm.recordingComments).toBe(true)
      expect(mockToast.info).toHaveBeenCalledWith('Recording started...')

      await wrapper.vm.toggleAudioRecordingComments()
      expect(wrapper.vm.recordingComments).toBe(false)
    })

    it('starts and stops non-conformity recording through toggle helper', async () => {
      const stream = { getTracks: () => [{ stop: vi.fn() }] }
      const getUserMedia = vi.fn().mockResolvedValue(stream)
      globalThis.navigator.mediaDevices = { getUserMedia }

      class MockMediaRecorder {
        constructor() {
          this.state = 'inactive'
          this.ondataavailable = null
          this.onstop = null
        }

        start() {
          this.state = 'recording'
        }

        stop() {
          this.state = 'inactive'
          if (this.onstop) {
            this.onstop()
          }
        }
      }

      globalThis.MediaRecorder = MockMediaRecorder

      await wrapper.vm.toggleAudioRecordingNonConformity()
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(wrapper.vm.recordingNonConformity).toBe(true)

      await wrapper.vm.toggleAudioRecordingNonConformity()
      expect(wrapper.vm.recordingNonConformity).toBe(false)
    })

    it('shows an error when audio file is missing from store', async () => {
      await wrapper.vm.playAudio('missing.webm')
      expect(mockToast.error).toHaveBeenCalledWith('Audio file not found')
    })

    it('shows an error when microphone access fails', async () => {
      globalThis.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Mic blocked')),
      }

      await wrapper.vm.startAudioRecording('comments')

      expect(mockToast.error).toHaveBeenCalledWith('Could not access microphone: Mic blocked')
    })

    it('saves audio recording and updates store', async () => {
      mockAudioStore.add.mockResolvedValue('blob:audio-new.webm')

      // Create a mock blob
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' })
      mockBlob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))

      await wrapper.vm.saveAudioRecording(mockBlob, 'comments')

      expect(mockAudioStore.add).toHaveBeenCalled()
      expect(mockAudioStore.addCount).toHaveBeenCalled()
      expect(mockSessionStore.updateSession).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Audio recording saved')
    })

    it('handles audio save error', async () => {
      mockAudioStore.add.mockRejectedValue(new Error('Save failed'))

      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' })
      mockBlob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))

      await wrapper.vm.saveAudioRecording(mockBlob, 'comments')

      expect(mockToast.error).toHaveBeenCalledWith('Failed to save audio: Save failed')
    })

    it('plays audio from store URL', () => {
      // Mock window.electronAPI.playAudio
      window.electronAPI = { playAudio: vi.fn() }

      const fileName = 'audio1.webm'
      wrapper.vm.playAudio(fileName)

      expect(mockAudioStore.files[fileName].URL).toBe('blob:audio1.webm')
    })

    it('removes audio recording and updates store', async () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          questionCode: 'VIG-0001',
          row: {
            id: 'checklist-1',
            code: 'VIG-0001',
            topic: 'Topic 1',
            reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Sample texto', ICAOref: 'A10 PI 1.1' }, guidance: 'Manual 1.2' },
            question: 'Question 1?',
            verification: 'Verify 1',
          },
          session: {
            compliance: 'Compliant',
            audioComments: ['audio1.webm'],
          },
        },
        global: { plugins: [pinia] },
      })

      mockAudioStore.subtract.mockResolvedValue(true)

      await wrapper.vm.removeAudio(0, 'comments')

      expect(mockAudioStore.subtract).toHaveBeenCalledWith('VIG', 'audio1.webm')
      expect(mockSessionStore.updateSession).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Audio recording removed')
    })

    it('handles audio removal error', async () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          questionCode: 'VIG-0001',
          row: {
            id: 'checklist-1',
            code: 'VIG-0001',
            topic: 'Topic 1',
            reference: { normativa: { reglamento: 'RAD 10', articulo: '10.1', texto: 'Sample texto', ICAOref: 'A10 PI 1.1' }, guidance: 'Manual 1.2' },
            question: 'Question 1?',
            verification: 'Verify 1',
          },
          session: {
            compliance: 'Compliant',
            audioComments: ['audio1.webm'],
          },
        },
        global: { plugins: [pinia] },
      })

      mockAudioStore.subtract.mockRejectedValue(new Error('Delete failed'))

      await wrapper.vm.removeAudio(0, 'comments')

      expect(mockToast.error).toHaveBeenCalledWith('Failed to delete audio: Delete failed')
    })

    it('does not save audio if recording is undefined', async () => {
      await wrapper.vm.saveAudioRecording(undefined, 'audioComments')

      expect(mockAudioStore.add).not.toHaveBeenCalled()
    })
  })
})
