import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: ref('en'), t: (k: string) => k }) }))

import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/theme-color'
import { useSettingsStore } from '@/stores/settings'

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('增删改模型', () => {
    const store = useSettingsStore()
    const m = store.addModel('GPT', 'http://a/v1')
    store.updateModel(m.id, 'GPT-2', 'http://b/v1')
    expect(store.models[0]).toMatchObject({ name: 'GPT-2', baseUrl: 'http://b/v1' })
    store.deleteModel(m.id)
    expect(store.models).toHaveLength(0)
  })

  it('删除默认模型后自动改选第一个', () => {
    const store = useSettingsStore()
    const a = store.addModel('a', 'http://a')
    const b = store.addModel('b', 'http://b')
    store.defaultModelId = a.id
    store.deleteModel(a.id)
    expect(store.defaultModelId).toBe(b.id)
  })

  it('defaultModel 回退到 models[0]', () => {
    const store = useSettingsStore()
    store.addModel('only', 'http://a')
    expect(store.defaultModel?.name).toBe('only')
  })

  it('保存 api 模式字段，切回 gate 时清除', () => {
    const store = useSettingsStore()
    const m = store.addModel('GPT', 'http://a', { kind: 'api', model: 'gpt-4o', apiKey: 'sk-1' })
    expect(store.models[0]).toMatchObject({ kind: 'api', model: 'gpt-4o', apiKey: 'sk-1' })

    store.updateModel(m.id, 'GPT', 'http://a', { kind: 'gate' })
    expect(store.models[0]?.kind).toBe('gate')
    expect(store.models[0]?.model).toBeUndefined()
    expect(store.models[0]?.apiKey).toBeUndefined()
  })

  it('默认跟随系统，切换主题时同步 theme-color', () => {
    const store = useSettingsStore()
    expect(store.colorMode).toBe('system')

    document.head.innerHTML = '<meta name="theme-color" content="" />'
    store.colorMode = 'dark'
    store.applyColorMode()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      THEME_COLOR_DARK,
    )

    store.colorMode = 'light'
    store.applyColorMode()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      THEME_COLOR_LIGHT,
    )
  })

  it('系统提示词预设：新存的放最前，内容相同不重复存', () => {
    const store = useSettingsStore()
    store.addSystemPromptPreset('A', '内容一')
    store.addSystemPromptPreset('B', '内容二')
    expect(store.systemPromptPresets.map((p) => p.name)).toEqual(['B', 'A'])

    // 同一个提示词只留一条（换个名字也不算新的）
    store.addSystemPromptPreset('B2', '内容二')
    expect(store.systemPromptPresets).toHaveLength(2)
    expect(store.systemPromptPresets[0]?.name).toBe('B')
  })

  it('系统提示词预设：删除；重置设置时一并清空', () => {
    const store = useSettingsStore()
    const preset = store.addSystemPromptPreset('A', '内容一')
    store.deleteSystemPromptPreset(preset.id)
    expect(store.systemPromptPresets).toHaveLength(0)

    store.addSystemPromptPreset('B', '内容二')
    store.resetSettings()
    expect(store.systemPromptPresets).toHaveLength(0)
  })
})
