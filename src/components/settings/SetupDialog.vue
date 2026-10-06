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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CircleCheck } from '@lucide/vue'
import ModelConfigForm from './ModelConfigForm.vue'

const { t, availableLocales } = useI18n()
const settingsStore = useSettingsStore()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// 表单本身（DeepSeek 官方 / API / LLM Gate 三种模式）在 ModelConfigForm 里，和模型管理共用
const form = ref<InstanceType<typeof ModelConfigForm> | null>(null)

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const handleComplete = () => {
  const draft = form.value?.buildModel()
  if (!draft) return

  if (!draft.ok) {
    toast.error(t(draft.errorKey))
    return
  }

  const newModel = settingsStore.addModel(draft.name, draft.baseUrl, draft.extra)
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
            <SelectItem v-for="loc in availableLocales" :key="loc" :value="loc">
              {{ t(`settings.interface.languageOptions.${loc}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ModelConfigForm ref="form" @submit="handleComplete" />

      <DialogFooter>
        <Button @click="handleSkip" variant="outline">
          {{ t('setup.skip') }}
        </Button>
        <Button @click="handleComplete">
          <CircleCheck class="h-4 w-4" />
          {{ t('setup.completeSetup') }}
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
