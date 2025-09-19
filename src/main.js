import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";

import App from './App.vue';

const app = createApp(App);
const options = {
  timeout : 3000    // You can set your default options here
};

app.use(Toast, options);
app.use(createPinia());
app.mount('#app');
