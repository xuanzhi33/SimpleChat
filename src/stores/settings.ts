import { usePreferredDark, usePreferredLanguages, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyThemeColor } from '@/lib/theme-color'
import type { Model, ModelExtra, SystemPromptPreset } from '@/types/chat'

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
  const addModel = (name: string, baseUrl: string, extra: ModelExtra = {}) => {
    const newModel: Model = {
      id: Date.now().toString(),
      name,
      baseUrl,
      ...extra,
    }
    models.value.push(newModel)
    return newModel
  }

  // 更新模型
  const updateModel = (id: string, name: string, baseUrl: string, extra: ModelExtra = {}) => {
    const model = models.value.find((m) => m.id === id)
    if (model) {
      model.name = name
      model.baseUrl = baseUrl
      // 显式赋值，切回 gate 模式时会清掉 api 模式的字段
      model.kind = extra.kind
      model.model = extra.model
      model.apiKey = extra.apiKey
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

  // 系统提示词预设：全局共用，跨对话（和模型列表一样存 localStorage）
  const systemPromptPresets = useStorage<SystemPromptPreset[]>(
    LOCAL_STORAGE_KEY_PREFIX + 'system-prompt-presets',
    [],
  )

  // 同一个提示词只留一条：内容完全相同就直接复用已有的，不再存一份
  const addSystemPromptPreset = (name: string, content: string) => {
    const existing = systemPromptPresets.value.find((preset) => preset.content === content)
    if (existing) return existing
    // 新存的放最前，刚存完就能直接用
    const preset: SystemPromptPreset = { id: Date.now().toString(), name, content }
    systemPromptPresets.value.unshift(preset)
    return preset
  }

  const deleteSystemPromptPreset = (id: string) => {
    const index = systemPromptPresets.value.findIndex((preset) => preset.id === id)
    if (index !== -1) systemPromptPresets.value.splice(index, 1)
  }

  const isDarkMode = computed(() => {
    if (colorMode.value === 'dark') return true
    if (colorMode.value === 'light') return false
    return browserDark.value
  })

  const applyColorMode = () => {
    document.documentElement.classList.toggle('dark', isDarkMode.value)
    // 地址栏 / 已安装应用的标题栏跟着应用内主题走，不看系统（用 meta 覆盖 manifest 的静态值）
    applyThemeColor(isDarkMode.value)
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
    systemPromptPresets.value = []
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
    systemPromptPresets,
    addSystemPromptPreset,
    deleteSystemPromptPreset,
    applyColorMode,
    applyLanguage,
    resetSettings,
  }
})
