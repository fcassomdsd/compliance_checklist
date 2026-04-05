import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { defineStore } from 'pinia'
import { createFileService } from '../utils/fileServices.js'

export const useFollowUpStore = defineStore('followUp', () => {
  const fs = createFileService()
  const toast = useToast()

  const responses = reactive({})
  const summary = ref({ finalized: true, generalComments: '' })
  const context = ref({ specialty: '', locationId: null })

  const reset = () => {
    summary.value = { finalized: true, generalComments: '' }
    for (const key of Object.keys(responses)) {
      delete responses[key]
    }
  }

  const loadFollowUpSession = async (specialty, locationId = null) => {
    reset()

    try {
      if (typeof specialty != 'string' || specialty.length == 0) {
        throw new Error('Invalid specialty value: ' + specialty)
      }

      if (specialty == 'NONE') {
        return
      }

      const loaded = await fs.loadFollowUpSession(specialty, locationId)
      if (loaded !== null) {
        JSON.parse(JSON.stringify(loaded), (key, value) => {
          if (typeof value == 'object' && value && key.match('^[A-Za-z0-9_-]+$')) {
            responses[key] = value
          }
          if (key == 'summary') {
            summary.value = value
          }
          return value
        })
      } else {
        summary.value.finalized = false
      }

      if (!summary.value.specialty) {
        summary.value.specialty = specialty
      }
      if (locationId) {
        summary.value.locationId = locationId
      }
      context.value = { specialty, locationId }

      fs.saveFollowUpSession(summary.value, responses, displayToast, context.value.locationId)

      if (loaded !== null) {
        toast.success('Follow-up session loaded')
      } else {
        toast.info('New follow-up session created')
      }
    } catch (error) {
      summary.value.finalized = true
      toast.error('Could not create follow-up session: ' + error.message)
    }
  }

  const updateFollowUp = (findingId, field, value) => {
    if (!responses[findingId]) {
      responses[findingId] = {}
    }
    responses[findingId][field] = value
    responses[findingId].findingId = findingId

    fs.saveFollowUpSession(summary.value, responses, displayToast, context.value.locationId)
    fs.markWorkspaceTouched(summary.value.specialty, context.value.locationId, 'followUpTouched').catch((error) => {
      toast.error('Could not update workspace touched state: ' + error.message)
    })
  }

  const finalize = () => {
    summary.value.finalized = true
    fs.saveFollowUpSession(summary.value, responses, displayToast, context.value.locationId)
  }

  function displayToast(msg) {
    toast.error(msg)
  }

  return {
    responses,
    summary,
    context,
    reset,
    loadFollowUpSession,
    updateFollowUp,
    finalize,
  }
})
