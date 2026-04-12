<template>
  <table id="cklTable" class="cklTable" disabled>
    <colgroup>
      <col style="width: 5%" />
      <col style="width: 12%" />
      <col style="width: 19%" />
      <col style="width: 20%" />
      <col style="width: 14%" />
      <col style="width: 15%" />
      <col style="width: 15%" />
    </colgroup>
    <thead>
      <tr>
        <th>Code</th>
        <th>Reference</th>
        <th class="question">Question</th>
        <th class="verification">Verification</th>
        <th class="compliance">Compliance</th>
        <th class="comments">Comments</th>
        <th class="evidence">Evidence</th>
      </tr>
    </thead>
    <tbody>
      <ChecklistRow
        v-for="(row, index) in store.checklist?.questions || []"
        :key="row.code || row.id || index"
        :newTopic="topicChange(row.topic)"
        :questionCode="getQuestionCode(row, index)"
        :row="row"
        :session="getSessionForRow(row, index)"
        :readOnly="isLinkedOpenFinding(row)"
        :linkedFindingId="row?.priorFindingId || ''"
        @go-follow-up="onGoFollowUp"
      />
    </tbody>
  </table>
</template>

<script setup>
  import ChecklistRow from './ChecklistRow.vue'
  import { useChecklistStore } from '../stores/checklistStore'
  import { useSessionStore } from '../stores/sessionStore'

  // Access the Pinia store
  const store = useChecklistStore()
  const sessionStore = useSessionStore()

  let previousTopic = ''

  const getQuestionCode = (row, index) => row?.code || String(index + 1)

  const getSessionForRow = (row, index) => {
    const questionCode = getQuestionCode(row, index)
    return (
      sessionStore.responses[questionCode] ||
      sessionStore.responses[index + 1] ||
      sessionStore.responses[String(index + 1)] ||
      {}
    )
  }

  const topicChange = (t) => {
    if (!t || t.length == 0) {
      console.log('Empty topic!')
      return true
    } else {
      const isNew = previousTopic != t
      previousTopic = t
      return isNew
    }
  }

  const isLinkedOpenFinding = (row) => {
    if (!row?.priorFindingId) {
      return false
    }
    const findingStatus = row?.priorFinding?.findingStatus
    if (!findingStatus) {
      return true
    }
    return findingStatus.toLowerCase() != 'closed'
  }

  const onGoFollowUp = (findingId) => {
    store.goToFollowUpFinding(findingId)
  }
</script>

<style scoped>
  .cklTable {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 1rem;
    background-color: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px var(--shadow-color);
    table-layout: fixed;
  }

  .cklTable thead {
    background-color: var(--primary-color);
    color: var(--text-light);
    position: sticky;
    top: 0;
  }

  .cklTable th:first-child {
    border-top-left-radius: 12px;
  }
  .cklTable th:last-child {
    border-top-right-radius: 12px;
  }
  .cklTable tr:last-child td:first-child {
    border-bottom-left-radius: 12px;
  }
  .cklTable tr:last-child td:last-child {
    border-bottom-right-radius: 12px;
  }

  th,
  td {
    border: 1px solid var(--border-color);
    padding: 1rem;
    vertical-align: top;
    border-left: none;
    border-right: none;
  }

  th {
    text-align: center;
    font-weight: 600;
  }
</style>
