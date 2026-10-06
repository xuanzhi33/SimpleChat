<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { toast } from 'vue-sonner'
import {
  Dialog,
  DialogScrollContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { ExternalLink, CheckCircle2, Info, Loader2, RefreshCw, ChevronDown } from 'lucide-vue-next'
import type { ModelExtra } from '@/types/chat'
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL_ID, DEEPSEEK_MODEL_NAME } from '@/lib/model'
import { providerList } from '@/configs/providers'
import { modelDisplayName, type RemoteModel } from '@/lib/models'
import { useApiModelForm, CUSTOM_PROVIDER_ID } from '@/composables/useApiModelForm'
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

const { t } = useI18n()
const settingsStore = useSettingsStore()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

/** 欢迎弹窗里的三个 tab；deepseek 是一个预设好的 api 模型 */
type SetupMode = 'deepseek' | 'api' | 'gate'

const mode = ref<SetupMode>('deepseek')
const modelUrl = ref('')

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

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const llmGateUrl = 'https://github.com/xuanzhi33/LLM-Gate'

const openLLMGate = () => {
  window.open(llmGateUrl, '_blank')
}

const deepseekPlatformUrl = 'https://platform.deepseek.com/api_keys'

const openDeepSeek = () => {
  window.open(deepseekPlatformUrl, '_blank')
}

const finishSetup = (name: string, baseUrl: string, extra: ModelExtra) => {
  const newModel = settingsStore.addModel(name, baseUrl, extra)
  settingsStore.defaultModelId = newModel.id

  toast.success(t('setup.setupSuccess'))
  isOpen.value = false
}

const handleComplete = () => {
  // DeepSeek 官方模式：接口地址和模型 ID 都是固定的，只需要 API Key
  if (mode.value === 'deepseek') {
    const key = apiKey.value.trim()
    if (!key) {
      toast.error(t('setup.deepseek.apiKeyRequired'))
      return
    }

    finishSetup(DEEPSEEK_MODEL_NAME, DEEPSEEK_BASE_URL, {
      kind: 'api',
      model: DEEPSEEK_MODEL_ID,
      apiKey: key,
    })
    return
  }

  // API 模式：校验交给表单，这里只负责报错和落库
  if (mode.value === 'api') {
    const draft = buildApiModel()
    if (!draft.ok) {
      toast.error(t(draft.errorKey))
      return
    }

    finishSetup(draft.name, draft.baseUrl, draft.extra)
    return
  }

  const url = modelUrl.value.trim()
  if (!url) {
    toast.error(t('setup.urlRequired'))
    return
  }

  finishSetup(t('setup.defaultModelName'), url, { kind: 'gate' })
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

const handleSkip = () => {
  isOpen.value = false
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogScrollContent class="max-w-200">
      <DialogHeader>
        <DialogTitle class="text-2xl">{{ t('setup.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('setup.description') }}
        </DialogDescription>
      </DialogHeader>

      <!-- Language Selector -->
      <div class="space-y-2">
        <Label for="language-select">{{ t('setup.language') }}</Label>
        <Select v-model="settingsStore.language">
          <SelectTrigger id="language-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">{{ t('settings.interface.languageOptions.zh') }}</SelectItem>
            <SelectItem value="en">{{ t('settings.interface.languageOptions.en') }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs v-model="mode" class="gap-4">
        <TabsList class="w-full">
          <TabsTrigger value="deepseek">{{ t('setup.tabs.deepseek') }}</TabsTrigger>
          <TabsTrigger value="api">{{ t('setup.tabs.api') }}</TabsTrigger>
          <TabsTrigger value="gate">{{ t('setup.tabs.gate') }}</TabsTrigger>
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
                    @keyup.enter="handleComplete"
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
                  {{ provider.name }}
                </SelectItem>
                <SelectItem :value="CUSTOM_PROVIDER_ID">
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
              @keyup.enter="handleComplete"
            />
            <p class="text-xs text-muted-foreground">{{ t('setup.api.baseUrlDescription') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="api-key">{{ t('setup.api.apiKey') }}</Label>
            <Input
              id="api-key"
              v-model="apiKey"
              :placeholder="t('setup.api.apiKeyPlaceholder')"
              @keyup.enter="handleComplete"
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
                <Button
                  variant="outline"
                  class="w-full"
                  :disabled="!canLoadModels"
                  @click="loadModels"
                >
                  <Loader2 v-if="isLoadingModels" class="animate-spin" />
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
                        @keyup.enter="handleComplete"
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
                  @keyup.enter="handleComplete"
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
                    @keyup.enter="handleComplete"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button @click="handleSkip" variant="outline">
          {{ t('setup.skip') }}
        </Button>
        <Button @click="handleComplete">
          <CheckCircle2 class="h-4 w-4" />
          {{ t('setup.completeSetup') }}
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
