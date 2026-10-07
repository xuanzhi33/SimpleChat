<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ExternalLink,
  Info,
  LoaderCircle,
  RefreshCw,
  ChevronDown,
  Cloud,
  Lock,
  Plug,
} from '@lucide/vue'
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL_ID, DEEPSEEK_MODEL_NAME } from '@/lib/model'
import { providerList } from '@/configs/providers'
import deepseekLogo from '@/assets/deepseek.svg'
import ModelIcon from '@/components/ModelIcon.vue'
import { modelDisplayName, type RemoteModel } from '@/lib/models'
import {
  useApiModelForm,
  CUSTOM_PROVIDER_ID,
  type ModelDraft,
  type ModelPrefill,
} from '@/composables/useApiModelForm'
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import ModelInfo from './ModelInfo.vue'

/** 三种填模型的方式：DeepSeek 官方 / 任意 OpenAI 兼容 API / LLM Gate */
type ModelConfigMode = 'deepseek' | 'api' | 'gate'

const props = defineProps<{
  defaultMode?: ModelConfigMode
  /** 克隆已有模型时带过来的预填值；不传＝全新模型，按 defaultMode 起步 */
  prefill?: ModelPrefill
}>()

const emit = defineEmits<{
  /** 输入框里敲回车，等于点了调用方的「完成/添加」按钮 */
  submit: []
}>()

const { t } = useI18n()

// 克隆时直接落到被克隆模型的模式；否则按调用方给的默认模式
const mode = ref<ModelConfigMode>(
  props.prefill
    ? props.prefill.kind === 'gate'
      ? 'gate'
      : 'api'
    : (props.defaultMode ?? 'deepseek'),
)
const modelUrl = ref(props.prefill?.kind === 'gate' ? props.prefill.baseUrl : '')

// API 模式的表单（服务商 / Base URL / API Key / 模型选择）都在这个 composable 里
const {
  providerId,
  provider: selectedProvider,
  baseUrl: apiBaseUrl,
  // apiKey 两个 tab 共用：DeepSeek 预设和 API 模式填的都是同一把 key
  apiKey,
  modelSource,
  manualModelId,
  selectedModel,
  selectedModelId,
  models,
  isLoadingModels,
  modelsError,
  canLoadModels,
  loadModels,
  buildApiModel,
} = useApiModelForm()

// 克隆 API 模型：地址 / Key 照填，模型 ID 走「手动填写」——
// 列表是空的（没拉过 /models），选不中也就不去为它拉一次列表
if (props.prefill?.kind === 'api') {
  const { baseUrl, modelId, apiKey: key } = props.prefill
  const normalized = (url: string) => url.replace(/\/+$/, '')
  const preset = providerList.find((item) => normalized(item.url) === normalized(baseUrl))

  // 认得出服务商就选中它（地址跟着预设走），认不出就留在「自定义」并把地址填上
  if (preset) providerId.value = preset.name
  else apiBaseUrl.value = baseUrl

  apiKey.value = key ?? ''
  modelSource.value = 'manual'
  manualModelId.value = modelId ?? ''
}

const llmGateUrl = 'https://github.com/xuanzhi33/LLM-Gate'

const openLLMGate = () => {
  window.open(llmGateUrl, '_blank')
}

const deepseekPlatformUrl = 'https://platform.deepseek.com/api_keys'

const openDeepSeek = () => {
  window.open(deepseekPlatformUrl, '_blank')
}

/** 下拉里展示成「模型名（模型 id）」；接口没给名字（OpenAI / SiliconFlow 都不给）就只显示 id */
const modelOptionLabel = (model: RemoteModel) => {
  const name = modelDisplayName(model)
  return name ? t('setup.api.modelOption', { name, id: model.id }) : model.id
}

/** 选中后输入框里显示模型名而不是光秃秃的 id */
const modelDisplayValue = (value: unknown) => {
  const model = selectedModel.value
  return model && model.id === value ? modelOptionLabel(model) : ''
}

