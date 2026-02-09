<template>
  <div>
    <div class="header">
      <img :src="logo" />
      <span>
        <h2>Operational Safety Compliance Checklist</h2>
      </span>
    </div>
    <div class="controls-container">
      <!-- Show checklist-level information (inspection, startDate, location) -->
      <span>Inspection: {{ store.checklist?.inspection || '' }}</span>
      <span>Start: {{ store.checklist?.startDate || '' }}</span>
      <span>Location: {{ store.checklist?.location || '' }}</span>

      <div>
        <label>Specialty:</label>
        <select v-model="store.specialty" @change="loadChecklistAndSession">
          <option value="NONE">Select a specialty</option>
          <option
            v-for="(specialty, index) in store.specialtyList"
            :key="index"
            :value="specialty.code"
          >
            {{ specialty.name }}
          </option>
        </select>
        <button
          id="finalizeBtn"
          :disabled="sessionStore.summary.finalized"
          @click="store.showFinalize()"
        >
          Finalize inspection
        </button>
        <button
          id="exportBtn"
          :disabled="!sessionStore.summary.finalized || !store.checklistLoaded"
          @click="store.exportChecklist()"
        >
          Report Findings
        </button>
        <button
          id="viewReportBtn"
          :disabled="!store.generatedReportPath"
          @click="store.viewGeneratedReport()"
        >
          View Report
        </button>

        <!-- General comments toggle -->
        <button
          id="genCommentsToggle"
          @click="showGenComments = !showGenComments"
          :disabled="!store.checklistLoaded"
        >
          {{ showGenComments ? 'Hide General Comments' : 'Show General Comments' }}
        </button>
      </div>

      <div class="import-controls">
        <label>Import Checklist:</label>
        <input
          id="importInspection"
          v-model="importInspection"
          type="text"
          placeholder="Inspection code (e.g. 0224)"
        />
        <input
          id="importSpecialty"
          v-model="importSpecialty"
          type="text"
          placeholder="Specialty code (e.g. VIG)"
        />
        <button
          id="importChecklistBtn"
          :disabled="store.isImporting"
          @click="onImportChecklist"
        >
          {{ store.isImporting ? 'Importing...' : 'Import Checklist' }}
        </button>
      </div>
    </div>

    <!-- General comments area -->
    <div v-if="showGenComments" class="general-comments">
      <textarea
        id="generalComments"
        :value="sessionStore.summary.generalComments"
        placeholder="Add general comments about this checklist..."
        @input="onGeneralCommentsInput($event)"
      ></textarea>
      <div>
        <button
          id="clearGeneralComments"
          @click="clearGeneralComments()"
          :disabled="sessionStore.summary.finalized"
        >
          Clear
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
    <ChecklistTable v-if="store.checklistLoaded" />
  </div>
</template>

<script setup>
  import { onMounted, ref } from 'vue'
  import ChecklistTable from './components/ChecklistTable.vue'
  import ModalWindow from './components/ModalWindow.vue'
  import { useChecklistStore } from './stores/checklistStore'
  import { useSessionStore } from './stores/sessionStore'
  import { useToast } from 'vue-toastification'
  import logo from './assets/images/compliance-logo.png'

  // Access the Pinia store
  const store = useChecklistStore()
  const sessionStore = useSessionStore()
  const toast = useToast()

  // Local UI state for toggling general comments
  const showGenComments = ref(false)
  const importInspection = ref('')
  const importSpecialty = ref('')

  const onGeneralCommentsInput = (event) => {
    sessionStore.updateGeneralComments(event.target.value)
  }

  const clearGeneralComments = () => {
    sessionStore.updateGeneralComments('')
  }

  const loadChecklistAndSession = async () => {
    try {
      if (await store.loadChecklist()) {
        await sessionStore.loadSession(store.specialty)
      }
    } catch (error) {
      toast.error('Could not load session: ' + error.message)
    }
  }

  const onImportChecklist = async () => {
    const inspection = importInspection.value.trim()
    const specialtyCode = importSpecialty.value.trim()

    if (!inspection || !specialtyCode) {
      toast.error('Inspection and specialty are required to import')
      return
    }

    await store.importChecklist(inspection, specialtyCode)
  }

  onMounted(async () => {
    // Check if the default path exists
    await store.checkDefaultPath()
    // Load specialties from file
    await store.loadSpecialties()
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
  .import-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .import-controls input {
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
    min-width: 200px;
  }
  .general-comments {
    margin: 1rem 0;
  }

  #generalComments {
    width: 100%;
    min-height: 120px;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    resize: vertical;
    font-size: 1rem;
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
    .import-controls {
      width: 100%;
    }
    .import-controls input {
      width: 100%;
    }
  }
</style>
