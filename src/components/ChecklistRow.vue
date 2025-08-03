<template>
  <tr v-if="row.subtitle" class="full-span">
    <td colspan="8">{{ row.subtitle }}</td>
  </tr>
  <tr v-else>
    <td :id="`qnumber-${qnumber}`">{{ qnumber }}</td>
    <td>{{ row.reference }}</td>
    <td>{{ row.question }}</td>
    <td>
      <input
        type="checkbox"
        :name="`notapplicable-${qnumber}`"
        :checked="session.notapplicable"
        @change="checkboxChange($event)" 
      />
    </td>
    <td>{{ row.verification }}</td>
    <td class="compliance">
      <label>
        <input
          type="radio"
          :name="`compliance-${qnumber}`"
          value="Compliant"
          :checked="session.compliance === 'Compliant'"
          @change="radioChange($event)"
        /> Compliant
      </label><br>
      <label>
        <input
          type="radio"
          :name="`compliance-${qnumber}`"
          value="Partial Compliance"
          :checked="session.compliance === 'Partial Compliance'"
          @change="radioChange($event)"
        /> Partial Compliance
      </label><br>
      <label>
        <input
          type="radio"
          :name="`compliance-${qnumber}`"
          value="Non-compliant"
          :checked="session.compliance === 'Non-compliant'"
          @change="radioChange($event)"
        /> Non-compliant
      </label>
    </td>
    <td class="comments">
      <textarea
        :name="`comments-${qnumber}`"
        :value="session.comments"
        @input="textAreaChange($event)"
      ></textarea>
    </td>
    <td class="evidence">
      <input
        type="file"
        class="evidence-upload"
        :name="`evidence-${qnumber}`"
        multiple
        @change="evidenceChange($event)"
      />
      <table class="preview" :id="`evidencetable-${qnumber}`">
        <tr v-for="(evidence, index) in session.evidence" :key="index">
          <td>
            <button type="button" @click="removeEvidence(index, evidence)">❌</button>
          </td>
          <td>
            <a :href="evidence" :download="evidence.split(/[\\/]/).pop()" target="_blank">{{
              evidence.split(/[\\/]/).pop()
            }}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps(['qnumber', 'row', 'session']);
const emit = defineEmits(['update-session']);

const checkboxChange = (event) => {
  emit('update-session', props.qnumber, 'notapplicable', event.target.checked);
};

const radioChange = (event) => {
  emit('update-session', props.qnumber, 'compliance', event.target.value);
};

const textAreaChange = (event) => {
  emit('update-session', props.qnumber, 'comments', event.target.value);
};

const evidenceChange = async (event) => {
  const files = event.target.files;
  const table = [];
  for (const file of files) {
    const fileInfo = await window.electronAPI.validateEvidence({ name: file.name, size: file.size });
    const isInTable = table.some((item) => item.name === file.name);
    let savedPath = null;

    if (!fileInfo.fileExists || !fileInfo.fileIsSame) {
      const buffer = await file.arrayBuffer();
      savedPath = await window.electronAPI.saveEvidence(
        Array.from(new Uint8Array(buffer)),
        file.name
      );
    }

    if (!isInTable) {
      const path = fileInfo.fileExists
        ? table.find((item) => item.name === file.name)?.path || savedPath
        : savedPath;
      table.push({ name: file.name, path });
    }
  }

  emit('update-session', props.qnumber, 'evidence', table.map((item) => item.path));
};

const removeEvidence = async (index, evidence) => {
  const fileName = evidence.split(/[\\/]/).pop();
  const anchors = document.querySelectorAll('a');
  const linkCount = Array.from(anchors).filter((a) => a.textContent === fileName).length;

  if (linkCount === 1) {
    await window.electronAPI.deleteEvidence(fileName);
  }

  const updatedEvidence = props.session.evidence.filter((_, i) => i !== index);
  emit('update-session', props.qnumber, 'evidence', updatedEvidence);
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
  background-color: #1e88e5;
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
</style>
