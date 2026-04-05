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
  const summary = ref({ finalized: true, generalComments: '' })
  const context = ref({ specialty: '', locationId: null })

  // Actions
  const loadSession = async (specialty, locationId = null) => {
    // initialize state
    // reset summary (no location)
    summary.value.finalized = true
    summary.value.generalComments = '' // ensure default

    // clear out evidenceFiles
    evidence.reset()

    // clear out audioFiles
    audio.reset()

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
      let sessionRead = await fs.loadSession(specialty, locationId)
      if (sessionRead !== null) {
        // can't assign session object directly;  use JSON.parse
        JSON.parse(JSON.stringify(sessionRead), (key, value) => {
          if (key.match('[0-9]+') && typeof value == 'object') {
            responses[key] = value
          } else {
            if (key == 'summary') {
              // assign session summary (expect no location here)
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
      if (locationId) {
        summary.value['locationId'] = locationId
      }
      context.value = { specialty, locationId }

      // prepare evidence: load evidence and update counts with the session data
      await evidence.load(specialty)
      evidence.updateCount(responses)

      // prepare audio: load audio and update counts with the session data
      await audio.load(specialty)
      audio.updateCount(responses)

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

  function displayToast(msg) {
    toast.error(msg)
  }

  const finalize = (specialty, locationId = null) => {
    for (const key of Object.keys(responses)) {
      if (responses[key].compliance != 'Non-compliant') {
        if (responses[key].nonConformity) {
          delete responses[key].nonConformity
        }
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
    loadSession,
    updateSession,
    updateGeneralComments, // <-- exported
    finalize,
  }
})
