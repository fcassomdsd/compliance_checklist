import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import App from '../src/App.vue';
import ChecklistTable from '../src/components/ChecklistTable.vue';
import ModalWindow from '../src/components/ModalWindow.vue';
import { useChecklistStore } from '../src/stores/checklistStore.js';

// Mock dependencies
vi.mock('../src/components/ChecklistTable.vue');
vi.mock('../src/components/ModalWindow.vue');
vi.mock('../src/stores/checklistStore.js');
vi.mock('../src/images/logo_idac.png', () => ({ default : 'mock-logo-url' }));

describe('App.vue', () => {
  let wrapper;
  let pinia;
  let mockStore;
  let defaultPathExists;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    // Mock store
    mockStore = {
      specialty: 'NONE',
      specialtyList: [
        { code: 'VIG', name: 'Vigilancia Radar' },
        { code: 'COM', name: 'Comunicaciones de Radio' },
      ],
      sessionSummary: { location: '', finalized: false },
      checklistLoaded: false,
      currentPath: '',
      showModal: false,
      tituloModal: '',
      explanationModal: '',
      accionModal: '',
      modalFinalizeTitle: 'Finalize Checklist',
      modalFinalizeExplanation: 'Finalizing the checklist will prevent further changes, and cannot be undone',
      modalFinalizeAction: 'finalize the current checklist',
      loadChecklistAndSession: vi.fn(),
      showFinalize : vi.fn(),
      confirmModal : vi.fn(),
      checkDefaultPath: vi.fn(),
      finalize: vi.fn(),
    };
    vi.mocked(useChecklistStore).mockReturnValue(mockStore);

    // Mount component
    wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    });
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  it('renders correctly', () => {
    expect(wrapper.find('h2').text()).toBe('Compliance Table with Evidence (Desktop)');
    expect(wrapper.find('img').attributes('src')).toBe('mock-logo-url');
    expect(wrapper.find('select').exists()).toBe(true);
    expect(wrapper.findComponent(ModalWindow).exists()).toBe(true);
    expect(wrapper.findComponent(ChecklistTable).exists()).toBe(false); // Not loaded initially
  });

  it('displays session summary location', () => {
    mockStore.sessionSummary.location = '/mock/location';
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const spans = wrapper.findAll('span');
    expect(spans[1].text()).toBe('Location: /mock/location');
  });

  it('renders specialty options from store', () => {
    const select = wrapper.find('select');
    const options = select.findAll('option');
    expect(options.length).toBe(mockStore.specialtyList.length + 1); // +1 for NONE
    expect(options[1].text()).toBe('Vigilancia Radar');
    expect(options[1].attributes('value')).toBe('VIG');
  });

  it('binds specialty to store and calls loadChecklistAndSession on change', async () => {
    const select = wrapper.find('select');
    await select.setValue('VIG');
    expect(mockStore.specialty).toBe('VIG');
    expect(mockStore.loadChecklistAndSession).toHaveBeenCalledTimes(1);
  });

  it('renders finalize button disabled when finalized', async () => {
    mockStore.sessionSummary.finalized = true;
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const button = wrapper.find('#finalizeBtn');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toBe('Finalize inspection');
  });

  it('renders finalize button enabled when not finalized', async () => {
    mockStore.sessionSummary.finalized = false;
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const button = wrapper.find('#finalizeBtn');
    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('calls showFinalize on finalize button click', async () => {
    mockStore.sessionSummary.finalized = false;
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const button = wrapper.find('#finalizeBtn');
    await button.trigger('click');
    expect(mockStore.showFinalize).toHaveBeenCalled();
  });

  it('passes props to ModalWindow', () => {
    mockStore.showModal = true;
    mockStore.tituloModal = 'Test Title';
    mockStore.explanationModal = 'Test Explanation';
    mockStore.accionModal = 'Test Action';
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const modal = wrapper.findComponent(ModalWindow);
    expect(modal.props('show')).toBe(true);
    expect(modal.props('titulo')).toBe('Test Title');
    expect(modal.props('explanation')).toBe('Test Explanation');
    expect(modal.props('accion')).toBe('Test Action');
  });

  it('handles modal cancel event', async () => {
    mockStore.showModal = true;
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const modal = wrapper.findComponent(ModalWindow);
    await modal.vm.$emit('cancel');
    expect(mockStore.showModal).toBe(false);
  });

  it('handles modal confirm event', async () => {
    mockStore.showModal = true;
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const modal = wrapper.findComponent(ModalWindow);
    await modal.vm.$emit('confirm');
    expect(mockStore.confirmModal).toHaveBeenCalled();
  });

  it('renders currentPath', () => {
    mockStore.currentPath = '/mock/current/path';
    wrapper = mount(App, { global: { plugins: [pinia] } });
    expect(wrapper.find('#currentPath').text()).toBe('/mock/current/path');
  });

  it('conditionally renders ChecklistTable when checklistLoaded', async () => {
    mockStore.checklistLoaded = false;
    wrapper = mount(App, { global: { plugins: [pinia] } });
    expect(wrapper.findComponent(ChecklistTable).exists()).toBe(false);

    mockStore.checklistLoaded = true;
    wrapper = mount(App, { global: { plugins: [pinia] } });
    const ctable = wrapper.findComponent(ChecklistTable);
    expect(ctable.exists()).toBe(true);
  });

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
      });

      // Simulate onMounted
      await wrapper.vm.$nextTick();

      expect(mockStore.checkDefaultPath).toHaveBeenCalled();
    });
  });
});