<template>
  <div>
    <div class="titulo">
      <img :src="logo"/>
      <span>
        <h2>Compliance Table with Evidence (Desktop)</h2>
      </span>
    </div>
    <div>
    <span>Location: {{ store.sessionSummary.location }}</span>
    </div>
    <div>
    <label>Specialty:</label>
    <select v-model="store.specialty" @change="store.loadChecklistAndSession">
      <option value="NONE">Select a specialty</option>
      <option v-for="(specialty, index) in store.specialtyList" :key="index" :value="specialty.code" >
          {{specialty.name }}
      </option> 
    </select>
    <button id="finalizeBtn" :disabled="store.sessionSummary.finalized" @click="store.showConfirm(store.modalFinalizeTitle, store.modalFinalizeExplanation, store.modalFinalizeAction)">
        Finalize inspection
    </button>
    <ModalWindow
      :show="store.showModal"
      :titulo="store.tituloModal"
      :explanation="store.explanationModal"
      :accion="store.accionModal" 
      @cancel="store.showModal = false" 
      @confirm="store.confirmModal"
    />
    </div>
    <p id="currentPath">{{ store.currentPath }}</p>
    <ChecklistTable v-if="store.checklistLoaded"/>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import ChecklistTable from './components/ChecklistTable.vue';
import ModalWindow from './components/ModalWindow.vue';
import { useChecklistStore } from './stores/checklistStore';
import logo from './images/logo_idac.png'

// Access the Pinia store
const store = useChecklistStore();

onMounted( async () => {

  // Check if the default path exists
  await store.checkDefaultPath();
})

</script>

<style scoped>
/* Scoped styles from style.css */
div.titulo {
  display: flex;
  height: 150px;
  align-items: center
}
div.logo img {
  object-fit: contain;
}
div.titulo > span {
  display: inline-block;
}
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
