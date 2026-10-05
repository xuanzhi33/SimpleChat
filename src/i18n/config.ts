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
  // 时间戳统一走 d()：可见的钟点用语言自己的时制（zh 24 小时制 / en AM-PM），
  // tooltip 里的完整时间交给 Intl 的 dateStyle/timeStyle 按语言排
  datetimeFormats: {
    en: {
      time: { hour: '2-digit', minute: '2-digit' },
      dateTime: { dateStyle: 'full', timeStyle: 'short' },
    },
    zh: {
      time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
      dateTime: { dateStyle: 'full', timeStyle: 'short' },
    },
  },
})

// markstream 内置文案跟随语言切换
watch(i18n.global.locale, () => syncMarkstreamI18n(i18n.global.locale.value), { immediate: true })
