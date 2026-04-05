<template>
  <table id="followupTable" class="followupTable">
    <colgroup>
      <col style="width: 18%" />
      <col style="width: 34%" />
      <col style="width: 16%" />
      <col style="width: 16%" />
      <col style="width: 16%" />
    </colgroup>
    <thead>
      <tr>
        <th>Finding ID</th>
        <th>Description</th>
        <th>Percent Complete</th>
        <th>Effective</th>
        <th>Closed</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="entry in store.findings" :key="entry?.finding?.findingId || Math.random()">
        <td>{{ entry?.finding?.findingId || '' }}</td>
        <td>{{ entry?.finding?.description || '' }}</td>
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
      </tr>
    </tbody>
  </table>
</template>

<script setup>
  import { useChecklistStore } from '../stores/checklistStore'
  import { useFollowUpStore } from '../stores/followUpStore'

  const store = useChecklistStore()
  const followUpStore = useFollowUpStore()

  const getFindingId = (entry) => entry?.finding?.findingId || ''

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
</style>
