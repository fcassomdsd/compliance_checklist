import { ref, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { defineStore } from 'pinia'
import { createFileService } from '../utils/fileServices.js'
import { useEvidenceStore } from './evidenceStore.js'
import i18n from '../i18n/index.js'

const t = (key, params) => i18n.global.t(key, params)

export const useFollowUpStore = defineStore('followUp', () => {
  const fs = createFileService()
  const evidence = useEvidenceStore()
  const toast = useToast()

  const responses = reactive({})
  const summary = ref({ finalized: true, generalComments: '' })
  const context = ref({ specialty: '', locationId: null })

  const reset = (finalized = true) => {
    summary.value = { finalized, generalComments: '' }
    evidence.reset()
    for (const key of Object.keys(responses)) {
      delete responses[key]
    }
  }

  const normalizeSummary = (rawSummary, specialty, locationId) => {
    const nextSummary = {
      finalized: Boolean(rawSummary?.finalized),
      generalComments: typeof rawSummary?.generalComments == 'string' ? rawSummary.generalComments : '',
      specialty,
    }

    if (locationId) {
      nextSummary.locationId = locationId
    }

    if (typeof rawSummary?.lastUpdated == 'string') {
      nextSummary.lastUpdated = rawSummary.lastUpdated
    }

    return nextSummary
  }

  const normalizeResponse = (findingId, rawEntry) => {
    const allowedFollowUpTypes = [
      'Progress Verification',
      'Progress Review',
      'CAP Verification',
      'Closure Verification',
      'Ad-hoc Inquiry',
    ]

    const nextEntry = {
      findingId:
        typeof rawEntry?.findingId == 'string' && rawEntry.findingId.length > 0
          ? rawEntry.findingId
          : findingId,
      percentComplete: Number.isFinite(Number(rawEntry?.percentComplete))
        ? Math.max(0, Math.min(100, Number(rawEntry.percentComplete)))
        : 0,
      followUpType: allowedFollowUpTypes.includes(rawEntry?.followUpType)
        ? rawEntry.followUpType
        : 'Progress Verification',
      effectivenessConfirmed:
        rawEntry?.followUpType === 'Closure Verification'
          ? (typeof rawEntry?.effectivenessConfirmed === 'boolean' ? rawEntry.effectivenessConfirmed : null)
          : null,
    }

    if (typeof rawEntry?.comments == 'string') {
      nextEntry.comments = rawEntry.comments
    }

    if (Array.isArray(rawEntry?.evidence)) {
      nextEntry.evidence = rawEntry.evidence
        .filter((item) => item && typeof item == 'object' && typeof item.name == 'string')
        .map((item) => ({
          name: item.name,
          hashValue: typeof item.hashValue == 'string' ? item.hashValue : '',
          immutable: item.immutable === true,
          sealedDate: typeof item.sealedDate == 'string' ? item.sealedDate : '',
        }))
    }

    if (typeof rawEntry?.closureVerificationMethod == 'string') {
      nextEntry.closureVerificationMethod = rawEntry.closureVerificationMethod
    }

    if (typeof rawEntry?.followUpDate == 'string') {
      nextEntry.followUpDate = rawEntry.followUpDate
    }

    if (typeof rawEntry?.followUpClosureDate == 'string') {
      nextEntry.followUpClosureDate = rawEntry.followUpClosureDate
    }

    return nextEntry
  }

  const collectResponses = (rawResponses, target) => {
    if (!rawResponses || typeof rawResponses != 'object') {
      return
    }

    for (const [key, value] of Object.entries(rawResponses)) {
      if (key == 'summary') {
        continue
      }

      if (key == 'responses') {
        collectResponses(value, target)
        continue
      }

      if (!value || typeof value != 'object') {
        continue
      }

      target[key] = normalizeResponse(key, value)
    }
  }

  const loadFollowUpSession = async (specialty, locationId = null) => {
    reset(true)

    try {
      if (typeof specialty != 'string' || specialty.length == 0) {
        throw new Error('Invalid specialty value: ' + specialty)
      }

      if (specialty == 'NONE') {
        return
      }

      const loaded = await fs.loadFollowUpSession(specialty, locationId)
      if (loaded !== null) {
        summary.value = normalizeSummary(loaded?.summary, specialty, locationId)
        const normalizedResponses = {}
        collectResponses(loaded?.responses, normalizedResponses)
        for (const [findingId, entry] of Object.entries(normalizedResponses)) {
          responses[findingId] = entry
        }
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

      await evidence.load(specialty, locationId, 'followUp')
      evidence.updateCount(responses)

      fs.saveFollowUpSession(summary.value, responses, displayToast, context.value.locationId)

      if (loaded !== null) {
        toast.success(t('toast.followUpSessionLoaded'))
      } else {
        toast.info(t('toast.newFollowUpSessionCreated'))
      }
    } catch (error) {
      summary.value.finalized = true
      toast.error(t('toast.createFollowUpSessionFailed', { message: error.message }))
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
      toast.error(t('toast.workspaceTouchedFailed', { message: error.message }))
    })
  }

  const finalize = async () => {
    for (const key of Object.keys(responses)) {
      if (responses[key].evidence) {
        const newEvidence = await fs.hashEvidence(
          'followUp',
          responses[key].evidence,
          summary.value.specialty,
          context.value.locationId
        )
        responses[key].evidence = newEvidence
      }
    }

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
