import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../utils/fileServices.js'
import { useSessionStore } from './sessionStore.js'

export const useChecklistStore = defineStore('checklist', () => {
  const toast = useToast()
  const fs = createFileService()
  const sessionStore = useSessionStore()

  // State
  const specialty = ref('NONE')
  const checklist = ref(null)
  const checklistLoaded = ref(false)
  const currentPath = ref('')
  const showModal = ref(false)
  const tituloModal = ref('')
  const explanationModal = ref('')
  const accionModal = ref('')
  const generatedReportPath = ref('')

  // modal window data
  const modalFinalizeTitle = 'Finalize Checklist'
  const modalFinalizeExplanation =
    'Finalizing the checklist will prevent further changes, and cannot be undone'
  const modalFinalizeAction = 'finalize the current checklist'
  const finalizeSuccess = 'Checklist finalized successfully!'

  const modalCreateDPTitle = 'Create default path'
  const modalCreateDPExplanation =
    'The default path for inspection data does not exist.  I can create it for you.'
  const modalCreateDPAction = 'create the default path'
  const createDPSuccess = 'Default path created successfully!'

  // specialty data - will be loaded from file
  const specialtyList = ref([])

<<<<<<< HEAD
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
=======
  // Actions
  const loadSpecialties = async () => {
    try {
      specialtyList.value = await fs.loadSpecialties()
    } catch (error) {
      toast.error(`Failed to load specialties: ${error.message}`)
      // Provide empty array fallback
      specialtyList.value = []
    }
  }

  const loadChecklist = async () => {
    // initialize state
    checklist.value = null
    checklistLoaded.value = false

    try {
      if (specialty.value != 'NONE') {
        // load checklist
        checklist.value = await fs.loadChecklist(specialty.value)
        checklistLoaded.value = true

        currentPath.value = await fs.setSavePath(specialty.value)
        toast.success('Checklist loaded')
>>>>>>> develop
      }
    } catch (error) {
      toast.error(error.message)
      checklistLoaded.value = false
    }
<<<<<<< HEAD
    
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
=======
    return checklistLoaded.value
  }

  const showFinalize = () => {
    tituloModal.value = modalFinalizeTitle
    explanationModal.value = modalFinalizeExplanation
    accionModal.value = modalFinalizeAction
    showModal.value = true
  }
  const confirmModal = async () => {
    try {
      showModal.value = false
      switch (tituloModal.value) {
        case modalFinalizeTitle: {
          sessionStore.finalize(specialty.value)
          toast.success(finalizeSuccess)
          break
        }
        case modalCreateDPTitle: {
          // Call the IPC handler to create the default root with user.config.json
          await fs.createDefaultRoot()
          // Reload specialties after creating the default root
          await loadSpecialties()
          toast.success(createDPSuccess)
          break
        }
        default: {
          break
        }
      }
    } catch (error) {
      console.log(error)
      toast.error(`Error in ${tituloModal.value} : ${error.message}`)
    }
  }
  const checkDefaultPath = async () => {
    try {
      if (!(await fs.defaultPathExists())) {
        tituloModal.value = modalCreateDPTitle
        explanationModal.value = modalCreateDPExplanation
        accionModal.value = modalCreateDPAction
        showModal.value = true
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const exportChecklist = async () => {
    try {
      if (checklist.value.questions.length == 0) {
        throw new Error('Empty checklist not exported')
      }

      // Generate PDF report of findings
      const sessionObj = { summary: sessionStore.summary, responses: sessionStore.responses }
      const reportPath = await fs.saveFindingsReport(checklist.value, sessionObj, specialty.value)
      generatedReportPath.value = reportPath
      toast.success('Report generated successfully')
    } catch (error) {
      generatedReportPath.value = ''
      toast.error(error.message)
    }
  }

  const viewGeneratedReport = async () => {
    try {
      if (!generatedReportPath.value) {
        throw new Error('No report has been generated yet')
      }
      await window.electronAPI.openFile(generatedReportPath.value)
    } catch (error) {
      toast.error('Could not open report: ' + error.message)
    }
  }

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
    generatedReportPath,
    loadChecklist,
    loadSpecialties,
    showFinalize,
    checkDefaultPath,
    confirmModal,
    exportChecklist,
    viewGeneratedReport,
  }
})
>>>>>>> develop
