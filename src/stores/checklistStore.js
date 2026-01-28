import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { createFileService } from '../fileServices.js'
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
      }
    } catch (error) {
      toast.error(error.message)
      checklistLoaded.value = false
    }
    return checklistLoaded.value
  }

  const showFinalize = () => {
    tituloModal.value = modalFinalizeTitle
    explanationModal.value = modalFinalizeExplanation
    accionModal.value = modalFinalizeAction
    showModal.value = true
  }
  const confirmModal = () => {
    try {
      showModal.value = false
      switch (tituloModal.value) {
        case modalFinalizeTitle: {
          sessionStore.finalize(specialty.value)
          toast.success(finalizeSuccess)
          break
        }
        case modalCreateDPTitle: {
          specialtyList.value.forEach((x) => fs.createDefaultPath(x.code))
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