/** 校验当前 tab，产出可直接写进 settingsStore 的模型；不通过则带一个 i18n 键出去 */
const buildModel = (): ModelDraft => {
  if (mode.value === 'deepseek') {
    const key = apiKey.value.trim()
    if (!key) return { ok: false, errorKey: 'setup.deepseek.apiKeyRequired' }

    return {
      ok: true,
      name: DEEPSEEK_MODEL_NAME,
      baseUrl: DEEPSEEK_BASE_URL,
      extra: { kind: 'api', model: DEEPSEEK_MODEL_ID, apiKey: key },
    }
  }

  if (mode.value === 'api') return buildApiModel()

  const url = modelUrl.value.trim()
  if (!url) return { ok: false, errorKey: 'setup.urlRequired' }

  return { ok: true, name: t('setup.gateModelName'), baseUrl: url, extra: { kind: 'gate' } }
}

defineExpose({ buildModel })
</script>

<template>
  <Tabs v-model="mode" class="gap-4">
    <!-- 窄屏塞不下这三个 tab（会横向溢出）：让 tab 条自己横向滚 —— 手机上用手指划就能看全，
         别把药丸撑破；滚动条在触摸屏上是浮层，不占高度 -->
    <TabsList class="w-full overflow-x-auto">
      <TabsTrigger value="deepseek">
        <img :src="deepseekLogo" alt="" class="size-4 shrink-0" />
        {{ t('setup.tabs.deepseek') }}
      </TabsTrigger>
      <TabsTrigger value="api">
        <Cloud class="size-4" />
        {{ t('setup.tabs.api') }}
      </TabsTrigger>
      <TabsTrigger value="gate">
        <Lock class="size-4" />
        {{ t('setup.tabs.gate') }}
      </TabsTrigger>
    </TabsList>

    <!-- DeepSeek 官方模式 -->
    <TabsContent value="deepseek" class="space-y-4">
      <!-- Step 1 -->
      <div class="space-y-2">
        <div class="flex items-start gap-3">
          <div
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            1
          </div>
          <div class="flex-1 space-y-2">
            <h3 class="font-semibold">{{ t('setup.deepseek.step1') }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ t('setup.deepseek.step1Description') }}
            </p>
            <Button @click="openDeepSeek" variant="outline" size="sm">
              <ExternalLink class="h-4 w-4" />
              {{ t('setup.deepseek.apiKeyButton') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="space-y-2">
        <div class="flex items-start gap-3">
          <div
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            2
          </div>
          <div class="flex-1 space-y-3">
            <h3 class="font-semibold">{{ t('setup.deepseek.step2') }}</h3>

            <div class="space-y-2">
              <Label for="deepseek-api-key">{{ t('setup.api.apiKey') }}</Label>
              <Input
                id="deepseek-api-key"
                v-model="apiKey"
                :placeholder="t('setup.api.apiKeyPlaceholder')"
                @keyup.enter="emit('submit')"
              />
              <p class="text-xs text-muted-foreground">
                {{ t('setup.api.apiKeyDescription') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TabsContent>

    <!-- API 模式 -->
    <TabsContent value="api" class="space-y-4">
      <!-- CORS 说明 -->
      <div class="flex items-start gap-2.5 rounded-lg border bg-muted/50 p-3">
        <Info class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p class="text-xs leading-relaxed text-muted-foreground">
          {{ t('setup.api.notice') }}
        </p>
      </div>

      <div class="space-y-2">
        <Label for="api-provider">{{ t('setup.api.provider') }}</Label>
        <Select v-model="providerId">
          <SelectTrigger id="api-provider" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="provider in providerList"
              :key="provider.name"
              :value="provider.name"
            >
              <ModelIcon :provider="provider" />
              {{ provider.name }}
            </SelectItem>
            <SelectItem :value="CUSTOM_PROVIDER_ID">
              <Plug class="size-4" />
              {{ t('setup.api.providerCustom') }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-2">
        <Label for="api-base-url">{{ t('setup.api.baseUrl') }}</Label>
        <Input
          id="api-base-url"
          v-model="apiBaseUrl"
          :disabled="!!selectedProvider"
          :placeholder="t('setup.api.baseUrlPlaceholder')"
          @keyup.enter="emit('submit')"
        />
        <p class="text-xs text-muted-foreground">{{ t('setup.api.baseUrlDescription') }}</p>
      </div>

      <div class="space-y-2">
        <Label for="api-key">{{ t('setup.api.apiKey') }}</Label>
        <Input
          id="api-key"
          v-model="apiKey"
          :placeholder="t('setup.api.apiKeyPlaceholder')"
          @keyup.enter="emit('submit')"
        />
        <p class="text-xs text-muted-foreground">{{ t('setup.api.apiKeyDescription') }}</p>
      </div>

      <div class="space-y-2">
        <Label>{{ t('setup.api.model') }}</Label>
        <Tabs v-model="modelSource" class="gap-3">
          <TabsList class="h-8 w-full">
            <TabsTrigger value="list" class="text-xs">
              {{ t('setup.api.modelSource.list') }}
            </TabsTrigger>
            <TabsTrigger value="manual" class="text-xs">
              {{ t('setup.api.modelSource.manual') }}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" class="space-y-3">
            <Button variant="outline" class="w-full" :disabled="!canLoadModels" @click="loadModels">
              <LoaderCircle v-if="isLoadingModels" class="animate-spin" />
              <RefreshCw v-else />
              {{ t('setup.api.fetchModels') }}
            </Button>

            <p v-if="modelsError" class="text-xs whitespace-pre-line text-destructive">
              {{ modelsError }}
            </p>

            <template v-if="models.length">
              <Combobox v-model="selectedModelId" :open-on-click="true">
                <ComboboxAnchor
                  class="border-input focus-within:border-ring focus-within:ring-ring/50 relative flex w-full items-center rounded-md border shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] [&>[data-slot=command-input-wrapper]]:w-full [&>[data-slot=command-input-wrapper]]:border-b-0 [&>[data-slot=command-input-wrapper]]:pr-8"
                >
                  <ComboboxInput
                    id="api-model-select"
                    class="h-9 py-1"
                    :display-value="modelDisplayValue"
                    :placeholder="t('setup.api.modelSelectPlaceholder')"
                    @keyup.enter="emit('submit')"
                  />
                  <ComboboxTrigger class="text-muted-foreground absolute right-2">
                    <ChevronDown class="size-4" />
                  </ComboboxTrigger>
                </ComboboxAnchor>

                <ComboboxList
                  class="w-(--reka-combobox-trigger-width) max-h-60 overflow-y-auto p-1"
                >
                  <ComboboxEmpty>{{ t('setup.api.modelsNoMatch') }}</ComboboxEmpty>
                  <ComboboxItem v-for="model in models" :key="model.id" :value="model.id">
                    {{ modelOptionLabel(model) }}
                  </ComboboxItem>
                </ComboboxList>
              </Combobox>

              <ModelInfo v-if="selectedModel" :model="selectedModel" />
            </template>
          </TabsContent>

          <TabsContent value="manual" class="space-y-2">
            <Input
              id="api-model-id"
              v-model="manualModelId"
              :placeholder="t('setup.api.modelIdPlaceholder')"
              @keyup.enter="emit('submit')"
            />
            <p class="text-xs text-muted-foreground">
              {{ t('setup.api.modelIdDescription') }}
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </TabsContent>

    <!-- LLM Gate 模式 -->
    <TabsContent value="gate" class="space-y-4">
      <!-- Step 1 -->
      <div class="space-y-2">
        <div class="flex items-start gap-3">
          <div
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            1
          </div>
          <div class="flex-1 space-y-2">
            <h3 class="font-semibold">{{ t('setup.step1') }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ t('setup.step1Description') }}
            </p>
            <Button @click="openLLMGate" variant="outline" size="sm">
              <ExternalLink class="h-4 w-4" />
              {{ t('setup.downloadButton') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="space-y-2">
        <div class="flex items-start gap-3">
          <div
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            2
          </div>
          <div class="flex-1 space-y-2">
            <h3 class="font-semibold">{{ t('setup.step2') }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ t('setup.step2Description') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="space-y-2">
        <div class="flex items-start gap-3">
          <div
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            3
          </div>
          <div class="flex-1 space-y-3">
            <h3 class="font-semibold">{{ t('setup.step3') }}</h3>

            <div class="space-y-2">
              <Label for="model-url">{{ t('setup.modelUrl') }}</Label>
              <Input
                id="model-url"
                v-model="modelUrl"
                :placeholder="t('setup.modelUrlPlaceholder')"
                @keyup.enter="emit('submit')"
              />
            </div>
          </div>
        </div>
      </div>
    </TabsContent>
  </Tabs>
</template>
