import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: ref('en'), t: (k: string) => k }) }))

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
})
