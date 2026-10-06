import { describe, it, expect } from 'vitest'
import en from '@/i18n/en.json'
import zh from '@/i18n/zh.json'
import zhHant from '@/i18n/zh-hant.json'
import { i18n } from '@/i18n/config'

type Tree = { [key: string]: string | Tree }

/** 把嵌套的文案树拍平成 "a.b.c" -> "文案" */
const flatten = (tree: Tree, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[path] = value
    else Object.assign(out, flatten(value, path))
  }
  return out
}

/** 文案里的 {占位符}，排序后用于比对 */
const placeholders = (value: string) =>
  Array.from(value.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort()

const locales: Record<string, Tree> = { en, zh, 'zh-hant': zhHant }
const flat: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(locales).map(([locale, tree]) => [locale, flatten(tree)]),
)
const localeNames = Object.keys(flat)

/** 断言失败时把语言和键带出来，而不是只报 "expected ... to equal ..." */
const byLocale = <T>(pick: (messages: Record<string, string>) => T) =>
  Object.fromEntries(localeNames.map((locale) => [locale, pick(flat[locale]!)]))

describe('多语言文案', () => {
  it('各语言文件的键完全一致', () => {
    const keys = Object.keys(flat.en!).sort()
    expect(keys.length).toBeGreaterThan(0)
    expect(byLocale((messages) => Object.keys(messages).sort())).toEqual(byLocale(() => keys))
  })

  it('文案不为空，且同一键的占位符在各语言里一致', () => {
    const empty = localeNames.flatMap((locale) =>
      Object.entries(flat[locale]!)
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => `${locale}.${key}`),
    )
    expect(empty).toEqual([])

    const expected = byLocale((messages) =>
      Object.fromEntries(
        Object.entries(messages).map(([key, value]) => [key, placeholders(value)]),
      ),
    )
    // 以英文那份为基准，逐语言比对占位符
    expect(expected).toEqual(Object.fromEntries(localeNames.map((locale) => [locale, expected.en])))
  })

  it('语言选择器能列出全部语言，且每种语言都有名字', () => {
    expect([...i18n.global.availableLocales].sort()).toEqual(['en', 'zh', 'zh-hant'])

    const missing = i18n.global.availableLocales.flatMap((locale) =>
      localeNames
        .filter((name) => !flat[name]![`settings.interface.languageOptions.${locale}`])
        .map((name) => `${name}.${locale}`),
    )
    expect(missing).toEqual([])
  })
})
