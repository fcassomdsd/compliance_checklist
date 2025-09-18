import { describe, it, test, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { createFileService } from '../src/fileServices.js';
import { useEvidenceStore } from '../src/stores/evidenceStore.js';
import { getEvidenceLinks } from '../utils/session.js';

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ "value" : refValue})),
}));
vi.mock('../src/fileServices.js');
vi.mock('../utils/session.js', ()=> ({
        getEvidenceLinks : (obj) => ({
          "onlyOne.txt" : { count : 1 },
          "IHaveThree.txt" : { count : 3 },
          "Ex3.json" : { count : 1 },
          "Ex4.json" : { count : 1 },
          "Ex6.json" : { count : 1 },
        })
      }));

describe('Evidence Store', () => {
  let pinia;
  let evidence;
  let mockFs;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    // Mock ref
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }));

    // Mock createFileService
    mockFs = {
      loadChecklist: vi.fn(),
      loadSession: vi.fn(),
      saveEvidence: vi.fn(),
      createDefaultPath: vi.fn(),
      readEvidence: vi.fn(),
      deleteEvidence: vi.fn(),
      updateEvidenceCount: vi.fn(),
    };
    vi.mocked(createFileService).mockReturnValue(mockFs);
    
    // Initialize store
    evidence = useEvidenceStore();
  });

  describe('evidence.reset', () => { 
    it('resets the files object to empty', () => {

      evidence.files.value['file1'] = {};
      evidence.files.value['file1'].URL = '/mocked/file1';
      evidence.files.value['file1'].count = 2;
      evidence.files.value['file2'] = {};
      evidence.files.value['file2'].URL = '/mocked/file2';
      evidence.files.value['file2'].count = 1;

      evidence.reset();
    
      expect(evidence.files.value).toEqual({});
    });
  });

  describe('evidence.load', () => { 
    it('loads the files object with correct data', async () => {

      mockFs.readEvidence.mockResolvedValue([{ name : "file1", URL : '/mocked/file1', count : 0 },
                                             { name : "file2", URL : '/mocked/file2', count : 0 }]);
      await evidence.load('VIG');
    
      expect(mockFs.readEvidence).toBeCalledWith('VIG');
      expect(evidence.files.value).toEqual({"file1" : { URL : '/mocked/file1', count : 0 },
                                      "file2" : { URL : '/mocked/file2', count : 0 }
                                    });
    });
    it('handles case when no files are read', async () => {

      mockFs.readEvidence.mockResolvedValue([]);
      await evidence.load('VIG');
    
      expect(mockFs.readEvidence).toBeCalledWith('VIG');
      expect(evidence.files.value).toEqual({});
    });
  });

  describe('evidence.add', () => { 
    beforeEach(() => {

      // set the example files content
      evidence.files.value = {
        'exists' : { URL : '/mocked/exists', count : 1 },
        'updated' : { URL : '/mocked/updated', count : 1 },
        'notOnDisk' : { URL : '/mocked/notOnDisk', count : 2 }
      }          

      mockFs.saveEvidence.mockImplementation((specialty, fileName, buffer) => {
        // we have three files on disk: exists, updated and unaccounted.  to test different scenarios
        if ( fileName == 'exists'|| fileName == 'unaccounted' ) {
          return null;  // dont save
        }
        if ( fileName == 'updated' ) {
          return '/mocked/updated'; // updated file        
        }
        return '/mocked/' + fileName;
      })

    });
    
    test('when file is new and not in files object', async () => {
      const fileObj = { name : 'file1', arrayBuffer : () => ('This is file1')}; 
      await evidence.add('VIG', fileObj);

      expect(mockFs.saveEvidence).toBeCalledWith('VIG','file1', 'This is file1');
      expect(mockFs.saveEvidence).toHaveReturned('/mocked/file1');
      expect(evidence.files.value['file1']).toEqual({ URL : '/mocked/file1', count : 0 });
    });
    
    test('when file exists and in files object', async () => {
      const fileObj = { name : 'exists', arrayBuffer : () => ('This is exists')}; 
      await evidence.add('VIG', fileObj);

      expect(mockFs.saveEvidence).toBeCalledWith('VIG','exists', 'This is exists');
      expect(mockFs.saveEvidence).toHaveReturned(null);
      expect(evidence.files.value['exists']).toEqual({ URL : '/mocked/exists', count : 1 });
    });
    
    test('when file exists but has been updated', async () => {
      const fileObj = { name : 'updated', arrayBuffer : () => ('This is updated')}; 
      await evidence.add('VIG', fileObj);

      expect(mockFs.saveEvidence).toBeCalledWith('VIG','updated', 'This is updated');
      expect(mockFs.saveEvidence).toHaveReturned('/mocked/updated');
      expect(evidence.files.value['updated']).toEqual({ URL : '/mocked/updated', count : 1 });
    });
    
    test('when file doesnt exist but is in files object', async () => {
      // shouldn't happen.  Somebody must have erased it while app was running.
      const fileObj = { name : 'notOnDisk', arrayBuffer : () => ('This is not on disk')}; 
      await evidence.add('VIG', fileObj);

      expect(mockFs.saveEvidence).toBeCalledWith('VIG','notOnDisk', 'This is not on disk');
      expect(mockFs.saveEvidence).toHaveReturned('/mocked/notOnDisk');
      expect(evidence.files.value['notOnDisk']).toEqual({ URL : '/mocked/notOnDisk', count : 2 });
    });
    
    test('when file exists but is not in files object', async () => {
      // shouldn't happen.  File was copied while running.  This is a problem
      const fileObj = { name : 'unaccounted', arrayBuffer : () => ('This is unaccounted for')};
      await expect(evidence.add('VIG', fileObj)).rejects.toThrow('evidence.add: detected untracked file: unaccounted');

      expect(mockFs.saveEvidence).toBeCalledWith('VIG','unaccounted', 'This is unaccounted for');
      expect(mockFs.saveEvidence).toHaveReturned('null');
      expect(evidence.files.value['unaccounted']).toBe(undefined);
    });
  });

  describe('evidence.subtract', () => { 
    beforeEach(() => {

      // set the example files content
      evidence.files.value = {
        'many' : { URL : '/mocked/many', count : 3 },
        'one' : { URL : '/mocked/one', count : 1 },
        'bad' : { URL : '/mocked/bad', count : 1 }
      }          
 
      mockFs.deleteEvidence.mockImplementation((specialty, fileName) => {
        // we have three files on disk: exists, updated and unaccounted.  to test different scenarios
        if ( fileName == 'one' ) {
          return true;  // dont save
        }
        if ( fileName == 'bad' ) {
          throw new Error('could not delete file ' + fileName);        
        }
      })
    });
    
    it('decrements the count in case of more than one link', async () => {

      await evidence.subtract('VIG', 'many');
    
      expect(mockFs.deleteEvidence).not.toBeCalled();
      expect(evidence.files.value).toEqual({
        'many' : { URL : '/mocked/many', count : 2 },
        'one' : { URL : '/mocked/one', count : 1 },
        'bad' : { URL : '/mocked/bad', count : 1 }
       });
    });

    it('removes the file in case of one link', async () => {

      await evidence.subtract('VIG', 'one');
    
      expect(mockFs.deleteEvidence).toBeCalledWith('VIG', 'one');
      expect(evidence.files.value).toEqual({
        'many' : { URL : '/mocked/many', count : 3 },
        'bad' : { URL : '/mocked/bad', count : 1 }
       });
    });
    
    it('does not modify evidence.files in case of error', async () => {

      await expect(evidence.subtract('VIG', 'bad')).rejects.toThrow('could not delete file bad');
    
      expect(mockFs.deleteEvidence).toBeCalledWith('VIG', 'bad');
      expect(evidence.files.value).toEqual({
        'many' : { URL : '/mocked/many', count : 3 },
        'one' : { URL : '/mocked/one', count : 1 },
        'bad' : { URL : '/mocked/bad', count : 1 }
       });
    });
    
  });

  describe('evidence.updateCount', () => { 
    beforeEach(() => {

      // set the example files content
      evidence.files.value = {
        'onlyOne.txt' : { URL : '/mocked/onlyOne.txt', count : 0 },
        'IHaveThree.txt' : { URL : '/mocked/IHaveThree.txt', count : 0 },
        'IHaveNone.txt' : { URL : '/mocked/IHaveNone.txt', count : 0 }
      }
    });
    it('updates the evidence.files with the correct number of entries in session', () => {

      // set the example session object
      const sampleJson = {
      "1": {
        "comments": "several evidences",
        "evidence": ["onlyOne.txt","IHaveThree.txt"]
      },
      "2": {
        "evidence": ["IHaveThree.txt"],
        "comments": "one evidence"
      },
      "3": {
        "comments": "no evidence"
      },
      "5": {
        "evidence": [],
        "comments": "empty evidence"
      },
      "6": {
        "evidence": ["Ex6.json","IHaveThree.txt", "Ex4.json","Ex3.json"],
        "comments": "a lot of evidence"
      }
    }

    evidence.updateCount(sampleJson, 'onlyOne.txt');
    
    expect(evidence.files.value['onlyOne.txt'].count).toBe(1);    
    expect(evidence.files.value['IHaveThree.txt'].count).toBe(3);    
    expect(evidence.files.value['IHaveNone.txt'].count).toBe(0);    
    expect(evidence.files.value['Ex6.json'].count).toBe(1);
    expect(evidence.files.value['Ex6.json'].URL).toBe('');    
    });

  });
    

});
