<template>
  <div>
    <div class="header">
      <img :src="logo"/>
      <span>
        <h2>Operational Safety Compliance Checklist</h2>
      </span>
    </div>
    <div class="controls-container">
      <span>Location: {{ sessionStore.summary.location }}</span>
      <div>
        <label>Specialty:</label>
        <select v-model="store.specialty" @change="loadChecklistAndSession">
          <option value="NONE">Select a specialty</option>
          <option v-for="(specialty, index) in store.specialtyList" :key="index" :value="specialty.code" >
              {{specialty.name }}
          </option> 
        </select>
        <button id="finalizeBtn" :disabled="sessionStore.summary.finalized" @click="store.showFinalize()">
          Finalize inspection
        </button>
        <button id="exportBtn" :disabled="(!sessionStore.summary.finalized || !store.checklistLoaded)" @click="store.exportChecklist()">
            Report Findings
        </button>
      </div>
    </div>
    <ModalWindow
      :show="store.showModal"
      :titulo="store.tituloModal"
      :explanation="store.explanationModal"
      :accion="store.accionModal" 
      @cancel="store.showModal = false" 
      @confirm="store.confirmModal"
    />
    <p id="currentPath">{{ store.currentPath }}</p>
    <ChecklistTable v-if="store.checklistLoaded"/>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import ChecklistTable from './components/ChecklistTable.vue';
import ModalWindow from './components/ModalWindow.vue';
import { useChecklistStore } from './stores/checklistStore';
import { useSessionStore } from './stores/sessionStore';
import { useToast } from 'vue-toastification';
import logo from './images/compliance-logo.png'

// Access the Pinia store
const store = useChecklistStore();
const sessionStore = useSessionStore();
const toast = useToast();

const loadChecklistAndSession = async () => {

  try {
  if (await store.loadChecklist()) {
    await sessionStore.loadSession(store.specialty)  
  }
  } catch(error) {
      toast.error("Could not load checklist or session: " + error.message);
  }
}

onMounted( async () => {

  // Check if the default path exists
  await store.checkDefaultPath();
  
})

</script>

<style scoped>
/* Scoped styles from style.css */
.header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

.header img {
  height: 80px;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.header h2 {
  color: var(--primary-color);
  font-weight: 600;
  margin: 0;
}
.controls-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.controls-container label {
  font-weight: 500;
  color: var(--primary-color);
}
.controls-container select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: white;
  min-width: 200px;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236B7280'%3E%3Cpath d='M7 10l5 5 5-5H7z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1em;
  font-size: 1.1rem;
}
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    text-align: center;
  }
  .controls-container {
    flex-direction: column;
    align-items: stretch;
  }
  .controls-container select {
    width: 100%;
  }
}</style>
