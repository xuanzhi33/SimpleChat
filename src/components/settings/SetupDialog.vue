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
import { ExternalLink, CheckCircle2 } from 'lucide-vue-next'
import type { ModelKind } from '@/types/chat'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const mode = ref<ModelKind>('api')
const modelUrl = ref('')
const modelId = ref('')
const apiKey = ref('')

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const llmGateUrl = 'https://github.com/xuanzhi33/LLM-Gate'

const openLLMGate = () => {
  window.open(llmGateUrl, '_blank')
}

const handleComplete = () => {
  const url = modelUrl.value.trim()
  if (!url) {
    toast.error(t('setup.urlRequired'))
    return
  }

  const isApi = mode.value === 'api'
  const modelIdValue = modelId.value.trim()
  if (isApi && !modelIdValue) {
    toast.error(t('setup.modelIdRequired'))
    return
  }

  const newModel = settingsStore.addModel(
    // api 模式用模型 ID 作为展示名
    isApi ? modelIdValue : t('setup.defaultModelName'),
    url,
    isApi
      ? { kind: 'api', model: modelIdValue, apiKey: apiKey.value.trim() || undefined }
      : { kind: 'gate' },
  )
  settingsStore.defaultModelId = newModel.id

  toast.success(t('setup.setupSuccess'))
  isOpen.value = false
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
          <TabsTrigger value="api">{{ t('setup.tabs.api') }}</TabsTrigger>
          <TabsTrigger value="gate">{{ t('setup.tabs.gate') }}</TabsTrigger>
        </TabsList>

        <!-- API 模式 -->
        <TabsContent value="api" class="space-y-4">
          <div class="space-y-2">
            <Label for="api-base-url">{{ t('setup.api.baseUrl') }}</Label>
            <Input
              id="api-base-url"
              v-model="modelUrl"
              :placeholder="t('setup.api.baseUrlPlaceholder')"
              @keyup.enter="handleComplete"
            />
            <p class="text-xs text-muted-foreground">{{ t('setup.api.baseUrlDescription') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="api-model-id">{{ t('setup.api.modelId') }}</Label>
            <Input
              id="api-model-id"
              v-model="modelId"
              :placeholder="t('setup.api.modelIdPlaceholder')"
              @keyup.enter="handleComplete"
            />
            <p class="text-xs text-muted-foreground">{{ t('setup.api.modelIdDescription') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="api-key">{{ t('setup.api.apiKey') }}</Label>
            <Input
              id="api-key"
              v-model="apiKey"
              type="password"
              :placeholder="t('setup.api.apiKeyPlaceholder')"
              @keyup.enter="handleComplete"
            />
            <p class="text-xs text-muted-foreground">{{ t('setup.api.apiKeyDescription') }}</p>
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
