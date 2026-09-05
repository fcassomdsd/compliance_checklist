<template>
  <div>
    <div class="header">
      <img :src="logo" />
      <span>
        <h2>{{ t('app.title') }}</h2>
      </span>
      <div class="locale-switcher">
        <button
          type="button"
          :class="{ active: sessionStore.locale == 'en' }"
          @click="sessionStore.setLocale('en')"
        >
          EN
        </button>
        <button
          type="button"
          :class="{ active: sessionStore.locale == 'es' }"
          @click="sessionStore.setLocale('es')"
        >
          ES
        </button>
      </div>
      <div class="service-status">
        <span class="service-label">{{ t('app.serviceImportLabel') }}</span>
        <span :class="['service-dot', store.importServiceOnline ? 'online' : 'offline']"></span>
        <span class="service-label">{{ t('app.serviceUploadLabel') }}</span>
        <span :class="['service-dot', store.uploadServiceOnline ? 'online' : 'offline']"></span>
      </div>
    </div>
    <div class="workspace-controls">
      <label>{{ t('toolbar.modeLabel') }}</label>
      <select id="modeSelect" v-model="store.uiMode" @change="onModeChange">
        <option value="inspection">{{ t('toolbar.modeInspection') }}</option>
        <option value="followUp">{{ t('toolbar.modeFollowUp') }}</option>
      </select>

      <label>{{ t('toolbar.workspaceLabel') }}</label>
      <select id="workspaceSelect" v-model="store.activeWorkspaceKey" @change="onWorkspaceChange">
        <option value="">{{ t('toolbar.selectWorkspace') }}</option>
        <option
          v-for="(workspace, index) in store.workspaceList"
          :key="index"
          :value="workspace.workspaceKey"
        >
          {{ workspace.displayName }}
        </option>
      </select>
      <button
        id="openImportModalBtn"
        :class="{ 'offline-action': !store.importServiceOnline }"
        @click="showImportModal = true"
      >
        {{ store.uiMode == 'inspection' ? t('toolbar.importInspectionBtn') : t('toolbar.importFollowUpBtn') }}
      </button>
    </div>

    <div class="controls-container">
      <span>{{ t('controls.inspection', { value: store.checklist?.inspection || '' }) }}</span>
      <span>{{ t('controls.start', { value: store.checklist?.startDate || '' }) }}</span>
      <span>{{ t('controls.provider', { value: store.checklist?.providerName || '' }) }}</span>

      <button
        id="finalizeBtn"
        :disabled="store.uiMode == 'inspection' ? sessionStore.summary.finalized : followUpStore.summary.finalized"
        @click="onFinalize()"
      >
        {{ store.uiMode == 'inspection' ? t('controls.finalizeInspection') : t('controls.finalizeFollowUp') }}
      </button>
      <button
        id="exportBtn"
        :disabled="store.uiMode == 'followUp' || !sessionStore.summary.finalized || !store.checklistLoaded"
        @click="store.exportChecklist()"
      >
        {{ store.uiMode == 'followUp' ? t('controls.followUpUploadOnly') : t('controls.reportFindings') }}
      </button>
      <button
        id="exportUploadBtn"
        :disabled="uploadDisabled"
        :class="{ 'offline-action': !store.uploadServiceOnline }"
        @click="store.exportUploadPayload()"
      >
        {{ store.isUploading ? t('controls.uploading') : uploadLabel }}
      </button>
      <button id="removeSessionBtn" class="danger-action" :disabled="removeSessionDisabled" @click="onRemoveSession">
        {{ removeSessionLabel }}
      </button>
      <button
        id="viewReportBtn"
        :disabled="!store.generatedReportPath"
        @click="store.viewGeneratedReport()"
      >
        {{ t('controls.viewReport') }}
      </button>

      <button
        id="genCommentsToggle"
        @click="showGenComments = !showGenComments"
        :disabled="!store.checklistLoaded"
      >
        {{ showGenComments ? t('controls.hideGeneralComments') : t('controls.showGeneralComments') }}
      </button>
    </div>

    <!-- General comments area -->
    <div v-if="showGenComments" class="general-comments">
      <textarea
        id="generalComments"
        :value="sessionStore.summary.generalComments"
        :placeholder="t('generalComments.placeholderComments')"
        @input="onGeneralCommentsInput($event)"
      ></textarea>
      <textarea
        id="interviewee"
        :value="sessionStore.summary.interviewee"
        :placeholder="t('generalComments.placeholderInterviewee')"
        @input="onIntervieweeInput($event)"
      ></textarea>
      <div>
        <button
          id="clearGeneralComments"
          @click="clearGeneralComments()"
          :disabled="sessionStore.summary.finalized"
        >
          {{ t('generalComments.clear') }}
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
    <div v-if="store.apiKeyPromptVisible" class="modal-overlay">
      <div class="modal-container">
        <h2>{{ t('apiKeyModal.title') }}</h2>
        <p class="modal-explanation">
          {{ t('apiKeyModal.explanation') }}
        </p>
        <input
          v-model="store.apiKeyInput"
          type="password"
          class="api-key-input"
          :placeholder="t('apiKeyModal.placeholder')"
          @keyup.enter="store.submitApiKey"
        />
        <div class="modal-actions">
          <button @click="store.cancelApiKeyPrompt" class="btn-cancel">{{ t('apiKeyModal.cancel') }}</button>
          <button @click="store.submitApiKey" class="btn-confirm">{{ t('apiKeyModal.saveAndUpload') }}</button>
        </div>
      </div>
    </div>
    <div v-if="showImportModal" class="modal-overlay">
      <div class="modal-container import-modal">
        <h2>{{ store.uiMode == 'inspection' ? t('importModal.titleInspection') : t('importModal.titleFollowUp') }}</h2>
        <p class="modal-explanation">
          {{ t('importModal.explanation') }}
        </p>

        <div class="modal-form-row" v-if="store.uiMode == 'inspection'">
          <label for="importInspection">{{ t('importModal.inspectionProviderLabel') }}</label>
          <select id="importInspection" v-model="selectedInspectionProvider">
            <option value="">{{ t('importModal.selectInspection') }}</option>
            <option
              v-for="ip in inspectionProviderList"
              :key="ip.inspectionId"
              :value="JSON.stringify(ip)"
            >
              {{ ip.code }} / {{ ip.serviceProviderName || ip.inspectedProviderId }}
            </option>
          </select>
        </div>

        <div class="modal-form-row" v-else>
          <label for="importLocation">{{ t('importModal.locationLabel') }}</label>
          <select id="importLocation" v-model="importLocationId">
            <option value="">{{ t('importModal.selectLocation') }}</option>
            <option
              v-for="(location, index) in store.locationList"
              :key="index"
              :value="location.icaoCode"
            >
              {{ location.icaoCode }} - {{ location.name }}
            </option>
          </select>
        </div>

        <div class="modal-form-row">
          <label for="importSpecialty">{{ t('importModal.specialtyLabel') }}</label>
          <select id="importSpecialty" v-model="importSpecialtyCode">
            <option value="">{{ t('importModal.selectSpecialty') }}</option>
            <option
              v-for="(specialtyOption, index) in store.specialtyList"
              :key="index"
              :value="specialtyOption.code"
            >
              {{ specialtyOption.code }} - {{ specialtyOption.name }}
            </option>
          </select>
        </div>

        <div class="import-summary">
          <p><strong>{{ t('importModal.summaryMode') }}</strong> {{ store.uiMode == 'inspection' ? t('toolbar.modeInspection') : t('toolbar.modeFollowUp') }}</p>
          <p v-if="store.uiMode == 'inspection'">
            <strong>{{ t('importModal.summaryInspection') }}</strong> {{ selectedInspectionProviderDisplay }}
          </p>
          <p v-else><strong>{{ t('importModal.summaryLocation') }}</strong> {{ selectedLocationLabel }}</p>
          <p><strong>{{ t('importModal.summarySpecialty') }}</strong> {{ selectedSpecialtyLabel }}</p>
        </div>

        <div class="modal-actions">
          <button id="cancelImportModalBtn" class="btn-cancel" @click="showImportModal = false">{{ t('importModal.cancel') }}</button>
          <button
            id="importDataBtn"
            class="btn-confirm"
            :disabled="importDisabled"
            :class="{ 'offline-action': !store.importServiceOnline }"
            @click="onImportSubmit"
          >
            {{ importLabel }}
          </button>
        </div>
      </div>
    </div>
    <p id="currentPath">{{ store.currentPath }}</p>
    <ChecklistTable v-if="store.uiMode == 'inspection' && store.checklistLoaded" />
    <FollowUpTable v-if="store.uiMode == 'followUp' && store.findingsLoaded" />
  </div>
