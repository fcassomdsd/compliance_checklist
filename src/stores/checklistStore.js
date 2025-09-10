import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { useToast } from 'vue-toastification';
import { createElectronService } from "../electronServices.js";
const toast = useToast();
const es = createElectronService();

export const useChecklistStore = defineStore('checklist', () => {
    // State
    const specialty = ref('NONE');
    const checklist = ref(null);
    const checklistLoaded = ref(false);
    const currentPath = ref('');
    const evidenceFiles = ref([]);
    const sessionData = reactive({});
    const sessionSummary = ref({"location" : "", "finalized" : true});
    const showModal = ref(false);
    const tituloModal = ref('');
    const explanationModal = ref('');
    const accionModal = ref('');

    // modal window data
    const modalFinalizeTitle = "Finalize Checklist";
    const modalFinalizeExplanation = "Finalizing the checklist will prevent further changes, and cannot be undone";
    const modalFinalizeAction = "finalize the current checklist";
    const finalizeSuccess = "Checklist finalized successfully!";
    
    const modalCreateDPTitle = "Create default path";
    const modalCreateDPExplanation = "The default path for inspection data does not exist.  I can create it for you.";
    const modalCreateDPAction = "create the default path";
    const createDPSuccess = "Default path created successfully!";     
    
    
    let saveTimer = null;
    // Actions
    const loadChecklistAndSession = async () => {
        if (specialty.value == "NONE") {
            checklist.value = null;
            checklistLoaded.value = false;
            sessionSummary.value = {"location" : "", "finalized" : true};
            evidenceFiles.value = [];
            
            // clear out session data
            for (const key of Object.keys(sessionData)) {
              delete sessionData[key];            
            }
            return;
        } 
        try {
            currentPath.value = await window.electronAPI.setSavePath(specialty.value);
            let sessionRead = await window.electronAPI.loadSession(specialty.value);
            // can't assign session object directly;  use JSON.parse
            JSON.parse(JSON.stringify(sessionRead), (key, value) =>{
               if (key.match("[0-9]+") && typeof value == "object") {
                  sessionData[key] = value;
               } else {
                  if (key == "summary") {
                     sessionSummary.value = value;
                  }
               }
               return value;
            }); 
            if (!sessionSummary.value["finalized"]) {
              sessionSummary.value["finalized"] = false;
            }
            
            checklist.value = await window.electronAPI.loadChecklist(specialty.value);
            checklistLoaded.value = true;
            await loadEvidence(sessionData);
            toast.success("Checklist and session loaded");
        } catch (error) {
            toast.error(error.message); // Or use toast notification
            checklistLoaded.value = false;
        }
    };
    
    const loadEvidence = async (sessionObj) => {
        const efiles = await window.electronAPI.readEvidence();
        let eFilesObject = {};
        evidenceFiles.value = {};
        efiles.forEach( (x) => { evidenceFiles.value[x.name] = {};
                                 evidenceFiles.value[x.name]["URL"]= x.URL;
                                 evidenceFiles.value[x.name]["count"] = 0;
                               });
        updateEvidenceCount(sessionObj);

    }; 
    const updateEvidenceCount = (obj) => {
        if (obj !== null) {
            if (typeof obj === 'object') {
              if (Array.isArray(obj)) {
                obj.forEach( (x) => {
                  if (evidenceFiles.value[x] === undefined) {
                    evidenceFiles.value[x] = {};
                    evidenceFiles.value[x]["URL"]= "";
                    evidenceFiles.value[x]["count"] = 1;
                  }
                  else {
                    evidenceFiles.value[x]["count"]++;
                  }
                });
              }
              else {
                Object.values(obj).forEach( (value) => {
                  updateEvidenceCount(value);
                });
              }
            }
        } 
        return 0;
    }
 
    const updateSession = (rowId, checklistId, field, value) => {
        if (!sessionData[rowId]) sessionData[rowId] = {};
        sessionData[rowId][field] = value;
        sessionData[rowId]["id"] = checklistId;
        autoSave();
    };
    const autoSave = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            sessionSummary.value["lastUpdated"] = new Date().toISOString();
            const sessionObj = {"summary" : sessionSummary.value, "responses" : sessionData};
            window.electronAPI.saveSession(JSON.stringify(sessionObj, null, 2));
        }, 1000);
    };
    const showConfirm = (titulo, explanation, accion) => {
        tituloModal.value = titulo;
        explanationModal.value = explanation;
        accionModal.value = accion;
        showModal.value = true;
    };
    const confirmModal = () => {
        showModal.value = false;
        switch(tituloModal.value) {
          case modalFinalizeTitle: {
            finalize();
            toast.success(finalizeSuccess);
            break;
          }
          case modalCreateDPTitle: {
            es.createDefaultPath();
            toast.success(createDPSuccess);
            break;
          }
          default: {
            break;          
          }
        }
    };
    const showConfirmDefaultPath = () => {
      showConfirm(modalCreateDPTitle, modalCreateDPExplanation, modalCreateDPAction);
    }
    
    const finalize = () => {
        sessionSummary.value["finalized"] = true;
        autoSave();
    };
    return {
        specialty,
        checklist,
        checklistLoaded,
        currentPath,
        evidenceFiles,
        sessionData,
        sessionSummary,
        showModal,
        tituloModal,
        explanationModal,
        accionModal,
        loadChecklistAndSession,
        updateSession,
        showConfirm,
        showConfirmDefaultPath,
        confirmModal,
        finalize
    };
});