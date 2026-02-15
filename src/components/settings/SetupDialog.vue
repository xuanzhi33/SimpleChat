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

const { t } = useI18n()
const settingsStore = useSettingsStore()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const modelUrl = ref('')
const modelName = ref('')

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const llmGateUrl = 'https://github.com/xuanzhi33/LLM-Gate'

const openLLMGate = () => {
  window.open(llmGateUrl, '_blank')
}

const handleComplete = () => {
  if (!modelUrl.value.trim()) {
    toast.error(t('setup.urlRequired'))
    return
  }

  const name = modelName.value.trim() || t('settings.models.modelNamePlaceholder')
  const url = modelUrl.value.trim()

  const newModel = settingsStore.addModel(name, url)
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

      <div class="space-y-4">
        <!-- Step 1 -->
        <div class="space-y-2">
          <div class="flex items-start gap-3">
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
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
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
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
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              3
            </div>
            <div class="flex-1 space-y-3">
              <h3 class="font-semibold">{{ t('setup.step3') }}</h3>

              <div class="space-y-2">
                <Label for="model-url">{{ t('setup.modelUrl') }}</Label>
                <Input id="model-url" v-model="modelUrl" :placeholder="t('setup.modelUrlPlaceholder')"
                  @keyup.enter="handleComplete" />
              </div>

              <div class="space-y-2">
                <Label for="model-name">{{ t('setup.modelName') }}</Label>
                <Input id="model-name" v-model="modelName" :placeholder="t('setup.modelNamePlaceholder')"
                  @keyup.enter="handleComplete" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="flex flex-col-reverse sm:flex-row gap-2">
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
