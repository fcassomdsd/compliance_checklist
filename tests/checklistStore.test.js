import { describe, it, test, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref, reactive } from 'vue';
import { useToast } from 'vue-toastification';
import { createFileService } from '../src/fileServices.js';
import { useChecklistStore } from '../src/stores/checklistStore.js';
import { useEvidenceStore } from '../src/stores/evidenceStore.js';

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ "value" : refValue})),
  reactive: vi.fn(),
}));
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}));
vi.mock('../src/fileServices.js');
vi.mock('../src/stores/evidenceStore.js');

// timers
vi.useFakeTimers();


describe('Checklist Store', () => {
  let pinia;
  let store;
  let mockFs;
  let mockToast;
  let mockEvidence;
  //const displayToast = (msg) => msg;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Mock ref and reactive
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }));
    vi.mocked(reactive).mockImplementation((initialValue) => initialValue);

    // Mock useToast
    mockToast = { success: vi.fn(), error: vi.fn() };
    vi.mocked(useToast).mockReturnValue(mockToast);

    // Mock createFileService
    mockFs = {
      loadChecklist: vi.fn(),
      loadSession: vi.fn(),
      saveSession: vi.fn(),
      defaultPathExists : vi.fn(),
      createDefaultPath: vi.fn(),
      readEvidence: vi.fn(),
      setSavePath: vi.fn(),
      saveExportFile: vi.fn(),
      updateEvidenceCount: vi.fn(),
    };
    vi.mocked(createFileService).mockReturnValue(mockFs);
    
    mockEvidence = {
      load: vi.fn(),
      reset: vi.fn(),
      updateCount: vi.fn(),    
    };
    vi.mocked(useEvidenceStore).mockReturnValue(mockEvidence);
    
    // Initialize store
    store = useChecklistStore();
  });

  it('initializes state correctly', () => {
    expect(store.specialty).toEqual({ "value" : 'NONE'});
    expect(store.checklist).toEqual({ "value" : null  });
    expect(store.checklistLoaded).toEqual({ "value" : false});
    expect(store.currentPath).toEqual({ "value" : '' });
    expect(store.sessionData).toEqual({});
    expect(store.sessionSummary).toEqual({ "value" : { location: '', finalized: true }});
    expect(store.showModal).toEqual({ "value" : false });
    expect(store.tituloModal).toEqual({ "value" : '' });
    expect(store.explanationModal).toEqual({ "value" : '' });
    expect(store.accionModal).toEqual({ "value" : '' });
    
    // Verify specialtyList
    expect(store.specialtyList).toEqual([
      { code: 'VIG', name: 'Vigilancia Radar' },
      { code: 'COM', name: 'Comunicaciones de Radio' },
      { code: 'RNA', name: 'Radioayudas' },
      { code: 'EEM', name: 'Energia y Equipos MET' },
    ]);
  });

  describe('loadChecklistAndSession', () => {
    it('resets state and does nothing for specialty NONE', async () => {
      store.specialty.value = 'NONE';
      await store.loadChecklistAndSession();

      expect(store.checklist.value).toBe(null);
      expect(store.checklistLoaded.value).toBe(false);
      expect(store.sessionSummary.value.location).toBe('');
      expect(store.sessionSummary.value.finalized).toBe(true);
      expect(store.sessionData).toEqual({});

      expect(mockFs.loadChecklist).not.toHaveBeenCalled();
      expect(mockFs.loadSession).not.toHaveBeenCalled();
      expect(mockEvidence.reset).toHaveBeenCalled();
    });

    it('loads checklist, session, and evidence for valid specialty', async () => {
      store.specialty.value = 'VIG';
      let mockChecklist =  {
            specialty: 'VIG',
            questions: [{
              id : "1",
              question : "question 1",
              verification : "verification 1",
              topic : "topic 1",
              sequence : "0010",
              reference : "reference 1"
              }]
           }
      mockFs.loadChecklist.mockResolvedValue(mockChecklist);
      mockFs.loadSession.mockResolvedValue({ summary: { location: '/path' }, responses: { 1: { id: '1' } } });
      mockFs.setSavePath.mockResolvedValue('/path/VIG/Evidence');
      mockEvidence.load.mockResolvedValue([{ name: 'file.txt', URL: '/path/file.txt', count: 1 }]);

      await store.loadChecklistAndSession();

      expect(mockToast.error).not.toHaveBeenCalled();
      expect(store.checklist.value).toEqual(mockChecklist);
      expect(store.checklistLoaded.value).toBe(true);
      expect(store.currentPath.value).toBe('/path/VIG/Evidence');
      expect(store.sessionSummary.value).toEqual({ location: '/path', finalized: false, "specialty" : "VIG" });
      expect(store.sessionData).toEqual({ 1: { id: '1' } });

      expect(mockFs.loadChecklist).toHaveBeenCalledWith('VIG');
      expect(mockFs.loadSession).toHaveBeenCalledWith('VIG');
      expect(mockEvidence.load).toHaveBeenCalledWith('VIG');
    });

    it('handles load errors with toast', async () => {
      store.specialty.value = 'VIG';
      mockFs.loadChecklist.mockRejectedValue(new Error('Load failed'));

      await store.loadChecklistAndSession();

      expect(store.checklistLoaded.value).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith('Load failed');
    });

    it('updates evidence counts after loading', async () => {
      store.specialty.value = 'VIG';
      mockFs.loadChecklist.mockResolvedValue({ specialty: 'VIG', questions: [] });
      mockFs.loadSession.mockResolvedValue({ summary: { location: '/path' }, responses: { 1: { evidence: ['file.txt'] } } });
      mockFs.updateEvidenceCount.mockImplementation((file) => file.count = 1);

      await store.loadChecklistAndSession();

      expect(mockEvidence.load).toHaveBeenCalledWith('VIG');
      expect(mockEvidence.updateCount).toHaveBeenCalledWith({ 1: { evidence: ['file.txt'] } });
    });
  });

  describe('updateSession', () => {
    it('updates session data and triggers saveSession', () => {

      store.updateSession('1', 'checklist-1', 'compliance', 'Compliant');
      expect(store.sessionData['1']).toEqual({ compliance: 'Compliant', id: 'checklist-1' });
      expect(mockFs.saveSession).toHaveBeenCalled();
    });
  });

  describe('calls to saveSession', () => {
    it('saves session after debounce', async () => {
      store.sessionSummary.value.lastUpdated = new Date().toISOString();
      const mockSessionObj = { summary: store.sessionSummary.value, responses: store.sessionData };
      
      store.updateSession('1', 'checklist-1', 'compliance', 'Compliant');
      await vi.waitFor(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockFs.saveSession).toHaveBeenCalled();
    });
  });

  describe('showFinalize', () => {
    it('sets modal state', () => {
      store.showFinalize();

      expect(store.tituloModal.value).toBe('Finalize Checklist');
      expect(store.explanationModal.value).toBe('Finalizing the checklist will prevent further changes, and cannot be undone');
      expect(store.accionModal.value).toBe('finalize the current checklist');
      expect(store.showModal.value).toBe(true);
    });
  });

  describe('confirmModal', () => {
    it('handles finalize modal', async () => {
      store.tituloModal.value = 'Finalize Checklist';
      store.confirmModal();
      await vi.waitFor(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(store.sessionSummary.value.finalized).toBe(true);
      expect(mockToast.success).toHaveBeenCalledWith('Checklist finalized successfully!');
      expect(mockFs.saveSession).toHaveBeenCalled();
    });

    it('handles create default path modal', () => {
      store.tituloModal.value = 'Create default path';
      mockFs.createDefaultPath.mockImplementation((code) => true);

      store.confirmModal();

      expect(mockFs.createDefaultPath).toHaveBeenCalledTimes(4); // For each specialty
      expect(mockToast.success).toHaveBeenCalledWith('Default path created successfully!');
    });

    it('handles unknown modal', () => {
      store.tituloModal.value = 'Unknown';
      store.confirmModal();

      expect(mockToast.success).not.toHaveBeenCalled();
    });
  });

  describe('checkDefaultPath', () => {
    it('shows create default path modal', async () => {
      await store.checkDefaultPath();

      expect(mockFs.defaultPathExists).toHaveBeenCalled();
      expect(store.tituloModal.value).toBe('Create default path');
      expect(store.explanationModal.value).toBe('The default path for inspection data does not exist.  I can create it for you.');
      expect(store.accionModal.value).toBe('create the default path');
      expect(store.showModal.value).toBe(true);
    });
  });

  describe('finalize', () => {
    it('sets finalized to true and triggers saveSession', () => {

      store.sessionSummary.value = {
        specialty: "VIG",
        location: "Location A",
        finalized: false,
        lastUpdated: new Date().toISOString()
      };
      store.sessionData["1"] = {
        id: "1",
        compliance: "Compliant",
        comments: "Test comments",
        evidence: ["file1.txt"]
      };

      store.finalize();

      expect(store.sessionSummary.value.finalized).toBe(true);
      expect(mockFs.saveSession).toBeCalled();
    });
  });
  
  describe('export', () => {
    beforeEach( () => {

      store.specialty.value = 'VIG';
      store.checklist.value =  {
            specialty: 'VIG',
            questions: [{
                id : "1",
                question : "question 1",
                verification : "verification 1",
                topic : "topic 1",
                sequence : "0010",
                reference : "reference 1"
              },{
                id : "2",
                question : "question 2",
                verification : "verification 2",
                topic : "topic 1",
                sequence : "0020",
                reference : "reference 2"
              },{
                id : "3",
                question : "question 3",
                verification : "verification 3",
                topic : "topic 2",
                sequence : "0010",
                reference : "reference 3"
              },{
                id : "4",
                question : "question 4",
                verification : "verification 4",
                topic : "topic 2",
                sequence : "0020",
                reference : "reference 4"
              },{
                id : "5",
                question : "question 5",
                verification : "verification 5",
                topic : "topic 3",
                sequence : "0010",
                reference : "reference 5"
              },{
                id : "6",
                question : "question 6",
                verification : "verification 6",
                topic : "topic 3",
                sequence : "0020",
                reference : "reference 6"
              }
            ]
          }

      store.sessionSummary.value = {
        specialty: "VIG",
        location: "Location A",
        finalized: true,
        lastUpdated: new Date().toISOString()
      };

      store.sessionData["1"] = {
        id: "1",
        compliance: "Compliant",
        comments: 'Test "comments"',
      };

      store.sessionData["3"] = {
        id: "2",
        comments: "Multiline\nTest comments",
      };

      store.sessionData["4"] = {
        id: "3",
        compliance: "Non-compliant",
        comments: "Multiline\nTest comments"
      };

      store.sessionData["5"] = {
        id: "4",
        compliance: "Partial Compliance"
      };

      store.sessionData["6"] = {
        id: "5",
        compliance: "Not applicable",
        comments: "comments 6"
      };

    });
    
    it('creates export string correctly', async () => {

      const exportedString =
        'topic 2\n' +
        '4|"reference 4"|"question 4"|"Non-compliant"|"Multiline<br>Test comments"\n'+   
        'topic 3\n' +
        '5|\"reference 5\"|\"question 5\"|\"Partial Compliance\"|\"\"'   

      store.exportChecklist();

      await expect(mockFs.saveExportFile).toHaveBeenCalledWith(exportedString, "VIG");
      expect(mockToast.success).toHaveBeenCalledWith('Checklist exported');
    });

    it('handles an emtpy checklist', async () => {

      store.checklist.value.questions = [];
  
      store.exportChecklist();

      await expect(mockFs.saveExportFile).not.toBeCalledWith('abc', "VIG");
      expect(mockToast.error).toHaveBeenCalledWith('Empty checklist not exported');
    });
  });
});