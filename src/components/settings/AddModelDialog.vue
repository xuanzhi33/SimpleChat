<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
import { Check, LoaderCircle, ShieldCheck, X } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import { ChatService, isLikelyCorsError } from '@/lib/chat-service'
import { describeError } from '@/lib/errors'
import type { ModelPrefill } from '@/composables/useApiModelForm'
import ModelConfigForm from './ModelConfigForm.vue'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  /** 克隆已有模型时带过来的预填值，直接透给表单 */
  prefill?: ModelPrefill | null
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 表单和欢迎弹窗用的是同一个，只是这里的标题/按钮/落库行为不同
const form = ref<InstanceType<typeof ModelConfigForm> | null>(null)
const isTesting = ref(false)

const handleAdd = () => {
  const draft = form.value?.buildModel()
  if (!draft) return

  if (!draft.ok) {
    toast.error(t(draft.errorKey))
    return
  }

  // 只是往列表里加一个，不动默认模型（想换默认用列表里的星标按钮）
  settingsStore.addModel(draft.name, draft.baseUrl, draft.extra)
  toast.success(t('settings.models.addSuccess'))
  open.value = false
}

/** 连通性测试：让模型只回复 "OK" */
const handleTest = async () => {
  const draft = form.value?.buildModel()
  if (!draft) return

  if (!draft.ok) {
    toast.error(t(draft.errorKey))
    return
  }

  isTesting.value = true
  try {
    const service = new ChatService(draft.baseUrl, {
      model: draft.extra.model,
      apiKey: draft.extra.apiKey,
    })
    const reply = await service.testConnection()
    toast.success(t('settings.models.testSuccess', { reply: reply.trim().slice(0, 50) }))
  } catch (err) {
    console.error('Model test failed:', err)
    const message = isLikelyCorsError(err)
      ? t('errors.possibleCors')
      : (describeError(err, t) ?? (err instanceof Error ? err.message : String(err)))
    toast.error(t('settings.models.testFailed', { message }))
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <!-- min-w-0：别让里面的模式 tab 条（窄屏会横向溢出）把弹窗撑宽，溢出交给它自己滚 -->
    <DialogScrollContent class="max-w-200 min-w-0">
      <DialogHeader>
        <DialogTitle class="text-2xl">{{ t('settings.models.addModel') }}</DialogTitle>
        <DialogDescription>
          {{ t('settings.models.addDescription') }}
        </DialogDescription>
      </DialogHeader>

      <ModelConfigForm
        ref="form"
        default-mode="api"
        :prefill="props.prefill ?? undefined"
        @submit="handleAdd"
      />

      <DialogFooter>
        <Button @click="handleTest" variant="outline" :disabled="isTesting">
          <LoaderCircle v-if="isTesting" class="h-4 w-4 animate-spin" />
          <ShieldCheck v-else class="h-4 w-4" />
          {{ isTesting ? t('settings.models.testing') : t('settings.models.test') }}
        </Button>
        <Button @click="open = false" variant="outline">
          <X class="h-4 w-4" />
          {{ t('settings.models.cancel') }}
        </Button>
        <Button @click="handleAdd">
          <Check class="h-4 w-4" />
          {{ t('settings.models.add') }}
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
