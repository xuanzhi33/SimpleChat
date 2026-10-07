import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { providerList, type ProviderPreset } from '@/configs/providers'
import { isLikelyCorsError } from '@/lib/chat-service'
import { describeError } from '@/lib/errors'
import { fetchModelList, modelDisplayName, modelNameFromId, type RemoteModel } from '@/lib/models'
import type { ModelExtra, ModelKind } from '@/types/chat'

/** Base URL 下拉框里「自定义（OpenAI 兼容）」的取值；其余取值都等于 providerList 里的 name */
export const CUSTOM_PROVIDER_ID = 'custom'

/** 模型 ID 的两种填法：从 /models 列表里选，或者手写 */
export type ModelSource = 'list' | 'manual'

/** 校验通过就能直接建模型；不通过则带一个 i18n 键出去让调用方 toast */
export type ModelDraft =
  | { ok: true; name: string; baseUrl: string; extra: ModelExtra }
  | { ok: false; errorKey: string }

/**
 * 「克隆模型」时带进新增表单的预填值，只带新增表单里真正存在的字段。
 * （编辑表单里的「模型名称」新增表单没有 —— 新模型的名称由模型 ID 推导。）
 */
export type ModelPrefill = {
  kind: ModelKind
  baseUrl: string
  modelId?: string
  apiKey?: string
}

/**
 * 「一个 API 模型」的表单状态：服务商 / Base URL / API Key / 模型 ID。
 *
 * 从欢迎弹窗里抽出来的，模型管理那套表单之后也复用它（两边字段和校验规则完全一样）。
 * 这里只管状态和请求，不碰 settingsStore，也不弹 toast —— 那些留给调用方。
 */
export function useApiModelForm() {
  const { t } = useI18n()

  const providerId = ref<string>(CUSTOM_PROVIDER_ID)
  // 用户自己填的地址单独存着，切到预设再切回来时不会丢
  const customBaseUrl = ref('')
  const apiKey = ref('')

  const modelSource = ref<ModelSource>('list')
  const manualModelId = ref('')
  const selectedModel = ref<RemoteModel | null>(null)
  const models = ref<RemoteModel[]>([])
  const isLoadingModels = ref(false)
  const modelsError = ref('')

  const provider = computed<ProviderPreset | undefined>(() =>
    providerList.find((item) => item.name === providerId.value),
  )

  // 选了预设就用预设地址（输入框 disabled，不让改），自定义才可编辑
  const baseUrl = computed({
    get: () => provider.value?.url ?? customBaseUrl.value,
    set: (value: string) => {
      customBaseUrl.value = value
    },
  })

  // 下拉框绑的是 id，选中模型对象由它反推，避免两处状态
  const selectedModelId = computed({
    get: () => selectedModel.value?.id ?? '',
    set: (id: string) => {
      selectedModel.value = models.value.find((model) => model.id === id) ?? null
    },
  })

  const modelId = computed(() =>
    modelSource.value === 'manual' ? manualModelId.value.trim() : (selectedModel.value?.id ?? ''),
  )

  const canLoadModels = computed(() => !!baseUrl.value.trim() && !isLoadingModels.value)

  const clearModels = () => {
    models.value = []
    selectedModel.value = null
    modelsError.value = ''
  }

  // 换了接口地址或 Key，之前拿到的列表就不算数了
  watch([baseUrl, apiKey], clearModels)

  /** 请求 /models。失败把原因留在 modelsError 里，交给下面的输入框旁边展示 */
  const loadModels = async () => {
    const url = baseUrl.value.trim()
    if (!url || isLoadingModels.value) return

    isLoadingModels.value = true
    modelsError.value = ''
    try {
      models.value = await fetchModelList({
        baseUrl: url,
        apiKey: apiKey.value.trim() || undefined,
      })
      selectedModel.value = null
      if (!models.value.length) modelsError.value = t('setup.api.modelsEmpty')
    } catch (error) {
      clearModels()
      modelsError.value = modelListErrorText(error)
    } finally {
      isLoadingModels.value = false
    }
  }

  const modelListErrorText = (error: unknown): string => {
    if (isLikelyCorsError(error)) return t('errors.possibleCors')
    if (error instanceof Error) return describeError(error, t) ?? error.message
    return describeError(error, t) ?? t('setup.api.modelsFailed')
  }

  /** 校验并产出可直接写进 settingsStore 的模型；不通过就返回一个 i18n 键 */
  const buildApiModel = (): ModelDraft => {
    const url = baseUrl.value.trim()
    if (!url) return { ok: false, errorKey: 'setup.api.baseUrlRequired' }

    const id = modelId.value
    if (!id) return { ok: false, errorKey: 'setup.api.modelIdRequired' }

    return {
      ok: true,
      // 列表接口给了展示名就用它；没给（OpenAI / SiliconFlow）或名字就是 id，就按 id 推一个
      name:
        (modelSource.value === 'list' && selectedModel.value
          ? modelDisplayName(selectedModel.value)
          : '') || modelNameFromId(id),
      baseUrl: url,
      extra: { kind: 'api', model: id, apiKey: apiKey.value.trim() || undefined },
    }
  }

  return {
    providerId,
    provider,
    baseUrl,
    apiKey,
    modelSource,
    manualModelId,
    selectedModel,
    selectedModelId,
    models,
    isLoadingModels,
    modelsError,
    modelId,
    canLoadModels,
    loadModels,
    clearModels,
    buildApiModel,
  }
}
