import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { defineStore } from 'pinia'
import { createFileService } from '../utils/fileServices.js'
import { useEvidenceStore } from './evidenceStore.js'
import { useAudioStore } from './audioStore.js'

export const useSessionStore = defineStore('session', () => {
  const fs = createFileService()
  const evidence = useEvidenceStore()
  const audio = useAudioStore()
  const toast = useToast()

  // State
  const responses = reactive({})
  // session summary: no longer holds location (moved to checklist.json)
  const summary = ref({ finalized: true, generalComments: '', interviewee: '' })
  const context = ref({ specialty: '', locationId: null })

  const reset = (finalized = true) => {
    summary.value = { finalized, generalComments: '', interviewee: '' }
    context.value = { specialty: '', locationId: null }

    evidence.reset()
    audio.reset()

    for (const key of Object.keys(responses)) {
      delete responses[key]
    }
  }

  // Actions
  const loadSession = async (specialty, locationId = null) => {
    reset(true)

    try {
      if (typeof specialty != 'string' || specialty.length == 0) {
        throw new Error('Invalid specialty value: ' + specialty)
      }

      if (specialty == 'NONE') {
        return
      }

      // load session, if exists
      let sessionRead = await fs.loadSession(specialty, locationId)
      if (sessionRead !== null) {
        // assign session summary and responses
        summary.value = { ...(sessionRead.summary || {}) }
        const loadedResponses = sessionRead.responses || {}
        for (const [responseKey, responseValue] of Object.entries(loadedResponses)) {
          if (responseValue && typeof responseValue == 'object') {
            responses[responseKey] = JSON.parse(JSON.stringify(responseValue))
          }
        }
      } else {
        summary.value.finalized = false
      }

      // Always bind the session summary to the active workspace.
      // This prevents saving under a previous specialty/location after workspace switch.
      summary.value['specialty'] = specialty
      if (locationId) {
        summary.value['locationId'] = locationId
      } else if ('locationId' in summary.value) {
        delete summary.value['locationId']
      }
      if (!('generalComments' in summary.value)) {
        summary.value.generalComments = ''
      }
      if (!('interviewee' in summary.value)) {
        summary.value.interviewee = ''
      }
      context.value = { specialty, locationId }

      // prepare evidence: load evidence and update counts with the session data
      await evidence.load(specialty, locationId, 'inspection')
      evidence.updateCount(responses)

      // prepare audio: load audio and update counts with the session data
      await audio.load(specialty, locationId)
      audio.updateCount(responses)

      if (!summary.value['finalized']) {
        summary.value['finalized'] = false
      }

      for (const key of Object.keys(responses)) {
        if (responses[key].compliance != 'Non-Compliant') {
          if (responses[key].nonConformityDetails) {
            delete responses[key].nonConformityDetails
          }
        }
      }

      fs.saveSession(summary.value, responses, displayToast, locationId)

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

  const updateSession = (responseKey, checklistId, field, value, questionCode) => {
    if (!responses[responseKey]) responses[responseKey] = {}
    responses[responseKey][field] = value
    responses[responseKey]['id'] = checklistId
    if (questionCode) {
      responses[responseKey]['code'] = questionCode
    }
    fs.saveSession(summary.value, responses, displayToast, context.value.locationId)
    fs.markWorkspaceTouched(summary.value.specialty, context.value.locationId).catch((error) => {
      toast.error('Could not update workspace touched state: ' + error.message)
    })
  }

  // New: update general comments stored in summary and save
  const updateGeneralComments = (comments) => {
    summary.value.generalComments = comments || ''
    fs.saveSession(summary.value, responses, displayToast, context.value.locationId)
    fs.markWorkspaceTouched(summary.value.specialty, context.value.locationId).catch((error) => {
      toast.error('Could not update workspace touched state: ' + error.message)
    })
  }

  const updateInterviewee = (value) => {
    summary.value.interviewee = value || ''
    fs.saveSession(summary.value, responses, displayToast, context.value.locationId)
    fs.markWorkspaceTouched(summary.value.specialty, context.value.locationId).catch((error) => {
      toast.error('Could not update workspace touched state: ' + error.message)
    })
  }

  function displayToast(msg) {
    toast.error(msg)
  }

  const finalize = async (specialty, locationId = null) => {
    for (const key of Object.keys(responses)) {
      if (responses[key].compliance != 'Non-Compliant') {
        if (responses[key].nonConformityDetails) {
          delete responses[key].nonConformityDetails
        }
      }
    }

    for (const key of Object.keys(responses)) {
      if (responses[key].evidence) {
        const newEvidence = await fs.hashEvidence("inspection", responses[key].evidence, specialty, locationId)
        responses[key].evidence = newEvidence
      }
    }    

    summary.value['finalized'] = true
    if (specialty && !summary.value['specialty']) {
      summary.value['specialty'] = specialty
    }
    if (locationId) {
      summary.value['locationId'] = locationId
    }
    context.value = { specialty: summary.value['specialty'], locationId: locationId || null }
    fs.saveSession(summary.value, responses, displayToast, context.value.locationId)
  }

  return {
    responses,
    summary,
    context,
    reset,
    loadSession,
    updateSession,
    updateGeneralComments,
    updateInterviewee,
    finalize,
  }
})
