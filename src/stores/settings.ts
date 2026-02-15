import { usePreferredDark, usePreferredLanguages, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Model } from '@/types/chat'

export type ColorMode = 'light' | 'dark' | 'system'

export const LOCAL_STORAGE_KEY_PREFIX = 'xuanzhi33-'

export const useSettingsStore = defineStore('settings', () => {
  const browserDark = usePreferredDark()
  const browserLanguages = usePreferredLanguages()
  const { locale, t } = useI18n()

  const preferZh = computed(() =>
    browserLanguages.value.some((lang) => lang.startsWith('zh') || lang.startsWith('cn')),
  )

  // 使用 useStorage 自动持久化
  const language = useStorage(LOCAL_STORAGE_KEY_PREFIX + 'language', preferZh.value ? 'zh' : 'en')

  const colorMode = useStorage<ColorMode>(LOCAL_STORAGE_KEY_PREFIX + 'color-mode', 'system')

  // 上下文长度（发送给LLM的历史记录条数，0表示不限制）
  const contextLength = useStorage<number>(LOCAL_STORAGE_KEY_PREFIX + 'context-length', 10)

  // 模型列表
  const models = useStorage<Model[]>(LOCAL_STORAGE_KEY_PREFIX + 'models', [])

  // 默认模型ID
  const defaultModelId = useStorage<string>(LOCAL_STORAGE_KEY_PREFIX + 'default-model-id', '')

  // 获取默认模型
  const defaultModel = computed(() => {
    return models.value.find((m) => m.id === defaultModelId.value) || models.value[0]
  })

  // 添加模型
  const addModel = (name: string, baseUrl: string) => {
    const newModel: Model = {
      id: Date.now().toString(),
      name,
      baseUrl,
    }
    models.value.push(newModel)
    return newModel
  }

  // 更新模型
  const updateModel = (id: string, name: string, baseUrl: string) => {
    const model = models.value.find((m) => m.id === id)
    if (model) {
      model.name = name
      model.baseUrl = baseUrl
    }
  }

  // 删除模型
  const deleteModel = (id: string) => {
    const index = models.value.findIndex((m) => m.id === id)
    if (index !== -1) {
      models.value.splice(index, 1)
      // 如果删除的是默认模型，选择第一个作为默认模型
      if (defaultModelId.value === id && models.value.length > 0) {
        defaultModelId.value = models.value[0]?.id || ''
      }
    }
  }

  const isDarkMode = computed(() => {
    if (colorMode.value === 'dark') return true
    if (colorMode.value === 'light') return false
    return browserDark.value
  })

  const applyColorMode = () => {
    document.documentElement.classList.toggle('dark', isDarkMode.value)
  }

  watch(isDarkMode, applyColorMode)

  const applyLanguage = () => {
    locale.value = language.value
    document.title = t('common.title')
  }

  watch(language, applyLanguage)

  const resetSettings = () => {
    colorMode.value = 'system'
    language.value = preferZh.value ? 'zh' : 'en'
    contextLength.value = 10
    models.value = []
    defaultModelId.value = ''
    applyColorMode()
    applyLanguage()
  }

  return {
    colorMode,
    isDarkMode,
    language,
    contextLength,
    models,
    defaultModelId,
    defaultModel,
    addModel,
    updateModel,
    deleteModel,
    applyColorMode,
    applyLanguage,
    resetSettings,
  }
})
