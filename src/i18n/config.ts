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
      // en 用 12 小时制且不带前导零（2:05 PM），跟 tooltip 的 timeStyle: 'short' 一致
      time: { hour: 'numeric', minute: '2-digit' },
      date: { year: 'numeric', month: 'numeric', day: 'numeric' },
      dateTimeWithYear: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      },
      dateTime: { dateStyle: 'full', timeStyle: 'short' },
    },
    zh: {
      time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
      date: { year: 'numeric', month: 'numeric', day: 'numeric' },
      // month: 'long' 在 zh 的 CLDR 模式里就是「3月」（不是「三月」），合起来是 2024年3月5日 14:05
      dateTimeWithYear: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      },
      dateTime: { dateStyle: 'full', timeStyle: 'short' },
    },
  },
})

// markstream 内置文案跟随语言切换
watch(i18n.global.locale, () => syncMarkstreamI18n(i18n.global.locale.value), { immediate: true })
