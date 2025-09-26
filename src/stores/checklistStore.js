import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useToast } from 'vue-toastification';
import { createFileService } from '../fileServices.js';
import { useSessionStore } from './sessionStore.js';

export const useChecklistStore = defineStore('checklist', () => {
  const toast = useToast();
  const fs = createFileService();
  const sessionStore = useSessionStore();

    // State
    const specialty = ref('NONE');
    const checklist = ref(null);
    const checklistLoaded = ref(false);
    const currentPath = ref('');
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
    const loadChecklist = async () => {
        // initialize state
        checklist.value = null;
        checklistLoaded.value = false;
            
        try {

          if (specialty.value != "NONE") {
            // load checklist
            checklist.value = await fs.loadChecklist(specialty.value);
            checklistLoaded.value = true;
            
            currentPath.value = await fs.setSavePath(specialty.value);
            toast.success("Checklist loaded");
          }
        } catch (error) {
            toast.error(error.message);
            checklistLoaded.value = false;
        }
        return checklistLoaded.value;
    };
    
   
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
            sessionStore.finalize(specialty.value);
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
        const validCompliance = ["Non-compliant"];
        const validQuestions = checklist.value.questions.entries();       
        for (const [index, row] of validQuestions) {
          if ( (sessionStore.responses[index+1] !== undefined) && validCompliance.includes(sessionStore.responses[index+1].compliance)) {
            if (prevTopic != row.topic) {
              out.push(row.topic);
            } 
            prevTopic = row.topic;
            const qnumber = index + 1;
            const session = sessionStore.responses[qnumber] || {};
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
        showModal,
        tituloModal,
        explanationModal,
        accionModal,
        loadChecklist,
        showFinalize,
        checkDefaultPath,
        confirmModal,
        exportChecklist
    };
});