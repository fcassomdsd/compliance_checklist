<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-container">
      <h2 class="modal-title">{{ titulo }}?</h2>
      <p class="modal-explanation">
        {{ explanation }}
      </p>
      <p class="modal-confirmation">
        Do you want to {{ accion }}?
      </p>

      <div class="modal-actions">
        <button @click="$emit('cancel')" class="btn-cancel">
          Cancel
        </button>
        <button @click="$emit('confirm')" class="btn-confirm">
          Yes, Continue
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    required: true
  },
  titulo: { type: String },
  explanation: { type: String },
  accion: { type: String }
  
})

</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 50;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  width: 380px;
  padding: 24px;
  text-align: center;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.modal-explanation {
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 12px;
}

.modal-confirmation {
  font-size: 1.1rem;
  color: #733;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
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

.btn-cancel {
  border-radius: 8px;
  transition: background 0.2s;

}
.btn-cancel:hover {
  background: #1565c0;
}

.btn-confirm {
  border-radius: 8px;
  background: #d32f2f;
  transition: background 0.2s;
}
.btn-confirm:hover {
  background: #b71c1c;
}

</style>
