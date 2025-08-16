<template>
  <table id="csvTable">
    <thead>
      <tr>
        <th>#</th>
        <th>Reference</th>
        <th>Question</th>
        <th>N/A</th>
        <th>Verification</th>
        <th>Compliance</th>
        <th>Comments</th>
        <th>Evidence</th>
      </tr>
    </thead>
    <tbody>
      <ChecklistRow
        v-for="(row, index) in checklist.questions"
        :key="index"
        :qnumber="'subtitle' in row ? 0 : index + 1"
        :row="row"
        :session="sessionData[index + 1] || {}"
        @update-session="updateSession"
      />
    </tbody>
  </table>
</template>

<script setup>
import ChecklistRow from './ChecklistRow.vue';
defineProps(['checklist', 'sessionData']);
const emit = defineEmits(['update-session']);

const updateSession = (rowId, checklistId, field, value) => {

  emit('update-session', rowId, checklistId, field, value);

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
