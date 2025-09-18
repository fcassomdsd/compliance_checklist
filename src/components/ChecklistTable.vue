<template>
  <table id="csvTable" disabled>
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
#csvTable {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  background-color: #ffffff;
}
#csvTable thead {
  background-color: #2e6da4;
  color: white;
  position: sticky;
  top: 0;
}
th, td {
  border: 1px solid #cfd8dc;
  padding: 10px;
  vertical-align: top;
}
th {
  text-align: center;
}

</style>
