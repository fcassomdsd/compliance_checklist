<template>
  <div>
    <h2>Compliance Table with Evidence (Desktop)</h2>
    <label>Especialidad:</label>
    <select v-model="specialty" @change="loadChecklistAndSession">
      <option value="NONE">Select a specialty</option>
      <option value="VIG">Vigilancia Radar</option>
      <option value="COM">Comunicaciones de Radio</option>
      <option value="RNA">Radioayudas</option>
      <option value="EEM">Energia y Equipos MET</option>
    </select>
    <button id="exportBtn" :disabled="!checklistLoaded" @click="autosave">Export CSV</button>
    <p id="currentPath">{{ currentPath }}</p>
    <ChecklistTable v-if="checklistLoaded" :checklist="checklist" :session-data="sessionData" @update-session="updateSession" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import ChecklistTable from './components/ChecklistTable.vue';

const specialty = ref('NONE');
const checklist = ref(null);
const checklistLoaded = ref(false);
const sessionData = ref({});
let sessionElectron = {};
const currentPath = ref('');
let saveTimer = null;

const showSavePath = (path) => {
  currentPath.value = `Saving to: ${path}`;
};

const loadChecklistAndSession = async () => {
  if (specialty.value === 'NONE') {
    checklist.value = null;
    checklistLoaded.value = false;
    sessionData.value = {};
    return;
  }

  try {
    const savePath = await window.electronAPI.setSavePath(specialty.value);
    showSavePath(savePath);
    sessionData.value = await window.electronAPI.loadSession(specialty.value);
    checklist.value = await window.electronAPI.loadChecklist(specialty.value);
    checklistLoaded.value = true;
  } catch (error) {
    alert(error.message);
    checklistLoaded.value = false;
  }
};

const exportCSV = async () => {
  // Implement CSV export logic (similar to index.js)
  alert('CSV export not implemented in this example');
};

const updateSession = (rowId, field, value) => {
  if (!sessionData.value[rowId]) sessionData.value[rowId] = {};
  sessionData.value[rowId][field] = value;
  sessionElectron = JSON.stringify(sessionData.value);
  autoSave();
};

const autoSave = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.electronAPI.saveSession(JSON.parse(sessionElectron));
//    window.electronAPI.saveSession({"1" : {"comments": "abcd"}},0);
  }, 1000);
};
</script>

<style scoped>
/* Scoped styles from style.css */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f4f8fb;
  margin: 0;
  padding: 20px;
  color: #333;
}
h2 {
  color: #214d72;
}
button {
  background-color: #1e88e5;
  border: none;
  color: white;
  padding: 10px 16px;
  margin-right: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
button:disabled {
  background-color: #90caf9;
  cursor: not-allowed;
}
button:hover:not(:disabled) {
  background-color: #1565c0;
}
</style>
