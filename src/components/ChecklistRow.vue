<template>
  <tr v-if="newTopic" class="full-span">
    <td colspan="8">{{ row.topic }}</td>
  </tr>
  <tr :class="{ 'row-read-only': isReadOnly }">
    <td hidden>{{ row.id }}</td>
    <td :id="`qcode-${domQuestionCode}`">
      {{ questionCode }}
      <button
        v-if="readOnly && linkedFindingId"
        class="followup-link"
        title="This question has an open linked finding. Click to switch to follow-up mode"
        @click="emit('go-follow-up', linkedFindingId)"
      >
        Follow-up
      </button>
    </td>
    <td class="reference">
      <div v-if="row.reference?.normativa?.reglamento">
        <span class="ref-label">STD</span><br />
        <button
          class="normativa-link"
          title="Click to view ICAO reference and full text"
          @click="openNormativa(row.reference.normativa)"
        >
          {{ row.reference.normativa.reglamento }} {{ row.reference.normativa.articulo }}
        </button>
      </div>
      <div v-if="row.reference?.guidance">
        <span class="ref-label">GM</span><br />
        <span>{{ row.reference.guidance }}</span>
      </div>
    </td>
    <td class="question">{{ row.question }}</td>
    <td class="verification">{{ row.verification }}</td>
    <td class="compliance" :style="radioColors[session.compliance]">
      <label v-for="(radioBtn, index) in radioButtons" :key="index">
        <input
          type="radio"
          :name="`compliance-${domQuestionCode}`"
          :value="radioBtn"
          :disabled="isReadOnly"
          :checked="session.compliance === radioBtn"
          @change="radioChange($event)"
        />
        {{ radioBtn }}
        <br />
      </label>
      <div class="non-conformity" :hidden="session.compliance != 'Non-compliant'">
        <button class="nc-modal-trigger" @click="openNonConformityModal">
          {{ isReadOnly ? 'View Non-conformity' : 'Edit Non-conformity' }}
        </button>
        <div class="nc-summary">
          <span class="risk-pill">{{ assignedRiskLevel }}</span>
          <span class="nc-summary-text">
            {{ nonConformityDescription ? 'Description added' : 'No description yet' }}
          </span>
        </div>
      </div>
    </td>
    <td class="comments">
      <textarea
        :name="`comments-${domQuestionCode}`"
        :value="session.comments"
        :disabled="isReadOnly"
        @input="textAreaChange($event)"
      ></textarea>
      <div class="audio-controls">
        <button
          :title="`${recordingComments ? 'Stop' : 'Start'} Recording Comments`"
          :disabled="isReadOnly"
          @click="toggleAudioRecordingComments"
          :class="{ recording: recordingComments }"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
            />
            <path
              d="M17 16.91c-1.48 1.46-3.51 2.36-5.7 2.36-2.19 0-4.22-.9-5.7-2.36m8.02-13.26l1.41 1.41A6.977 6.977 0 0 1 20 11h2c0-2.46-.98-4.7-2.58-6.35z"
            />
            <path d="M4.41 4.41L3 5.83A6.977 6.977 0 0 0 4 11H2c0-2.46.98-4.7 2.41-6.35z" />
            <path d="M9 18c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1z" />
          </svg>
        </button>
        <div class="audio-list">
          <div
            v-for="(audio, index) in session.audioComments || []"
            :key="index"
            class="audio-item"
          >
            <button @click="playAudio(audio)" title="Play recording">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <span>{{ audio }}</span>
            <button
              @click="removeAudio(index, 'comments')"
              :disabled="isReadOnly"
              title="Delete recording"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </td>
    <td class="evidence">
      <div class="upload-buttons">
        <input
          :id="`fileInput-${domQuestionCode}`"
          style="width: 100%"
          type="file"
          hidden
          class="evidence-upload"
          :name="`evidence-${domQuestionCode}`"
          :disabled="isReadOnly"
          multiple
          @change="evidenceChange($event)"
        />
        <input
          type="image"
          :src="fileUpload"
          height="30"
          width="30"
          :disabled="isReadOnly"
          @click="evidenceUpload(domQuestionCode)"
        />
        <input
          type="image"
          :id="`cameraInput-${domQuestionCode}`"
          :src="cameraIcon"
          height="30"
          width="30"
          :disabled="isReadOnly"
          @click="openCamera"
        />
      </div>
      <table class="preview" :id="`evidencetable-${domQuestionCode}`">
        <tr v-for="(evidence, index) in session.evidence" :key="index">
          <td>
            <input
              type="image"
              :src="trash"
              height="15"
              width="15"
              :disabled="isReadOnly"
              @click="removeEvidence(index, evidenceName(evidence))"
            />
          </td>
          <td :class="{ missing: evidenceStore.files[evidenceName(evidence)]?.URL == '' }">
            <a :href="evidenceStore.files[evidenceName(evidence)]?.URL" download target="_blank">
              {{ evidenceStore.files[evidenceName(evidence)]?.count }}{{ evidenceName(evidence) }}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <div v-if="showCameraModal" class="camera-modal">
    <video ref="video" autoplay></video>
    <canvas ref="canvas" style="display: none"></canvas>
    <button @click="capturePhoto">Capture</button>
    <button @click="closeCameraModal">Cancel</button>
  </div>
  <div v-if="showNormativaModal" class="normativa-modal-overlay" @click.self="showNormativaModal = false">
    <div class="normativa-modal">
      <h3>{{ selectedNormativa?.reglamento }} {{ selectedNormativa?.articulo }}</h3>
      <p><strong>ICAO Reference:</strong> {{ selectedNormativa?.ICAOref }}</p>
      <p class="normativa-texto">{{ selectedNormativa?.texto }}</p>
      <button @click="showNormativaModal = false">Close</button>
    </div>
  </div>
  <div v-if="showNonConformityModal" class="nc-modal-overlay" @click.self="closeNonConformityModal">
    <div class="nc-modal">
      <div class="nc-modal-header">
        <h3>Non-conformity details</h3>
        <button class="nc-close" @click="closeNonConformityModal">Close</button>
      </div>
      <div class="non-conformity-meta">
        <label class="risk-row" :for="`findingLevel-${domQuestionCode}`">
          <span class="risk-label">Finding Level</span>
          <select
            :id="`findingLevel-${domQuestionCode}`"
            :name="`findingLevel-${domQuestionCode}`"
            :value="assignedFindingLevel"
            :disabled="isReadOnly"
            @change="findingLevelChange($event)"
          >
            <option v-for="level in findingLevels" :key="level" :value="level">{{ level }}</option>
          </select>
        </label>
        <div class="risk-row nominal-risk">
          <span class="risk-label">Nominal Risk</span>
          <span class="risk-value">{{ nominalRiskLevel }}</span>
        </div>
        <label class="risk-row" :for="`riskLevel-${domQuestionCode}`">
          <span class="risk-label">Assigned Risk</span>
          <select
            :id="`riskLevel-${domQuestionCode}`"
            :name="`riskLevel-${domQuestionCode}`"
            :value="assignedRiskLevel"
            :disabled="isReadOnly"
            @change="riskLevelChange($event)"
          >
            <option v-for="level in riskLevels" :key="level" :value="level">{{ level }}</option>
          </select>
        </label>
      </div>
      <textarea
        :name="`nonConformity-${domQuestionCode}`"
        :value="nonConformityDescription"
        :disabled="isReadOnly"
        placeholder="Describa la no conformidad"
        @input="nonConformityChange($event)"
      ></textarea>
      <div class="audio-controls">
        <button
          :title="`${recordingNonConformity ? 'Stop' : 'Start'} Recording Non-conformity`"
          :disabled="isReadOnly"
          @click="toggleAudioRecordingNonConformity"
          :class="{ recording: recordingNonConformity }"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
            />
            <path
              d="M17 16.91c-1.48 1.46-3.51 2.36-5.7 2.36-2.19 0-4.22-.9-5.7-2.36m8.02-13.26l1.41 1.41A6.977 6.977 0 0 1 20 11h2c0-2.46-.98-4.7-2.58-6.35z"
            />
            <path d="M4.41 4.41L3 5.83A6.977 6.977 0 0 0 4 11H2c0-2.46.98-4.7 2.41-6.35z" />
            <path d="M9 18c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1z" />
          </svg>
        </button>
        <div class="audio-list">
          <div
            v-for="(audio, index) in session.nonConformityDetails?.audioNonConformity || []"
            :key="index"
            class="audio-item"
          >
            <button @click="playAudio(audio)" title="Play recording">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <span>{{ audio }}</span>
            <button
              @click="removeAudio(index, 'nonConformity')"
              :disabled="isReadOnly"
              title="Delete recording"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { computed, ref } from 'vue'
  import { useSessionStore } from '../stores/sessionStore'
  import { useEvidenceStore } from '../stores/evidenceStore'
  import { useAudioStore } from '../stores/audioStore'
  import { useToast } from 'vue-toastification'
  import trash from '../assets/images/trash.png'
  import cameraIcon from '../assets/images/camera.png'
  import fileUpload from '../assets/images/fileUpload.png'

  const props = defineProps({
    newTopic: { type: Boolean },
    questionCode: { type: String, required: true },
    row: { type: Object },
    session: { type: Object },
    readOnly: { type: Boolean, default: false },
    linkedFindingId: { type: String, default: '' },
  })

  const emit = defineEmits(['go-follow-up'])

  const toast = useToast()
  const radioButtons = ref(['Not applicable', 'Compliant', 'Non-compliant'])

  const radioColors = ref({
    'Not applicable': 'border : 3px solid #aaaaaa',
    Compliant: 'border : 3px solid #55FF55',
    'Non-compliant': 'border : 3px solid #FF5555',
  })

  const validRiskLevels = ['Low', 'Medium', 'High', 'Critical']
  const riskLevels = ref(validRiskLevels)
  const validFindingLevels = ['Non-Compliance', 'Observation', 'Recommendation']
  const findingLevels = ref(validFindingLevels)

  const normalizeFindingLevel = (value) =>
    typeof value == 'string' && validFindingLevels.includes(value) ? value : 'Non-Compliance'

  const normalizeRiskLevel = (value) =>
    typeof value == 'string' && validRiskLevels.includes(value) ? value : 'Low'

  const nominalRiskLevel = computed(() => normalizeRiskLevel(props.row?.riskLevel))

  const assignedRiskLevel = computed(() => {
    const detailsLevel = props.session?.nonConformityDetails?.riskLevel
    return normalizeRiskLevel(detailsLevel || props.row?.riskLevel)
  })

  const assignedFindingLevel = computed(() => {
    const detailsLevel = props.session?.nonConformityDetails?.findingLevel
    return normalizeFindingLevel(detailsLevel)
  })

  const nonConformityDescription = computed(
    () => props.session?.nonConformityDetails?.description || ''
  )

  const domQuestionCode = String(props.questionCode).replace(/[^A-Za-z0-9_-]/g, '-')
  const fileQuestionCode = String(props.questionCode).replace(/[^A-Za-z0-9._-]/g, '-')

  const evidenceUpload = (questionCode) => {
    const inputControl = document.getElementById('fileInput-' + questionCode)
    inputControl.click()
  }

  const evidenceName = (entry) =>
    typeof entry == 'string' ? entry : typeof entry?.name == 'string' ? entry.name : ''

  const showCameraModal = ref(false)
  const video = ref(null)
  const canvas = ref(null)

  // Normativa detail modal state
  const showNormativaModal = ref(false)
  const selectedNormativa = ref(null)
  const showNonConformityModal = ref(false)

  const openNormativa = (normativa) => {
    selectedNormativa.value = normativa
    showNormativaModal.value = true
  }

  const openNonConformityModal = () => {
    showNonConformityModal.value = true
  }

  const closeNonConformityModal = () => {
    showNonConformityModal.value = false
  }

  // Audio recording state
  const recordingComments = ref(false)
  const recordingNonConformity = ref(false)
  let mediaRecorder = null
  let audioChunks = []

  // Access the Pinia stores
  const sessionStore = useSessionStore()
  const evidenceStore = useEvidenceStore()
  const audioStore = useAudioStore()
  const isReadOnly = computed(() => props.readOnly || sessionStore.summary.finalized)
  const currentLocationId = () => sessionStore.context?.locationId || null

  const updateResponse = (field, value) => {
    sessionStore.updateSession(props.questionCode, props.row.id, field, value, props.row.code)
  }

  const updateNonConformityDetail = (field, value) => {
    const details = {
      ...(props.session?.nonConformityDetails || {}),
      [field]: value,
    }
    updateResponse('nonConformityDetails', details)
  }

  const radioChange = (event) => {
    const complianceValue = event.target.value
    updateResponse('compliance', complianceValue)

    if (complianceValue == 'Non-compliant') {
      const defaultRisk = assignedRiskLevel.value
      updateNonConformityDetail('riskLevel', defaultRisk)
      const defaultFindingLevel = assignedFindingLevel.value
      updateNonConformityDetail('findingLevel', defaultFindingLevel)
    } else {
      closeNonConformityModal()
    }
  }

  const textAreaChange = (event) => {
    updateResponse('comments', event.target.value)
  }

  const nonConformityChange = (event) => {
    updateNonConformityDetail('description', event.target.value)
  }

  const riskLevelChange = (event) => {
    const nextRiskLevel = normalizeRiskLevel(event.target.value)
    updateNonConformityDetail('riskLevel', nextRiskLevel)
  }

  const findingLevelChange = (event) => {
    const nextFindingLevel = normalizeFindingLevel(event.target.value)
    updateNonConformityDetail('findingLevel', nextFindingLevel)
  }

  const toggleAudioRecordingComments = async () => {
    if (recordingComments.value) {
      stopAudioRecording()
    } else {
      startAudioRecording('comments')
    }
  }

  const toggleAudioRecordingNonConformity = async () => {
    if (recordingNonConformity.value) {
      stopAudioRecording()
    } else {
      startAudioRecording('nonConformity')
    }
  }

  const startAudioRecording = async (field) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream)
      audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        await saveAudioRecording(audioBlob, field)
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      if (field === 'comments') {
        recordingComments.value = true
      } else {
        recordingNonConformity.value = true
      }
      toast.info('Recording started...')
    } catch (error) {
      toast.error('Could not access microphone: ' + error.message)
    }
  }

  const stopAudioRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      recordingComments.value = false
      recordingNonConformity.value = false
    }
  }

  const saveAudioRecording = async (blob, field) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `audio-${fileQuestionCode}-${field}-${timestamp}.webm`

      // Convert blob to buffer
      const buffer = await blob.arrayBuffer()

      // Save audio file through the audio store
      const locationId = currentLocationId()
      if (locationId) {
        await audioStore.add(
          sessionStore.summary.specialty,
          fileName,
          new Uint8Array(buffer),
          locationId
        )
      } else {
        await audioStore.add(sessionStore.summary.specialty, fileName, new Uint8Array(buffer))
      }

      // Add to audio list in session
      const currentAudioList = field === 'comments'
        ? [...(props.session['audioComments'] || [])]
        : [...(props.session?.nonConformityDetails?.audioNonConformity || [])]
      currentAudioList.push(fileName)

      // Update count in audio store
      audioStore.addCount(fileName)

      if (field === 'comments') {
        updateResponse('audioComments', currentAudioList)
      } else {
        updateNonConformityDetail('audioNonConformity', currentAudioList)
      }
      toast.success('Audio recording saved')
    } catch (error) {
      toast.error('Failed to save audio: ' + error.message)
    }
  }

  const playAudio = async (fileName) => {
    try {
      // Get the audio file URL from the store
      const audioURL = audioStore.files[fileName]?.URL
      if (!audioURL) {
        toast.error('Audio file not found')
        return
      }

      // Create audio element and play it
      const audio = new Audio(audioURL)
      await audio.play()
    } catch (error) {
      toast.error('Failed to play audio: ' + error.message)
    }
  }

  const removeAudio = async (index, field) => {
    const currentAudioList = field === 'comments'
      ? [...(props.session['audioComments'] || [])]
      : [...(props.session?.nonConformityDetails?.audioNonConformity || [])]
    const fileName = currentAudioList[index]

    try {
      // Delete through the audio store
      const locationId = currentLocationId()
      if (locationId) {
        await audioStore.subtract(sessionStore.summary.specialty, fileName, locationId)
      } else {
        await audioStore.subtract(sessionStore.summary.specialty, fileName)
      }

      // Remove from list
      const updatedAudioList = currentAudioList.filter((_, i) => i !== index)
      if (field === 'comments') {
        updateResponse('audioComments', updatedAudioList)
      } else {
        updateNonConformityDetail('audioNonConformity', updatedAudioList)
      }
      toast.success('Audio recording removed')
    } catch (error) {
      toast.error('Failed to delete audio: ' + error.message)
    }
  }

  const evidenceChange = async (event) => {
    const files = event.target.files
    const table = Array.isArray(props.session.evidence) ? [...props.session.evidence] : []

    for (const file of files) {
      try {
        // update the evidence file record
        const locationId = currentLocationId()
        if (locationId) {
          await evidenceStore.add(sessionStore.summary.specialty, file, locationId, 'inspection')
        } else {
          await evidenceStore.add(sessionStore.summary.specialty, file)
        }

        const inTable = table.some((item) => evidenceName(item) === file.name)

        if (inTable) {
          // it's already there
          if (evidenceStore.files[file.name].count == 0) {
            // it's a missing file. update count
            evidenceStore.addCount(file.name)
          }
        } else {
          evidenceStore.addCount(file.name)
          table.push({ name: file.name })
        }
      } catch (error) {
        console.log('evidenceChanged failed: ' + error)
        toast.error(error.message)
      }
    }

    updateResponse('evidence', table)
    toast.success('Evidence updated')
  }

  const removeEvidence = async (index, evidence) => {
    try {
      const locationId = currentLocationId()
      if (locationId) {
        await evidenceStore.subtract(sessionStore.summary.specialty, evidence, locationId, 'inspection')
      } else {
        await evidenceStore.subtract(sessionStore.summary.specialty, evidence)
      }
    } catch (error) {
      console.log('evidenceChanged failed: ' + error)
      toast.error(error.message)
    }

    const updatedEvidence = props.session.evidence.filter((_, i) => i !== index)
    updateResponse('evidence', updatedEvidence)
  }

  const openCamera = async () => {
    showCameraModal.value = true
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    video.value.srcObject = stream
  }

  const capturePhoto = async () => {
    const context = canvas.value.getContext('2d')
    canvas.value.width = video.value.videoWidth
    canvas.value.height = video.value.videoHeight
    context.drawImage(video.value, 0, 0)
    const blob = await new Promise((resolve) => canvas.value.toBlob(resolve, 'image/jpeg'))
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = new File([blob], `evidence-${fileQuestionCode}-${timestamp}.jpg`, {
      type: 'image/jpeg',
    })
    const table = Array.isArray(props.session.evidence) ? [...props.session.evidence] : []
    const locationId = currentLocationId()
    if (locationId) {
      await evidenceStore.add(sessionStore.summary.specialty, file, locationId, 'inspection')
    } else {
      await evidenceStore.add(sessionStore.summary.specialty, file)
    }
    if (!table.some((item) => evidenceName(item) === file.name)) {
      evidenceStore.addCount(file.name)
      table.push({ name: file.name })
    }
    updateResponse('evidence', table)
    toast.success('Evidence updated')
    closeCameraModal()
  }

  const closeCameraModal = () => {
    showCameraModal.value = false
    if (video.value.srcObject) {
      video.value.srcObject.getTracks().forEach((track) => track.stop())
    }
  }
