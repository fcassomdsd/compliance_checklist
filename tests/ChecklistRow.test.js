import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChecklistRow from '../src/components/ChecklistRow.vue';
import { useChecklistStore } from '../src/stores/checklistStore';
import { useEvidenceStore } from '../src/stores/evidenceStore';
import { useToast } from 'vue-toastification';

// Mock dependencies
vi.mock('../src/stores/checklistStore');
vi.mock('../src/stores/evidenceStore');
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}));
vi.mock('../src/images/trash.png', () => ({ default: 'mock-trash-url'}));

describe('ChecklistRow.vue', () => {
  let wrapper;
  let pinia;
  let mockChecklistStore;
  let mockEvidenceStore;
  let mockToast;

  beforeEach(() => {
    // Set up Pinia
    pinia = createPinia();
    setActivePinia(pinia);

    // Mock checklist store
    mockChecklistStore = {
      sessionSummary: { finalized: false },
      updateSession: vi.fn(),
      specialty: 'VIG',
    };
    vi.mocked(useChecklistStore).mockReturnValue(mockChecklistStore);

    // Mock evidence store
    mockEvidenceStore = {
      files: {
        'file1.jpg': { URL: '/path/file1.jpg', count: 1 },
        'file2.jpg': { URL: '/path/file2.jpg', count: 2 },
      },
      add: vi.fn(),
      addCount: vi.fn(),
      subtract: vi.fn(),
    };
    vi.mocked(useEvidenceStore).mockReturnValue(mockEvidenceStore);

    // Mock toast
    mockToast = { success: vi.fn(), error: vi.fn() };
    vi.mocked(useToast).mockReturnValue(mockToast);

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
    });
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  it('renders topic row when newTopic is true', () => {
    wrapper = mount(ChecklistRow, {
      props: {
        newTopic: true,
        qnumber: 1,
        row: { id: 'checklist-1', topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
        session: {},
      },
      global: { plugins: [pinia] },
    });

    const topicRow = wrapper.find('tr.full-span');
    expect(topicRow.exists()).toBe(true);
    expect(topicRow.find('td').attributes('colspan')).toBe('8');
    expect(topicRow.text()).toBe('Topic 1');
  });

  it('does not render topic row when newTopic is false', () => {
    const topicRow = wrapper.find('tr.full-span');
    expect(topicRow.exists()).toBe(false);
  });

  it('renders row data correctly', () => {
    expect(wrapper.find('td[id="qnumber-1"]').text()).toBe('1');
    expect(wrapper.find('td:nth-child(1)').isVisible()).toBeFalsy;
    expect(wrapper.find('td:nth-child(3)').text()).toBe('REF1');
    expect(wrapper.find('td.question').text()).toBe('Question 1?');
    expect(wrapper.find('td.verification').text()).toBe('Verify 1');
  });

  it('renders compliance radio buttons', () => {
    const radios = wrapper.findAll('input[type="radio"]');
    expect(radios.length).toBe(4); // Not applicable, Compliant, Partial Compliance, Non-compliant
    expect(radios[0].attributes('name')).toBe('compliance-1');
    expect(radios[1].attributes('value')).toBe('Compliant');
    expect(radios[1].element.checked).toBe(true); // Matches session.compliance
    expect(wrapper.find('label').text()).toContain('Not applicable');
  });

  it('disables radio buttons when finalized', () => {
    mockChecklistStore.sessionSummary.finalized = true;
    wrapper = mount(ChecklistRow, {
      props: wrapper.vm.$props,
      global: { plugins: [pinia] },
    });
    const radios = wrapper.findAll('input[type="radio"]');
    radios.forEach((radio) => {
      expect(radio.attributes('disabled')).toBeDefined();
    });
  });

  it('triggers radioChange on compliance change', async () => {
    const radio = wrapper.find('input[value="Non-compliant"]');
    await radio.setValue(true);
    expect(mockChecklistStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'compliance', 'Non-compliant');
  });

  it('renders comments textarea', () => {
    const textarea = wrapper.find('textarea[name="comments-1"]');
    expect(textarea.element.value).toBe('Looks good');
  });

  it('disables textarea when finalized', () => {
    mockChecklistStore.sessionSummary.finalized = true;
    wrapper = mount(ChecklistRow, {
      props: wrapper.vm.$props,
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
  });

  it('triggers textAreaChange on comments input', async () => {
    const textarea = wrapper.find('textarea');
    await textarea.setValue('Updated comment');
    expect(mockChecklistStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'comments', 'Updated comment');
  });

  it('renders evidence file input', () => {
    const fileInput = wrapper.find('input[type="file"]');
    expect(fileInput.exists()).toBe(true);
    expect(fileInput.attributes('name')).toBe('evidence-1');
    expect(fileInput.attributes('multiple')).toBeDefined();
  });

  it('disables file input when finalized', () => {
    mockChecklistStore.sessionSummary.finalized = true;
    wrapper = mount(ChecklistRow, {
      props: wrapper.vm.$props,
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('input[type="file"]').attributes('disabled')).toBeDefined();
  });

  it('renders evidence table with files', () => {
    const rows = wrapper.findAll('table.preview tr');
    expect(rows.length).toBe(1);
    expect(rows[0].find('input[type="image"]').attributes('src')).toBe('mock-trash-url');
    expect(rows[0].find('a').text()).toBe('1file1.jpg');
    expect(rows[0].find('a').attributes('href')).toBe('/path/file1.jpg');
    expect(rows[0].find('td.missing').exists()).toBe(false);
  });

  it('marks missing evidence files', () => {
    wrapper = mount(ChecklistRow, {
      props: {
        newTopic: false,
        qnumber: 1,
        row: { id: 'checklist-1', topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
        session: { evidence: ['missing.jpg'] },
      },
      global: { plugins: [pinia] },
    });
    const row = wrapper.find('table.preview tr');
    expect(row.find('td.missing').exists()).toBe(true);
    expect(row.find('a').text()).toBe('missing.jpg');
  });

  it('handles evidenceChange with valid files', async () => {
    const fileInput = wrapper.find('input[type="file"]');
    const files = [
      { name: 'newfile.jpg' },
      { name: 'file1.jpg' }, // Already in evidence
    ];
    Object.defineProperty(fileInput.element, 'files', {
        value: files,
        writable: false,
    });      
    await fileInput.trigger('change');

    expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[0]);
    expect(mockEvidenceStore.addCount).toHaveBeenCalledWith('newfile.jpg');
    expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[1]);
    expect(mockChecklistStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', ['file1.jpg', 'newfile.jpg']);
    expect(mockToast.success).toHaveBeenCalledWith('Evidence updated');
  });

  it('handles evidenceChange error', async () => {
    mockEvidenceStore.add.mockRejectedValue(new Error('Upload failed'));
    const fileInput = wrapper.find('input[type="file"]');
    const files = [{ name: 'newfile.jpg' }];
    Object.defineProperty(fileInput.element, 'files', {
        value: files,
        writable: false,
    });      
    await fileInput.trigger('change');

    expect(mockToast.error).toHaveBeenCalledWith('Upload failed');
    expect(mockChecklistStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', ['file1.jpg']);
  });

  it('handles removeEvidence', async () => {
    const trashButton = wrapper.find('input[type="image"]');
    await trashButton.trigger('click');

    expect(mockEvidenceStore.subtract).toHaveBeenCalledWith('VIG', 'file1.jpg');
    expect(mockChecklistStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', []);
  });

  it('disables trash button when finalized', () => {
    mockChecklistStore.sessionSummary.finalized = true;
    wrapper = mount(ChecklistRow, {
      props: wrapper.vm.$props,
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('input[type="image"]').attributes('disabled')).toBeDefined();
  });

  it('handles removeEvidence error', async () => {
    mockEvidenceStore.subtract.mockRejectedValue(new Error('Remove failed'));
    const trashButton = wrapper.find('input[type="image"]');
    await trashButton.trigger('click');

    expect(mockToast.error).toHaveBeenCalledWith('Remove failed');
    expect(mockChecklistStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', []);
  });

  it('handles empty evidence array', () => {
    wrapper = mount(ChecklistRow, {
      props: {
        newTopic: false,
        qnumber: 1,
        row: { id: 'checklist-1', topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
        session: { evidence: [] },
      },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('table.preview tr').exists()).toBe(false);
  });
});
