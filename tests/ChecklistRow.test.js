import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChecklistRow from '../src/components/ChecklistRow.vue'
import { useSessionStore } from '../src/stores/sessionStore'
import { useEvidenceStore } from '../src/stores/evidenceStore'
import { useToast } from 'vue-toastification'

// Mock dependencies
vi.mock('../src/stores/sessionStore')
vi.mock('../src/stores/evidenceStore')
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}))
vi.mock('../src/images/trash.png', () => ({ default: 'mock-trash-url' }))

describe('ChecklistRow.vue', () => {
  let wrapper
  let pinia
  let mockSessionStore
  let mockEvidenceStore
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

    // Mock toast
    mockToast = { success: vi.fn(), error: vi.fn() }
    vi.mocked(useToast).mockReturnValue(mockToast)

    // Mount component with default props
    wrapper = mount(ChecklistRow, {
      props: {
        newTopic: false,
        qnumber: 1,
        row: {
          id: 'checklist-1',
          topic: 'Topic 1',
          reference: 'REF1',
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
        qnumber: 1,
        row: {
          id: 'checklist-1',
          topic: 'Topic 1',
          reference: 'REF1',
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
    expect(wrapper.find('td[id="qnumber-1"]').text()).toBe('1')
    expect(wrapper.find('td:nth-child(1)').isVisible()).toBeFalsy
    expect(wrapper.find('td:nth-child(3)').text()).toBe('REF1')
    expect(wrapper.find('td.question').text()).toBe('Question 1?')
    expect(wrapper.find('td.verification').text()).toBe('Verify 1')
  })

  describe('Compliance', () => {
    it('renders compliance radio buttons', () => {
      const radios = wrapper.findAll('input[type="radio"]')
      expect(radios.length).toBe(3) // Not applicable, Compliant, Non-compliant
      expect(radios[0].attributes('name')).toBe('compliance-1')
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
      const radio = wrapper.find('input[value="Non-compliant"]')
      await radio.setValue(true)
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
        1,
        'checklist-1',
        'compliance',
        'Non-compliant'
      )
    })

    it('correctly changes style of radio button cell on compliance change', async () => {
      const cell = wrapper.find('td.compliance')
      expect(cell.attributes('style')).toBe('border: 3px solid rgb(85, 255, 85);')
      await wrapper.setProps({ session: { compliance: 'Non-compliant' } })
      expect(wrapper.props().session.compliance).toBe('Non-compliant')
      expect(cell.attributes('style')).toBe('border: 3px solid rgb(255, 85, 85);')
    })

    it('correctly shows or hides non-conformity text area', async () => {
      const cell = wrapper.find('div.non-conformity')
      expect(cell.attributes('hidden')).toBeDefined()
      await wrapper.setProps({ session: { compliance: 'Non-compliant' } })
      expect(wrapper.props().session.compliance).toBe('Non-compliant')
      expect(cell.attributes('hidden')).toBeUndefined()
    })
  })

  describe('Comments', () => {
    it('renders comments textarea', () => {
      const textarea = wrapper.find('textarea[name="comments-1"]')
      expect(textarea.element.value).toBe('Looks good')
    })

    it('disables textarea when finalized', () => {
      mockSessionStore.summary.finalized = true
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      })
      expect(wrapper.find('textarea[name="comments-1"').attributes('disabled')).toBeDefined()
    })

    it('triggers textAreaChange on comments input', async () => {
      const textarea = wrapper.find('textarea[name="comments-1"')
      await textarea.setValue('Updated comment')
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(
        1,
        'checklist-1',
        'comments',
        'Updated comment'
      )
    })
  })

  describe('Evidence', () => {
    it('renders evidence file input', () => {
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('name')).toBe('evidence-1')
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
          qnumber: 1,
          row: {
            id: 'checklist-1',
            topic: 'Topic 1',
            reference: 'REF1',
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
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', [
        'file1.jpg',
        'newfile.jpg',
      ])
      expect(mockToast.success).toHaveBeenCalledWith('Evidence updated')
    })

    it('handles evidenceChange with a missing file', async () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          qnumber: 1,
          row: {
            id: 'checklist-1',
            topic: 'Topic 1',
            reference: 'REF1',
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
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', [
        'missing.jpg',
      ])
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
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', [
        'file1.jpg',
      ])
    })

    it('handles removeEvidence', async () => {
      const trashButton = wrapper.findAll('input[type="image"]')
      await trashButton[2].trigger('click')

      expect(mockEvidenceStore.subtract).toHaveBeenCalledWith('VIG', 'file1.jpg')
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', [])
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
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', [])
    })

    it('handles empty evidence array', () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          qnumber: 1,
          row: {
            id: 'checklist-1',
            topic: 'Topic 1',
            reference: 'REF1',
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
})
