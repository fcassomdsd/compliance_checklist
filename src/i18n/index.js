import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import es from './locales/es.json'

export const SUPPORTED_LOCALES = ['en', 'es']
export const DEFAULT_LOCALE = 'en'

export function normalizeLocale(value) {
  const short = String(value || '').slice(0, 2).toLowerCase()
  return SUPPORTED_LOCALES.includes(short) ? short : DEFAULT_LOCALE
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, es },
})

export default i18n
