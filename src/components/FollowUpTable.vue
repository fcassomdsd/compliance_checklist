<template>
  <table id="followupTable" class="followupTable">
    <colgroup>
      <col style="width: 14%" />
      <col style="width: 28%" />
      <col style="width: 12%" />
      <col style="width: 10%" />
      <col style="width: 10%" />
      <col style="width: 26%" />
    </colgroup>
    <thead>
      <tr>
        <th>Finding ID</th>
        <th>Description</th>
        <th>Percent Complete</th>
        <th>Effective</th>
        <th>Closed</th>
        <th>Evidence</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="entry in store.findings" :key="entry?.findingId || Math.random()">
        <td>{{ entry?.findingId || '' }}</td>
        <td>{{ entry?.description || '' }}</td>
        <td>
          <input
            type="number"
            min="0"
            max="100"
            :disabled="followUpStore.summary.finalized"
            :value="getField(entry, 'percentComplete')"
            @input="onFieldChange(entry, 'percentComplete', Number($event.target.value))"
          />
        </td>
        <td>
          <input
            type="checkbox"
            :disabled="followUpStore.summary.finalized"
            :checked="getField(entry, 'effectivenessConfirmed')"
            @change="onFieldChange(entry, 'effectivenessConfirmed', $event.target.checked)"
          />
        </td>
        <td>
          <input
            type="checkbox"
            :disabled="followUpStore.summary.finalized"
            :checked="getField(entry, 'findingClosed')"
            @change="onFieldChange(entry, 'findingClosed', $event.target.checked)"
          />
        </td>
        <td class="evidence-cell">
          <div class="evidence-controls">
            <input
              :id="`followup-file-input-${toDomId(getFindingId(entry))}`"
              type="file"
              hidden
              multiple
              :disabled="followUpStore.summary.finalized"
              @change="onEvidenceChange(entry, $event)"
            />
            <button
              type="button"
              :disabled="followUpStore.summary.finalized"
              @click="triggerEvidenceUpload(getFindingId(entry))"
            >
              Add evidence
            </button>
          </div>
          <ul v-if="getEvidenceList(entry).length > 0" class="evidence-list">
            <li v-for="(evidenceName, evidenceIndex) in getEvidenceList(entry)" :key="evidenceName + evidenceIndex">
              <input
                type="image"
                :src="trash"
                height="15"
                width="15"
                :disabled="followUpStore.summary.finalized"
                @click="removeEvidence(entry, evidenceIndex, evidenceName)"
              />
              <a :href="evidenceStore.files[evidenceName]?.URL" download target="_blank">
                {{ evidenceName }}
              </a>
            </li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
  import { useToast } from 'vue-toastification'
  import { useChecklistStore } from '../stores/checklistStore'
  import { useFollowUpStore } from '../stores/followUpStore'
  import { useEvidenceStore } from '../stores/evidenceStore'
  import trash from '../assets/images/trash.png'

  const store = useChecklistStore()
  const followUpStore = useFollowUpStore()
  const evidenceStore = useEvidenceStore()
  const toast = useToast()

  const getFindingId = (entry) => entry?.findingId || ''
  const toDomId = (value) => String(value || '').replace(/[^A-Za-z0-9_-]/g, '-')
  const getLocationId = () => followUpStore.context?.locationId || null

  const getField = (entry, field) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return ''
    }
    return followUpStore.responses[findingId]?.[field] || (field == 'percentComplete' ? 0 : false)
  }

  const onFieldChange = (entry, field, value) => {
    const findingId = getFindingId(entry)
    if (!findingId) {
      return
    }
    followUpStore.updateFollowUp(findingId, field, value)

    // Immediate closure update when completion is 100% and effectiveness is confirmed.
    if (field == 'percentComplete' || field == 'effectivenessConfirmed') {
      const current = followUpStore.responses[findingId] || {}
      const isClosed = Number(current.percentComplete) == 100 && current.effectivenessConfirmed === true
      followUpStore.updateFollowUp(findingId, 'findingClosed', isClosed)
    }
  }

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

        const alreadyPresent = evidenceList.some((name) => name == file.name)
        if (alreadyPresent) {
          if (evidenceStore.files[file.name]?.count == 0) {
            evidenceStore.addCount(file.name)
          }
        } else {
          evidenceStore.addCount(file.name)
          evidenceList.push(file.name)
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
</style>
