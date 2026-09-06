import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

import App from './App.vue'
import i18n from './i18n/index.js'

const app = createApp(App)
const options = {
  timeout: 3000, // You can set your default options here
}

app.use(createPinia())
app.use(Toast, options)
app.use(i18n)
app.mount('#app')
