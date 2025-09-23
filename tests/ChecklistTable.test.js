import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChecklistTable from '../src/components/ChecklistTable.vue';
import ChecklistRow from '../src/components/ChecklistRow.vue';
import { useChecklistStore } from '../src/stores/checklistStore';

// Mock ChecklistRow component
vi.mock('../src/components/ChecklistRow.vue');
vi.mock('../src/stores/checklistStore');

describe('ChecklistTable.vue', () => {
  let wrapper;
  let pinia;
  let mockStore;

  beforeEach(() => {
    // Set up Pinia
    pinia = createPinia();
    setActivePinia(pinia);

    // Mock store
    mockStore = {
      checklist: {
        questions: [
          { topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
          { topic: 'Topic 1', reference: 'REF2', question: 'Question 2?', verification: 'Verify 2' },
          { topic: 'Topic 2', reference: 'REF3', question: 'Question 3?', verification: 'Verify 3' },
        ],
      },
      sessionData: {
        1: { compliance: 'Compliant', id: 'checklist-1' },
        2: { compliance: 'Non-compliant', id: 'checklist-2' },
        3: { compliance: 'Non-compliant', id: 'checklist-3' },
      },
    };
    vi.mocked(useChecklistStore).mockReturnValue(mockStore);

    // Mount component
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: {
          ChecklistRow: true,
        },
      },
    });
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  it('renders table structure correctly', () => {
    expect(wrapper.find('table#cklTable').exists()).toBe(true);
    const headers = wrapper.findAll('thead tr th');
    expect(headers.length).toBe(7);
    expect(headers[0].text()).toBe('#');
    expect(headers[1].text()).toBe('Reference');
    expect(headers[2].text()).toBe('Question');
    expect(headers[3].text()).toBe('Verification');
    expect(headers[4].text()).toBe('Compliance');
    expect(headers[5].text()).toBe('Comments');
    expect(headers[6].text()).toBe('Evidence');
  });

  it('applies correct CSS classes to headers', () => {
    expect(wrapper.find('th.question').exists()).toBe(true);
    expect(wrapper.find('th.verification').exists()).toBe(true);
    expect(wrapper.find('th.compliance').exists()).toBe(true);
    expect(wrapper.find('th.comments').exists()).toBe(true);
    expect(wrapper.find('th.evidence').exists()).toBe(true);
  });

  it('renders ChecklistRow components for each question', () => {
    const rows = wrapper.findAllComponents(ChecklistRow);
    expect(rows.length).toBe(3); // One for each question
  });

  it('passes correct props to ChecklistRow components', () => {
    const rows = wrapper.findAllComponents(ChecklistRow);
    expect(rows[0].props()).toEqual({
      newTopic: true,
      qnumber: 1,
      row: { topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
      session: { compliance: 'Compliant', id: 'checklist-1' },
    });
    expect(rows[1].props()).toEqual({
      newTopic: false,
      qnumber: 2,
      row: { topic: 'Topic 1', reference: 'REF2', question: 'Question 2?', verification: 'Verify 2' },
      session: { compliance: 'Non-compliant', id: 'checklist-2' },
    });
    expect(rows[2].props()).toEqual({
      newTopic: true,
      qnumber: 3,
      row: { topic: 'Topic 2', reference: 'REF3', question: 'Question 3?', verification: 'Verify 3' },
      session: { compliance: 'Non-compliant', id: 'checklist-3' },
    });
  });

  it('calculates newTopic correctly with topicChange', () => {
    // Mount without stubbing to access topicChange
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
      },
    });
    const topicChange = wrapper.vm.topicChange;
    expect(topicChange('Topic 1')).toBe(true); // First topic
    expect(topicChange('Topic 1')).toBe(false); // Same topic
    expect(topicChange('Topic 2')).toBe(true); // New topic
    expect(topicChange('')).toBe(true); // Empty topic
    expect(topicChange('Topic 2')).toBe(false); // Same topic again
  });

  it('handles empty questions array', () => {
    mockStore.checklist = { questions: [] };
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: { ChecklistRow: true },
      },
    });
    const rows = wrapper.findAllComponents(ChecklistRow);
    expect(rows.length).toBe(0);
    expect(wrapper.find('tbody').exists()).toBe(true);
  });

  it('handles missing session data for a row', () => {
    mockStore.sessionData = { 1: { compliance: 'Compliant' } }; // Only session for first row
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: { ChecklistRow: true },
      },
    });
    const rows = wrapper.findAllComponents(ChecklistRow);
    expect(rows[1].props('session')).toEqual({}); // Empty object for missing session
    expect(rows[2].props('session')).toEqual({});
  });

  it('sets disabled attribute on table', () => {
    expect(wrapper.find('table#cklTable').attributes('disabled')).toBeDefined();
  });

  it('handles null checklist', () => {
    mockStore.checklist = null;
    wrapper = mount(ChecklistTable, {
      global: {
        plugins: [pinia],
        stubs: { ChecklistRow: true },
      },
    });
    const rows = wrapper.findAllComponents(ChecklistRow);
    expect(rows.length).toBe(0);
    expect(wrapper.find('tbody').exists()).toBe(true);
  });
});
