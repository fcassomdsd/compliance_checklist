<template>
  <table id="cklTable" class="cklTable" disabled>
    <colgroup>
      <col style="width: 3%;">
      <col style="width: 12%;">
      <col style="width: 21%;">
      <col style="width: 22%;">
      <col style="width: 12%;">
      <col style="width: 15%;">
      <col style="width: 15%;">
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
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
        :key="index"
        :newTopic="topicChange(row.topic)"
        :qnumber="index + 1"
        :row="row"
        :session="store.sessionData[index + 1] || {}"
      />
    </tbody>
  </table>
</template>

<script setup>
import ChecklistRow from './ChecklistRow.vue';
import { useChecklistStore } from '../stores/checklistStore';

// Access the Pinia store
const store = useChecklistStore();

let previousTopic = ""
let emptyTopic = false;

const topicChange = (t) => {

  if ((!t) || t.length == 0) {
    console.log('Empty topic!');
    return true;
  } else { 
    const isNew = previousTopic != t;
    previousTopic = t;
    return isNew;
  }

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

th, td {
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
