<template>
  <tr v-if="newTopic" class="full-span">
    <td colspan="8">{{ row.topic }}</td>
  </tr>
  <tr>
    <td hidden>{{ row.id }}</td>
    <td :id="`qnumber-${qnumber}`">{{ qnumber }}</td>
    <td>{{ row.reference }}</td>
    <td class="question">{{ row.question }}</td>
    <td class="verification">{{ row.verification }}</td>
    <td class="compliance" :style="radioColors[session.compliance]">
      <label v-for="(radioBtn, index) in radioButtons" :key="index">
        <input
          type="radio"
          :name="`compliance-${qnumber}`"
          :value="radioBtn"
          :disabled="sessionStore.summary.finalized"
          :checked="session.compliance === radioBtn"
          @change="radioChange($event)"
        />
        {{ radioBtn }}
        <br />
      </label>
      <div class="non-conformity" :hidden="session.compliance != 'Non-compliant'">
        <textarea
          :name="`nonConformity-${qnumber}`"
          :value="session.nonConformity"
          :disabled="sessionStore.summary.finalized"
          placeholder="Describa la no conformidad"
          @input="nonConformityChange($event)"
        ></textarea>
      </div>
    </td>
    <td class="comments">
      <textarea
        :name="`comments-${qnumber}`"
        :value="session.comments"
        :disabled="sessionStore.summary.finalized"
        @input="textAreaChange($event)"
      ></textarea>
    </td>
    <td class="evidence">
      <div class="upload-buttons">
        <input
          :id="`fileInput-${qnumber}`"
          style="width: 100%"
          type="file"
          hidden
          class="evidence-upload"
          :name="`evidence-${qnumber}`"
          :disabled="sessionStore.summary.finalized"
          multiple
          @change="evidenceChange($event)"
        />
        <input
          type="image"
          :src="fileUpload"
          height="30"
          width="30"
          :disabled="sessionStore.summary.finalized"
          @click="evidenceUpload(qnumber)"
        />
        <input
          type="image"
          :id="`cameraInput-${qnumber}`"
          :src="cameraIcon"
          height="30"
          width="30"
          :disabled="sessionStore.summary.finalized"
          @click="openCamera"
        />
      </div>
      <table class="preview" :id="`evidencetable-${qnumber}`">
        <tr v-for="(evidence, index) in session.evidence" :key="index">
          <td>
            <input
              type="image"
              :src="trash"
              height="15"
              width="15"
              :disabled="sessionStore.summary.finalized"
              @click="removeEvidence(index, evidence)"
            />
          </td>
          <td :class="{ missing: evidenceStore.files[evidence]?.URL == '' }">
            <a :href="evidenceStore.files[evidence]?.URL" download target="_blank">
              {{ evidenceStore.files[evidence]?.count }}{{ evidence }}
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
</template>

<script setup>
  import { ref } from 'vue'
  import { useSessionStore } from '../stores/sessionStore'
  import { useEvidenceStore } from '../stores/evidenceStore'
  import { useToast } from 'vue-toastification'
  import trash from '../images/trash.png'
  import cameraIcon from '../images/camera.png'
  import fileUpload from '../images/fileUpload.png'

  const props = defineProps({
    newTopic: { type: Boolean },
    qnumber: { type: Number },
    row: { type: Object },
    session: { type: Object },
  })

  const toast = useToast()
  const radioButtons = ref(['Not applicable', 'Compliant', 'Non-compliant'])

  const radioColors = ref({
    'Not applicable': 'border : 3px solid #aaaaaa',
    Compliant: 'border : 3px solid #55FF55',
    'Non-compliant': 'border : 3px solid #FF5555',
  })

  const evidenceUpload = (qnumber) => {
    const inputControl = document.getElementById('fileInput-' + qnumber)
    inputControl.click()
  }

  const showCameraModal = ref(false)
  const video = ref(null)
  const canvas = ref(null)

  // Access the Pinia store
  const sessionStore = useSessionStore()
  const evidenceStore = useEvidenceStore()

  const radioChange = (event) => {
    sessionStore.updateSession(props.qnumber, props.row.id, 'compliance', event.target.value)
  }

  const textAreaChange = (event) => {
    sessionStore.updateSession(props.qnumber, props.row.id, 'comments', event.target.value)
  }

  const nonConformityChange = (event) => {
    sessionStore.updateSession(props.qnumber, props.row.id, 'nonConformity', event.target.value)
  }

  const evidenceChange = async (event) => {
    const files = event.target.files
    const table = props.session.evidence || []

    for (const file of files) {
      try {
        // update the evidence file record
        await evidenceStore.add(sessionStore.summary.specialty, file)

        const inTable = table.some((item) => item === file.name)

        if (inTable) {
          // it's already there
          if (evidenceStore.files[file.name].count == 0) {
            // it's a missing file. update count
            evidenceStore.addCount(file.name)
          }
        } else {
          evidenceStore.addCount(file.name)
          table.push(file.name)
        }
      } catch (error) {
        console.log('evidenceChanged failed: ' + error)
        toast.error(error.message)
      }
    }

    sessionStore.updateSession(props.qnumber, props.row.id, 'evidence', table)
    toast.success('Evidence updated')
  }

  const removeEvidence = async (index, evidence) => {
    try {
      await evidenceStore.subtract(sessionStore.summary.specialty, evidence)
    } catch (error) {
      console.log('evidenceChanged failed: ' + error)
      toast.error(error.message)
    }

    const updatedEvidence = props.session.evidence.filter((_, i) => i !== index)
    sessionStore.updateSession(props.qnumber, props.row.id, 'evidence', updatedEvidence)
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
    const file = new File([blob], `evidence-${props.qnumber}-${timestamp}.jpg`, {
      type: 'image/jpeg',
    })
    const table = props.session.evidence || []
    await evidenceStore.add(sessionStore.summary.specialty, file)
    if (!table.some((item) => item === file.name)) {
      evidenceStore.addCount(file.name)
      table.push(file.name)
    }
    sessionStore.updateSession(props.qnumber, props.row.id, 'evidence', table)
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
</style>