</template>

<script setup>
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import ChecklistTable from './components/ChecklistTable.vue'
  import FollowUpTable from './components/FollowUpTable.vue'
  import ModalWindow from './components/ModalWindow.vue'
  import { useChecklistStore } from './stores/checklistStore'
  import { useSessionStore } from './stores/sessionStore'
  import { useFollowUpStore } from './stores/followUpStore'
  import { useToast } from 'vue-toastification'
  import { createFileService } from './utils/fileServices'
  import logo from './assets/images/compliance-logo.png'

  const fs = createFileService()
  const { t } = useI18n()

  // Access the Pinia store
  const store = useChecklistStore()
  const sessionStore = useSessionStore()
  const followUpStore = useFollowUpStore()
  const toast = useToast()

  // Local UI state for toggling general comments
  const showGenComments = ref(false)
  const showImportModal = ref(false)
  const importSpecialtyCode = ref('')
  const importLocationId = ref('')
  const selectedInspectionProvider = ref('')
  const inspectionProviderList = ref([])
  let serviceStatusInterval = null

  const onGeneralCommentsInput = (event) => {
    sessionStore.updateGeneralComments(event.target.value)
  }

  const onIntervieweeInput = (event) => {
    sessionStore.updateInterviewee(event.target.value)
  }

  const clearGeneralComments = () => {
    sessionStore.updateGeneralComments('')
  }

  const loadInspectionProviderList = async () => {
    try {
      inspectionProviderList.value = await fs.fetchInspectionProviders()
    } catch {
      inspectionProviderList.value = []
    }
  }

  const onWorkspaceChange = async () => {
    if (!store.activeWorkspaceKey) {
      return
    }
    await store.selectWorkspace(store.activeWorkspaceKey)
  }

  const onImportData = async () => {
    if (!store.importServiceOnline) {
      toast.error(t('toast.importServiceOffline'))
      return false
    }

    const specialtyCode = importSpecialtyCode.value.trim()

    if (store.uiMode == 'inspection') {
      const selected = selectedInspectionProvider.value
      if (!selected) {
        toast.error(t('toast.selectInspectionAndProvider'))
        return false
      }

      let parsed = null
      try {
        parsed = JSON.parse(selected)
      } catch {
        toast.error(t('toast.invalidSelection'))
        return false
      }

      const inspectionId = parsed.inspectionId
      const inspectedProviderId = parsed.inspectedProviderId
      const siteVisitId = parsed.siteVisitId

      if (!inspectionId) {
        toast.error(t('toast.inspectionMissingId'))
        return false
      }

      if (!specialtyCode) {
        toast.error(t('toast.inspectionSpecialtyRequired'))
        return false
      }
      await store.importChecklist(inspectionId, specialtyCode, { inspectedProviderId, siteVisitId })
    } else {
      const locationId = importLocationId.value.trim()
      if (!locationId || !specialtyCode) {
        toast.error(t('toast.locationSpecialtyRequired'))
        return false
      }
      await store.importFindings(specialtyCode, locationId)
    }

    if (store.activeWorkspace?.locationId) {
      await followUpStore.loadFollowUpSession(store.specialty, store.activeWorkspace.locationId)
    }

    return true
  }

  const onImportSubmit = async () => {
    const imported = await onImportData()
    if (imported) {
      showImportModal.value = false
    }
  }

  const onFinalize = async () => {
    if (store.uiMode == 'inspection') {
      store.showFinalize()
      return
    }
    await followUpStore.finalize()
  }

  const onModeChange = async () => {
    selectedInspectionProvider.value = ''
    if (store.uiMode == 'followUp' && store.activeWorkspace?.locationId) {
      await followUpStore.loadFollowUpSession(store.specialty, store.activeWorkspace.locationId)
    }
  }

  const onRemoveSession = async () => {
    if (store.uiMode == 'inspection') {
      await store.removeInspectionSession()
      return
    }
    await store.removeFollowUpSession()
  }

  const importLabel = computed(() => {
    if (store.isImporting || store.isImportingFindings) {
      return t('importModal.importing')
    }
    return store.uiMode == 'inspection' ? t('importModal.importInspection') : t('importModal.importFollowUp')
  })

  const selectedInspectionProviderDisplay = computed(() => {
    const val = selectedInspectionProvider.value
    if (!val) return t('importModal.notSelected')
    try {
      const p = JSON.parse(val)
      return `${p.code} / ${p.serviceProviderName || p.inspectedProviderId}`
    } catch {
      return t('importModal.notSelected')
    }
  })

  const selectedSpecialtyLabel = computed(() => {
    const code = importSpecialtyCode.value.trim()
    if (!code) {
      return t('importModal.notSelected')
    }
    const specialtyEntry = store.specialtyList.find((entry) => entry.code == code)
    return specialtyEntry ? `${specialtyEntry.code} - ${specialtyEntry.name}` : code
  })

  const selectedLocationLabel = computed(() => {
    const icao = importLocationId.value.trim()
    if (!icao) {
      return t('importModal.notSelected')
    }
    const locationEntry = store.locationList.find((entry) => entry.icaoCode == icao)
    return locationEntry ? `${locationEntry.icaoCode} - ${locationEntry.name}` : icao
  })

  const importDisabled = computed(() => {
    if (!store.importServiceOnline) {
      return false
    }
    if (store.uiMode == 'inspection') {
      return !selectedInspectionProvider.value || !importSpecialtyCode.value.trim() || store.isImporting
    }
    return !importLocationId.value.trim() || !importSpecialtyCode.value.trim() || store.isImportingFindings
  })

  const uploadDisabled = computed(() =>
    !store.uploadServiceOnline ||
    store.uiMode == 'followUp'
      ? !followUpStore.summary.finalized || !store.findingsLoaded || store.isUploading
      : !sessionStore.summary.finalized || !store.checklistLoaded || store.isUploading
  )

  const uploadLabel = computed(() => (store.uiMode == 'followUp' ? t('controls.uploadFollowUp') : t('controls.upload')))

  const localInspectionTouched = computed(() => {
    const responsesCount = Object.keys(sessionStore.responses || {}).length
    const generalComments = String(sessionStore.summary?.generalComments || '').trim()
    const interviewee = String(sessionStore.summary?.interviewee || '').trim()
    return responsesCount > 0 || generalComments.length > 0 || interviewee.length > 0
  })

  const localFollowUpTouched = computed(() => Object.keys(followUpStore.responses || {}).length > 0)

  const canRemoveInspectionSession = computed(() => {
    if (!store.activeWorkspace?.locationId || !store.specialty || store.specialty == 'NONE') {
      return false
    }
    const touched = Boolean(store.activeWorkspace?.checklistTouched) || localInspectionTouched.value
    const uploaded = Boolean(store.activeWorkspace?.checklistUploaded)
    return uploaded || !touched
  })

  const canRemoveFollowUpSession = computed(() => {
    if (!store.activeWorkspace?.locationId || !store.specialty || store.specialty == 'NONE') {
      return false
    }
    const touched = Boolean(store.activeWorkspace?.followUpTouched) || localFollowUpTouched.value
    const uploaded = Boolean(store.activeWorkspace?.followUpUploaded)
    return uploaded || !touched
  })

  const removeSessionDisabled = computed(() => {
    if (store.uiMode == 'inspection') {
      return !canRemoveInspectionSession.value || store.isUploading
    }
    return !canRemoveFollowUpSession.value || store.isUploading
  })

  const removeSessionLabel = computed(() =>
    store.uiMode == 'inspection' ? t('controls.removeInspectionSession') : t('controls.removeFollowUpSession')
  )

  watch(
    () => showImportModal.value,
    async (open) => {
      if (open && store.uiMode == 'inspection') {
        await loadInspectionProviderList()
      }
    }
  )

  watch(
    () => store.uiMode,
    async (mode) => {
      if (mode == 'followUp' && store.activeWorkspace?.locationId) {
        await followUpStore.loadFollowUpSession(store.specialty, store.activeWorkspace.locationId)
      }
    }
  )

  onMounted(async () => {
    await sessionStore.initLocale()
    // Check if the default path exists
    await store.checkDefaultPath()
    // Load specialties from file
    await store.loadSpecialties()
    await store.loadLocations()
    // Load workspace registry for location + specialty switching
    await store.loadWorkspaces()
    await store.refreshServiceStatus()
    serviceStatusInterval = setInterval(() => {
      store.refreshServiceStatus()
    }, 30000)
  })

  onUnmounted(() => {
    if (serviceStatusInterval) {
      clearInterval(serviceStatusInterval)
      serviceStatusInterval = null
    }
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
  .locale-switcher {
    margin-left: auto;
    display: flex;
    gap: 0.3rem;
  }
  .locale-switcher button {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: white;
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .locale-switcher button.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }
  .service-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
  }
  .service-label {
    font-size: 0.9rem;
  }
  .service-dot {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    display: inline-block;
  }
  .service-dot.online {
    background-color: #16a34a;
  }
  .service-dot.offline {
    background-color: #dc2626;
  }
  .workspace-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.2rem;
  }
  .workspace-controls label {
    font-weight: 600;
    color: var(--primary-color);
  }
  .workspace-controls select,
  .workspace-controls input {
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
    min-width: 220px;
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
  .offline-action {
    color: #b91c1c;
  }
  .danger-action {
    background-color: #b91c1c;
    border-color: #991b1b;
    color: #fff;
  }
  .danger-action:disabled {
    background-color: #e5e7eb;
    border-color: #d1d5db;
    color: #6b7280;
  }
  .import-modal {
    width: min(520px, 94vw);
    text-align: left;
  }
  .import-modal h2 {
    margin-top: 0;
    color: var(--primary-color);
  }
  .modal-form-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.9rem;
  }
  .modal-form-row label {
    font-weight: 600;
  }
  .modal-form-row input,
  .modal-form-row select {
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
  }
  .import-summary {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: #f8fafc;
    padding: 0.75rem 0.9rem;
    margin: 0.4rem 0 1rem;
  }
  .import-summary p {
    margin: 0.2rem 0;
    font-size: 0.95rem;
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

  #interviewee {
    width: 100%;
    min-height: 60px;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    resize: vertical;
    font-size: 1rem;
    margin-top: 0.5rem;
  }
  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      text-align: center;
      align-items: flex-start;
    }
    .service-status {
      margin-left: 0;
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
  .api-key-input {
    width: 100%;
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 1rem;
    margin: 0.75rem 0;
  }

  .inline-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .inline-input-row input {
    flex: 1;
  }

  .btn-small {
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--secondary-color);
    color: white;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
