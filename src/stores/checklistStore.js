import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { useToast } from 'vue-toastification';
import { createFileService } from '../fileServices.js';
import { useEvidenceStore } from './evidenceStore.js';

export const useChecklistStore = defineStore('checklist', () => {
  const toast = useToast();
  const fs = createFileService();
  const evidence = useEvidenceStore();

    // State
    const specialty = ref('NONE');
    const checklist = ref(null);
    const checklistLoaded = ref(false);
    const currentPath = ref('');
//    const evidenceFiles = ref([]);
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
    
    // specialty data
    const specialtyList = [
      { "code" : "VIG", "name" : "Vigilancia Radar" },
      { "code" : "COM", "name" : "Comunicaciones de Radio" },
      { "code" : "RNA", "name" : "Radioayudas" },
      { "code" : "EEM", "name" : "Energia y Equipos MET" }
    ]   
    
    
    // Actions
    const loadChecklistAndSession = async () => {
        // initialize state
        checklist.value = null;
        checklistLoaded.value = false;
        sessionSummary.value.location = "";
        sessionSummary.value.finalized = true;
        // clear out evidenceFiles
        evidence.reset();
            
        // clear out session data
        for (const key of Object.keys(sessionData)) {
          delete sessionData[key];            
        }
        if (specialty.value == "NONE") {
            return;
        } 
        try {
            // load checklist
            checklist.value = await fs.loadChecklist(specialty.value);
            checklistLoaded.value = true;

            // load session, if exists
            let sessionRead = await fs.loadSession(specialty.value);
            if (sessionRead !== null) {
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
            }
            if (!sessionSummary.value["specialty"]) {
              sessionSummary.value["specialty"] = specialty.value;
            }

            // prepare evidence: load evidence and update counts with the session data
            await evidence.load(specialty.value);
            evidence.updateCount(sessionData);

            if (!sessionSummary.value['finalized']) {
              sessionSummary.value["finalized"] = false;
            }
            currentPath.value = await fs.setSavePath(specialty.value);
            fs.saveSession(
              specialty.value,
              sessionSummary.value,
              sessionData,
              displayToast);
            toast.success("Checklist and session loaded");
        } catch (error) {
            toast.error(error.message); // Or use toast notification
            checklistLoaded.value = false;
        }
    };
    
    const updateSession = (rowId, checklistId, field, value) => {
        if (!sessionData[rowId]) sessionData[rowId] = {};
        sessionData[rowId][field] = value;
        sessionData[rowId]["id"] = checklistId;
        fs.saveSession(specialty.value, sessionSummary.value, sessionData, displayToast);
    };
    
    function displayToast(msg) {
      toast.error(msg);
    }
    
    const showFinalize = () => {
        tituloModal.value = modalFinalizeTitle;
        explanationModal.value = modalFinalizeExplanation;
        accionModal.value = modalFinalizeAction;
        showModal.value = true;
    };
    const confirmModal = () => {
       try {
        showModal.value = false;
        switch(tituloModal.value) {
          case modalFinalizeTitle: {
            finalize();
            toast.success(finalizeSuccess);
            break;
          }
          case modalCreateDPTitle: {
            specialtyList.forEach( (x) => fs.createDefaultPath(x.code));            
            toast.success(createDPSuccess);
            break;
          }
          default: {
            break;          
          }
        }
      } catch (error) {
        console.log(error);
        toast.error(`Error in ${tituloModal.value} : ${error.message}`);
      }
    };
    const checkDefaultPath = async () => {
      try {
        if (!await fs.defaultPathExists()) {
          tituloModal.value = modalCreateDPTitle;
          explanationModal.value = modalCreateDPExplanation;
          accionModal.value = modalCreateDPAction;
          showModal.value = true;
        }  
      } catch (error) {
        toast.error(error.message);  
      }
    }
    
    const finalize = () => {
        sessionSummary.value["finalized"] = true;
        fs.saveSession(specialty.value, sessionSummary.value, sessionData, displayToast);
    }; 
    
    const exportChecklist = async () => {

      try {
        const out = [];

        const makeLine = (val) => {
          let rawLine = (val || '');

          rawLine = rawLine.toString().replaceAll(/\n/gm, '<br>');
          rawLine = rawLine.toString().replaceAll('"', '""');

          return rawLine;        
        }        

        if (checklist.value.questions.length == 0) {
          throw new Error("Empty checklist not exported");        
        }

        let prevTopic = '';
        const validCompliance = ["Non-compliant","Partial Compliance"];
        const validQuestions = checklist.value.questions.entries();       
        for (const [index, row] of validQuestions) {
          if ( (sessionData[index+1] !== undefined) && validCompliance.includes(sessionData[index+1].compliance)) {
            if (prevTopic != row.topic) {
              out.push(row.topic);
            } 
            prevTopic = row.topic;
            const qnumber = index + 1;
            const session = sessionData[qnumber] || {};
            const line = [
              qnumber,
              '"' + makeLine(row.reference) + '"',
              '"' + makeLine(row.question) + '"',
              '"' + makeLine((session.compliance || '')) + '"',
              '"' + makeLine((session.comments || '')) + '"'
            ];
            out.push(line.join('|'));
          }
        }

        const csvContent = out.join('\n');
        await fs.saveExportFile(csvContent, specialty.value);
        toast.success('Checklist exported');
      } catch (error) {
        toast.error(error.message);
      }

    };           
    
    return {
        specialty,
        specialtyList,
        checklist,
        checklistLoaded,
        currentPath,
        sessionData,
        sessionSummary,
        showModal,
        tituloModal,
        explanationModal,
        accionModal,
        loadChecklistAndSession,
        updateSession,
        showFinalize,
        checkDefaultPath,
        confirmModal,
        exportChecklist,
        finalize
    };
});