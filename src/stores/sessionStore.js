import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { defineStore } from 'pinia'
import { createFileService } from '../fileServices.js'
import { useEvidenceStore } from './evidenceStore.js'

export const useSessionStore = defineStore('session', () => {
  const fs = createFileService()
  const evidence = useEvidenceStore()
  const toast = useToast()

  // State
  const responses = reactive({})
  const summary = ref({ location: '', finalized: true })

  // Actions
  const loadSession = async (specialty) => {
    // initialize state
    summary.value.location = ''
    summary.value.finalized = true

    // clear out evidenceFiles
    evidence.reset()

    // clear out session data
    for (const key of Object.keys(responses)) {
      delete responses[key]
    }

    try {
      if (typeof specialty != 'string' || specialty.length == 0) {
        throw new Error('Invalid specialty value: ' + specialty)
      }

      if (specialty == 'NONE') {
        return
      }

      // load session, if exists
      let sessionRead = await fs.loadSession(specialty)
      if (sessionRead !== null) {
        // can't assign session object directly;  use JSON.parse
        JSON.parse(JSON.stringify(sessionRead), (key, value) => {
          if (key.match('[0-9]+') && typeof value == 'object') {
            responses[key] = value
          } else {
            if (key == 'summary') {
              summary.value = value
            }
          }
          return value
        })
      } else {
        summary.value.finalized = false
      }
      if (!summary.value['specialty']) {
        summary.value['specialty'] = specialty
      }

      // prepare evidence: load evidence and update counts with the session data
      await evidence.load(specialty)
      evidence.updateCount(responses)

      if (!summary.value['finalized']) {
        summary.value['finalized'] = false
      }

      for (const key of Object.keys(responses)) {
        if (responses[key].compliance != 'Non-compliant') {
          if (responses[key].nonConformity) {
            delete responses[key].nonConformity
          }
        }
      }

      fs.saveSession(summary.value, responses, displayToast)

      if (sessionRead !== null) {
        toast.success('Session loaded')
      } else {
        toast.info('New session created')
      }
    } catch (error) {
      summary.value.finalized = true
      toast.error('Could not create session:' + error.message)
    }
  }

  const updateSession = (rowId, checklistId, field, value) => {
    if (!responses[rowId]) responses[rowId] = {}
    responses[rowId][field] = value
    responses[rowId]['id'] = checklistId
    fs.saveSession(summary.value, responses, displayToast)
  }

  function displayToast(msg) {
    toast.error(msg)
  }

  const finalize = () => {
    for (const key of Object.keys(responses)) {
      if (responses[key].compliance != 'Non-compliant') {
        if (responses[key].nonConformity) {
          delete responses[key].nonConformity
        }
      }
    }

    summary.value['finalized'] = true
    fs.saveSession(summary.value, responses, displayToast)
  }

  return {
    responses,
    summary,
    loadSession,
    updateSession,
    finalize,
  }
})
