<template>
  <table id="followupTable" class="followupTable">
    <colgroup>
      <col style="width: 14%" />
      <col style="width: 22%" />
      <col style="width: 10%" />
      <col style="width: 14%" />
      <col style="width: 14%" />
      <col style="width: 10%" />
      <col style="width: 16%" />
    </colgroup>
    <thead>
      <tr>
        <th>{{ t('followUpTable.findingId') }}</th>
        <th>{{ t('followUpTable.description') }}</th>
        <th>{{ t('followUpTable.percentComplete') }}</th>
        <th>{{ t('followUpTable.followUpType') }}</th>
        <th>{{ t('followUpTable.effectivenessConfirmed') }}</th>
        <th>{{ t('followUpTable.residualRisk') }}</th>
        <th>{{ t('followUpTable.followUpComment') }}</th>
        <th>{{ t('followUpTable.evidence') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="entry in store.findings" :key="entry?.findingId || Math.random()">
        <td>
          <div class="finding-id-cell">
            <span class="status-dot" :style="{ backgroundColor: findingDotColor(entry) }"></span>
            <span>{{ entry?.findingId || '' }}</span>
          </div>
          <button
            v-if="hasCorrectiveAction(entry)"
            type="button"
            class="cap-badge"
            :disabled="!getCorrectiveAction(entry)"
            @click="openCapModal(entry)"
          >
            {{ t('followUpTable.capBadge') }}
            <span class="status-dot cap-dot" :style="{ backgroundColor: capDotColor(entry) }"></span>
          </button>
        </td>
        <td>{{ entry?.description || '' }}</td>
        <td>
          <input
            type="number"
            min="0"
            max="100"
            :disabled="isRowReadOnly(entry)"
            :value="getField(entry, 'percentComplete')"
            @input="onFieldChange(entry, 'percentComplete', Number($event.target.value))"
          />
        </td>
        <td>
          <select
            :disabled="isRowReadOnly(entry)"
            :value="getField(entry, 'followUpType')"
            @change="onFieldChange(entry, 'followUpType', $event.target.value)"
          >
            <option value="Progress Review">{{ t('followUpType.progressReview') }}</option>
            <option v-if="hasCorrectiveAction(entry)" value="CAP Verification">{{ t('followUpType.capVerification') }}</option>
            <option value="Closure Verification">{{ t('followUpType.closureVerification') }}</option>
          </select>
        </td>
        <td>
          <template v-if="getField(entry, 'followUpType') === CLOSURE_FOLLOW_UP_TYPE">
            <select
              :disabled="isRowReadOnly(entry)"
              :value="effectivenessValue(getField(entry, 'effectivenessConfirmed'))"
              @change="onFieldChange(entry, 'effectivenessConfirmed', parseEffectiveness($event.target.value))"
            >
              <option :value="null">{{ t('followUpTable.unset') }}</option>
              <option :value="true">{{ t('followUpTable.yes') }}</option>
              <option :value="false">{{ t('followUpTable.no') }}</option>
            </select>
          </template>
          <template v-else>
            <span style="color: #888">{{ t('followUpTable.notApplicable') }}</span>
          </template>
        </td>
        <td>
          <select
            :disabled="isRowReadOnly(entry)"
            :value="getField(entry, 'currentResidualRisk')"
            @change="onFieldChange(entry, 'currentResidualRisk', $event.target.value)"
          >
            <option value="Low">{{ t('riskLevel.low') }}</option>
            <option value="Medium">{{ t('riskLevel.medium') }}</option>
            <option value="High">{{ t('riskLevel.high') }}</option>
            <option value="Critical">{{ t('riskLevel.critical') }}</option>
          </select>
        </td>
        <td>
          <textarea
            :disabled="isRowReadOnly(entry)"
            :value="getField(entry, 'comments')"
            @input="onFieldChange(entry, 'comments', $event.target.value)"
            :placeholder="t('followUpTable.commentPlaceholder')"
            rows="3"
          ></textarea>
        </td>
        <td class="evidence-cell">
          <div class="evidence-controls">
            <input
              :id="`followup-file-input-${toDomId(getFindingId(entry))}`"
              type="file"
              hidden
              multiple
              :disabled="isRowReadOnly(entry)"
              @change="onEvidenceChange(entry, $event)"
            />
            <button
              type="button"
              :disabled="isRowReadOnly(entry)"
              @click="triggerEvidenceUpload(getFindingId(entry))"
            >
              {{ t('followUpTable.addEvidence') }}
            </button>
          </div>
          <ul v-if="getEvidenceList(entry).length > 0" class="evidence-list">
            <li v-for="(evidence, evidenceIndex) in getEvidenceList(entry)" :key="evidenceName(evidence) + evidenceIndex">
              <input
                type="image"
                :src="trash"
                height="15"
                width="15"
                :disabled="isRowReadOnly(entry)"
                @click="removeEvidence(entry, evidenceIndex, evidenceName(evidence))"
              />
              <a :href="evidenceStore.files[evidenceName(evidence)]?.URL" download target="_blank">
                {{ evidenceName(evidence) }}
              </a>
              <span v-if="evidence.evidenceRole" class="evidence-role">({{ evidence.evidenceRole }})</span>
            </li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>

  <div v-if="showCapModal" class="modal-overlay">
    <div class="modal-container cap-modal">
      <h2>{{ t('followUpTable.capModalTitle') }}</h2>
      <div class="cap-modal-grid">
        <div><strong>{{ t('followUpTable.capId') }}</strong> {{ activeCap?.capId || t('followUpTable.notAvailableShort') }}</div>
        <div><strong>{{ t('followUpTable.proposedAction') }}</strong> {{ activeCap?.proposedAction || t('followUpTable.notAvailableShort') }}</div>
        <div><strong>{{ t('followUpTable.responsibleEntity') }}</strong> {{ activeCap?.responsibleEntity || t('followUpTable.notAvailableShort') }}</div>
        <div><strong>{{ t('followUpTable.dueDate') }}</strong> {{ activeCap?.dueDate || t('followUpTable.notAvailableShort') }}</div>
        <div><strong>{{ t('followUpTable.acceptanceStatus') }}</strong> {{ activeCap?.acceptanceStatus || t('followUpTable.notAvailableShort') }}</div>
      </div>
      <div class="modal-actions">
        <button type="button" @click="closeCapModal">{{ t('followUpTable.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useToast } from 'vue-toastification'
  import { useChecklistStore } from '../stores/checklistStore'
  import { useFollowUpStore } from '../stores/followUpStore'
  import { useEvidenceStore } from '../stores/evidenceStore'
  import { CLOSURE_FOLLOW_UP_TYPE, DEFAULT_FOLLOW_UP_TYPE } from '../utils/domainRules.js'
  import trash from '../assets/images/trash.png'

  const { t } = useI18n()
  const store = useChecklistStore()
  const followUpStore = useFollowUpStore()
  const evidenceStore = useEvidenceStore()
  const toast = useToast()
  const showCapModal = ref(false)
  const activeCap = ref(null)
  const importOverdueLock = ref({})

  const MILLIS_PER_DAY = 24 * 60 * 60 * 1000

  const parseDateOnly = (value) => {
    if (typeof value != 'string' || value.trim().length == 0) {
      return null
    }
    const raw = value.trim().slice(0, 10)
    const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!matched) {
      return null
    }
    const year = Number(matched[1])
    const month = Number(matched[2])
    const day = Number(matched[3])
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    return parsed
  }

  const todayStart = () => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }

  const toHex = (value) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)))
    return clamped.toString(16).padStart(2, '0')
  }

  const gradientGreenToRed = (factor) => {
    const t = 2 * (0.5 - factor)
    const red = 255 * (t < 0 ? 1 : 1 - t)
    const green = 255 * (t > 0 ? 1 : 1 + t)
    return `#${toHex(red)}${toHex(green)}00`
  }

  const buildOverdueLock = () => {
    const now = todayStart().getTime()
    const next = {}
    for (const entry of store.findings || []) {
      const findingId = getFindingId(entry)
      if (!findingId) {
        continue
      }
      const resolution = parseDateOnly(entry?.resolutionDeadline)
      next[findingId] = Boolean(resolution && resolution.getTime() < now)
    }
    importOverdueLock.value = next
  }

  const getFindingId = (entry) => entry?.findingId || ''
  const toDomId = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '-')
  const getLocationId = () => followUpStore.context?.locationId || null
  const getCorrectiveAction = (entry) => {
    if (entry?.correctiveAction && typeof entry.correctiveAction == 'object') {
      if (Array.isArray(entry.correctiveAction)) {
        const first = entry.correctiveAction.find((item) => item && typeof item == 'object')
        return first || null
      }
      return entry.correctiveAction
    }
    return null
  }
  const hasCorrectiveAction = (entry) => Boolean(getCorrectiveAction(entry))

  watch(
    () => store.findings,
    () => {
      buildOverdueLock()
    },
    { immediate: true }
  )

  const isRowReadOnly = (entry) => {
    if (followUpStore.summary.finalized) {
      return true
    }
    const findingId = getFindingId(entry)
    return Boolean(importOverdueLock.value[findingId])
  }

  const capDotColor = (entry) => {
    const cap = getCorrectiveAction(entry)
    const dueDate = parseDateOnly(cap?.dueDate)
    if (!dueDate) {
      return '#9ca3af'
    }

    const diffDays = (dueDate.getTime() - todayStart().getTime()) / MILLIS_PER_DAY
    if (diffDays < 0) {
      return '#ef4444'
    }
    if (diffDays <= 0) {
      return '#f97316'
    }
    if (diffDays <= 7) {
      return '#facc15'
    }
    return '#3b82f6'
  }

  const findingDotColor = (entry) => {
    const issueDate = parseDateOnly(entry?.dateIssued)
    const resolutionDeadline = parseDateOnly(entry?.resolutionDeadline)
    if (!issueDate || !resolutionDeadline) {
      return '#9ca3af'
    }

    const now = todayStart().getTime()
    const issue = issueDate.getTime()
    const resolution = resolutionDeadline.getTime()

    if (resolution < now) {
      return '#ef4444'
    }

    if (resolution <= issue) {
      return '#ef4444'
    }

    const progress = (now - issue) / (resolution - issue)
    return gradientGreenToRed(progress)
  }

  const getField = (entry, field) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return ''
    }
    const value = followUpStore.responses[findingId]?.[field]
    if (typeof value != 'undefined') {
      return value
    }
    if (field == 'percentComplete') {
      return 0
    }
    if (field == 'followUpType') {
      return DEFAULT_FOLLOW_UP_TYPE
    }
    if (field == 'effectivenessConfirmed') {
      return null
    }
    if (field == 'currentResidualRisk') {
      return entry?.riskClassification || 'Low'
    }
    return ''
  }

  const resolveStoredFollowUpType = (entry) => {
    const existingType = getField(entry, 'followUpType')
    if (typeof existingType == 'string' && existingType.trim().length > 0) {
      return existingType
    }
    return DEFAULT_FOLLOW_UP_TYPE
  }

  const ensureFollowUpTypeStored = (entry) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return
    }
    const currentType = followUpStore.responses[findingId]?.followUpType
    if (typeof currentType == 'string' && currentType.trim().length > 0) {
      return
    }
    followUpStore.updateFollowUp(findingId, 'followUpType', resolveStoredFollowUpType(entry))
  }

  const onFieldChange = (entry, field, value) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return
    }
    if (field != 'followUpType') {
      ensureFollowUpTypeStored(entry)
    }
    followUpStore.updateFollowUp(findingId, field, value)
  }

  const evidenceName = (entry) =>
    typeof entry == 'string' ? entry : typeof entry?.name == 'string' ? entry.name : ''

  const getEvidenceList = (entry) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return []
    }
    const evidence = followUpStore.responses[findingId]?.evidence
    return Array.isArray(evidence) ? evidence : []
  }

  const triggerEvidenceUpload = (findingId) => {
    if (!findingId) {
      return
    }
    const input = document.getElementById(`followup-file-input-${toDomId(findingId)}`)
    if (input) {
      input.click()
    }
  }

  const openCapModal = (entry) => {
    const cap = getCorrectiveAction(entry)
    if (!cap) {
      return
    }
    activeCap.value = cap
    showCapModal.value = true
  }

  const closeCapModal = () => {
    showCapModal.value = false
    activeCap.value = null
  }

  const onEvidenceChange = async (entry, event) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return
    }

    const files = event?.target?.files
    if (!files || files.length == 0) {
      return
    }

    const evidenceList = [...getEvidenceList(entry)]

    for (const file of files) {
      try {
        await evidenceStore.add(
          followUpStore.summary.specialty,
          file,
          getLocationId(),
          'followUp'
        )

        const alreadyPresent = evidenceList.some((item) => evidenceName(item) == file.name)
        if (alreadyPresent) {
          if (evidenceStore.files[file.name]?.count == 0) {
            evidenceStore.addCount(file.name)
          }
        } else {
          evidenceStore.addCount(file.name)
          evidenceList.push({ name: file.name })
        }
      } catch (error) {
        toast.error(error.message)
      }
    }

    followUpStore.updateFollowUp(findingId, 'evidence', evidenceList)
    event.target.value = ''
  }

  const removeEvidence = async (entry, evidenceIndex, evidenceName) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return
    }

    try {
      await evidenceStore.subtract(
        followUpStore.summary.specialty,
        evidenceName,
        getLocationId(),
        'followUp'
      )
    } catch (error) {
      toast.error(error.message)
    }

    const updatedEvidence = getEvidenceList(entry).filter((_, index) => index != evidenceIndex)
    followUpStore.updateFollowUp(findingId, 'evidence', updatedEvidence)
  }

  const effectivenessValue = (val) => {
    if (val === null || typeof val === 'undefined') return null
    if (val === true) return true
    if (val === false) return false
    return null
  }

  const parseEffectiveness = (val) => {
    if (val === 'true' || val === true) return true
    if (val === 'false' || val === false) return false
    return null
  }
</script>

<style scoped>
  .followupTable {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 1rem;
    background-color: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px var(--shadow-color);
  }

  .evidence-cell {
    min-width: 220px;
  }

  .evidence-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }

  .evidence-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .evidence-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .evidence-list a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 170px;
    display: inline-block;
  }

  .evidence-role {
    color: #888;
    font-size: 0.9em;
    margin-left: 0.5em;
  }

  .finding-id-cell {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.35rem;
  }

  .status-dot {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 999px;
    display: inline-block;
    flex: 0 0 0.65rem;
  }

  .cap-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    padding: 0.1rem 0.45rem;
    font-size: 0.75rem;
    cursor: pointer;
    background-color: #f8fafc;
  }

  .cap-badge:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .cap-dot {
    margin-left: 0.1rem;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-container {
    background: #fff;
    border-radius: 10px;
    width: min(600px, 92vw);
    padding: 1rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .cap-modal-grid {
    display: grid;
    gap: 0.55rem;
    margin: 0.9rem 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