</script>

<style scoped>
  .row-read-only {
    background-color: #f0f0f0;
    opacity: 0.85;
  }

  .followup-link {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: #0b57d0;
    background: transparent;
    border: 1px solid #0b57d0;
    border-radius: 10px;
    padding: 0.15rem 0.4rem;
    cursor: pointer;
  }

  .nc-modal-trigger {
    width: 100%;
    margin-top: 0.35rem;
    border: 1px solid #1e88e5;
    background: #fff;
    color: #1e88e5;
    border-radius: 6px;
    padding: 0.3rem 0.45rem;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .nc-summary {
    margin-top: 0.35rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }

  .risk-pill {
    background: #e8f1fb;
    color: #0d4d8b;
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    font-size: 0.72rem;
    font-weight: 600;
  }

  .nc-summary-text {
    font-size: 0.72rem;
    color: #555;
  }

  .non-conformity-meta {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .risk-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }

  .risk-label {
    font-weight: 600;
    color: #3f3f3f;
  }

  .nominal-risk .risk-value {
    font-weight: 600;
    color: #0d4d8b;
  }

  .risk-row select {
    min-width: 8rem;
    border: 1px solid #c7c7c7;
    border-radius: 4px;
    padding: 0.2rem 0.4rem;
    background: #fff;
  }

  .missing a {
    color: red;
  }

  .camera-button {
    border: none;
    color: white;
    padding: 0;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: all 0.3s ease;
    box-shadow: 0 4px 8px rgba(30, 136, 229, 0.2);
  }

  .camera-button:disabled {
    background-color: #90caf9;
    cursor: not-allowed;
    box-shadow: none;
  }

  .camera-button:hover:not(:disabled) {
    background-color: #1565c0;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(30, 136, 229, 0.3);
  }

  .upload-buttons {
    display: flex;
    flex-flow: row wrap;
    justify-content: space-evenly;
  }

  .upload-buttons input {
    box-shadow: 0 4px 8px rgba(30, 136, 229, 0.2);
  }

  .upload-buttons input:hover:not(:disabled) {
    background-color: #1565c0;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(30, 136, 229, 0.3);
  }

  .upload-buttons input:disabled {
    background-color: #b0eaf9;
    cursor: not-allowed;
    box-shadow: none;
  }

  .camera-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  video {
    width: 80%;
    max-width: 640px;
  }

  .audio-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .audio-controls button {
    background: #1e88e5;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.9rem;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(30, 136, 229, 0.2);
  }

  .audio-controls button:hover:not(:disabled) {
    background: #1565c0;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(30, 136, 229, 0.3);
  }

  .audio-controls button:disabled {
    background: #90caf9;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .audio-controls button.recording {
    background: #d32f2f;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .audio-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .audio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f5f5f5;
    padding: 6px 8px;
    border-radius: 3px;
    font-size: 0.85rem;
  }

  .audio-item button {
    background: none;
    border: none;
    padding: 2px;
    color: #1e88e5;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: color 0.2s;
  }

  .audio-item button:hover {
    color: #1565c0;
  }

  .audio-item button:disabled {
    color: #90caf9;
    cursor: not-allowed;
  }

  .audio-item span {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ref-label {
    font-weight: 600;
    font-size: 0.75rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .normativa-link {
    background: none;
    border: none;
    padding: 0;
    color: #1e88e5;
    cursor: pointer;
    font-size: inherit;
    text-align: left;
    text-decoration: underline;
  }

  .normativa-link:hover {
    color: #1565c0;
  }

  .normativa-modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .normativa-modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 480px;
    max-width: 90vw;
    padding: 24px;
  }

  .normativa-modal h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .normativa-texto {
    white-space: pre-wrap;
    font-size: 0.9rem;
    color: #444;
    margin-top: 8px;
  }

  .normativa-modal button {
    margin-top: 16px;
    background-color: #1e88e5;
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  }

  .normativa-modal button:hover {
    background-color: #1565c0;
  }

  .nc-modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 120;
  }

  .nc-modal {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 560px;
    max-width: 92vw;
    padding: 18px;
    display: grid;
    gap: 10px;
  }

  .nc-modal textarea {
    min-height: 120px;
    resize: vertical;
  }

  .nc-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .nc-modal-header h3 {
    margin: 0;
  }

  .nc-close {
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 6px;
    padding: 0.35rem 0.65rem;
    cursor: pointer;
  }
</style>
