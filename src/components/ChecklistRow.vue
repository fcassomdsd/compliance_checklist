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
    <td class="compliance">
      <label v-for="(radioBtn, index) in radioButtons" :key="index">
        <input
          type="radio"
          :name="`compliance-${qnumber}`"
          :value="radioBtn"
          :disabled="store.sessionSummary.finalized"
          :checked="session.compliance === radioBtn"
          @change="radioChange($event)"
        /> {{ radioBtn }}<br>
      </label>
    </td>
    <td class="comments">
      <textarea
        :name="`comments-${qnumber}`"
        :value="session.comments"
        :disabled="store.sessionSummary.finalized"
        @input="textAreaChange($event)"
      ></textarea>
    </td>
    <td class="evidence">
      <input
        type="file"
        class="evidence-upload"
        :name="`evidence-${qnumber}`"
        :disabled="store.sessionSummary.finalized"
        multiple
        @change="evidenceChange($event)"
      />
      <table class="preview" :id="`evidencetable-${qnumber}`">
        <tr v-for="(evidence, index) in session.evidence" :key="index">
          <td>
            <input type="image" :src="trash" height="15" width="15" :disabled="store.sessionSummary.finalized" @click="removeEvidence(index, evidence)" />
          </td>
          <td :class="{ 'missing' : !(evidenceStore.files[evidence]) }" >
            <a :href="evidenceStore.files[evidence]?.URL" target="_blank">{{ evidenceStore.files[evidence]?.count }}{{
               evidence
            }}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</template>

<script setup>
import { ref} from 'vue';
import { useChecklistStore } from '../stores/checklistStore';
import { useEvidenceStore } from '../stores/evidenceStore';
import { useToast } from 'vue-toastification';
import trash from '../images/trash.png';

const toast = useToast();
const radioButtons = ref(["Not applicable", "Compliant", "Partial Compliance", "Non-compliant"]);

// Access the Pinia store
const store = useChecklistStore();
const evidenceStore = useEvidenceStore();
const props = defineProps({
  newTopic : { type : Boolean },
  qnumber : { type : Number },
  row : { type : Object},
  session : { type : Object }
 });

const radioChange = (event) => {
  store.updateSession(props.qnumber, props.row.id, 'compliance', event.target.value);
};

const textAreaChange = (event) => {
  store.updateSession(props.qnumber, props.row.id, 'comments', event.target.value);
};

const evidenceChange = async (event) => {

  const files = event.target.files;
  const table = props.session.evidence || [];

  for (const file of files) {

    try {

      // update the evidence file record
      await evidenceStore.add(store.specialty, file);

      if (!table.some((item) => item === file.name)) {
        evidenceStore.addCount(file.name);
        table.push(file.name);
      }
    } catch (error) {
      console.log("evidenceChanged failed: " + error);
      toast.error(error.message);
    }
      
  }
  
  store.updateSession(props.qnumber, props.row.id, 'evidence', table);
  toast.success("Evidence updated");
};

const removeEvidence = async (index, evidence) => {

    try {
      await evidenceStore.subtract(store.specialty, evidence);
    } catch(error) {
      console.log("evidenceChanged failed: " + error);
      toast.error(error.message);
    }

  const updatedEvidence = props.session.evidence.filter((_, i) => i !== index);
  store.updateSession(props.qnumber, props.row.id, 'evidence', updatedEvidence);
};

</script>

<style scoped>
.full-span {
  background-color: #e3f2fd;
  font-weight: bold;
  text-align: center;
  color: #0d47a1;
}
.preview td {
  font-size: 0.9em;
  color: #1565c0;
  margin: 1px;
  padding: 2px;
}
.preview button {
  background-color: #ffffff;
  border: none;
  color: white;
  padding: 2px;
  margin: 1px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
textarea {
  width: 100%;
  height: 60px;
  resize: vertical;
}
.compliance {
  width: 15%;
}
.comments {
  width: 15%;
}
.evidence {
  width: 15%;
}

.missing a {
  color: red;
}

</style>
