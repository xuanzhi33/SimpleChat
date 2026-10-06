import { reactive } from 'vue'
import en from './en.json'
import zh from './zh.json'
import zhHant from './zh-hant.json'

/**
 * markstream-vue 内置 UI 文案（代码块按钮、图片占位等）的覆盖表。
 *
 * 库只提供"替换文案"的钩子、不管理语言，所以切换语言时由我们刷新它；
 * 用 reactive 对象注入，文案变化时渲染器会自己重渲染，不必重建组件。
 */
export const markstreamI18n = reactive<Record<string, string>>({})

const tables: Record<string, Record<string, string>> = {
  en: en.markstream,
  zh: zh.markstream,
  'zh-hant': zhHant.markstream,
}

/** 按当前语言刷新覆盖表 */
export function syncMarkstreamI18n(locale: string) {
  Object.assign(markstreamI18n, tables[locale] ?? tables.en)
}
