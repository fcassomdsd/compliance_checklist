import { config } from '@vue/test-utils'
import i18n from '../i18n/index.js'

// Component tests use useI18n() inside <script setup>, which needs the
// vue-i18n plugin installed on the mounting app — register it once globally
// here rather than in every individual test file's mount() options.
config.global.plugins.push(i18n)
