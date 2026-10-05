import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import en from './en.json'
import zh from './zh.json'
import { syncMarkstreamI18n } from './markstream'

export const i18n = createI18n({
  locale: 'en',
  legacy: false,
  messages: {
    en,
    zh,
  },
})

// markstream 内置文案跟随语言切换
watch(i18n.global.locale, () => syncMarkstreamI18n(i18n.global.locale.value), { immediate: true })
