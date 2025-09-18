import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createFileService } from '../fileServices.js';
import { getEvidenceLinks } from '../../utils/session.js';

export const useEvidenceStore = defineStore('evidence', () => {

  const fs = createFileService();

    // State
    const files = ref({});

    // Actions
    const reset = () => {
        for (const key of Object.keys(files.value)) {
          delete files.value[key];            
        }
    };

    const load = async (specialty) => {
        const efiles = await fs.readEvidence(specialty);
        efiles.forEach( (x) => { files.value[x.name] = {};
                                 files.value[x.name]["URL"]= x.URL;
                                 files.value[x.name]["count"] = 0;
                               });

    };

    const updateCount = (obj) => {

      const evidenceLinks = getEvidenceLinks(JSON.stringify(obj))
      
      for ( const [linkName, linkObj] of Object.entries(evidenceLinks) ) {
        if (!files.value[linkName]) {
          files.value[linkName] = { URL : '', count : linkObj.count }
        }
        else {
          files.value[linkName].count = linkObj.count;
        }
      
      }     
    }
    
    const add = async (specialty, fileObj) => {

        const buffer = await fileObj.arrayBuffer();
        const savedPath = fs.saveEvidence(specialty, fileObj.name, buffer);

        // if file created or updated, update the URL
        if (savedPath !== null) {
          // if not tracking file, create record
          if (!files.value[fileObj.name]) {
            files.value[fileObj.name] = {};
            files.value[fileObj.name]["count"] = 0;
          }          
          files.value[fileObj.name]["URL"] = savedPath;
        } else {
          if (!files.value[fileObj.name]) {
            // file exists but was not being tracked.  error
            throw new Error('evidence.add: detected untracked file: '+ fileObj.name);
          }
        }
    }
    
    const addCount = (fileName) => {
      files.value[fileName].count++    
    }
    
    const subtract = async (specialty, fileName) => {
      if (files.value[fileName].count == 1) {
        await fs.deleteEvidence(specialty, fileName);
        delete files.value[fileName];      
      } else { 
        files.value[fileName].count--;
      }   
    }    
    
    return {
      files,
      load,
      reset,
      add,
      addCount,
      subtract,
      updateCount
    };
});
