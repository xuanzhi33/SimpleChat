<script setup lang="ts">
import { ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useI18n } from 'vue-i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sliders } from 'lucide-vue-next'

const { t } = useI18n()
const chatStore = useChatStore()

// 定义 props 和 emits
defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

// 本地系统提示词状态
const systemPrompt = ref('')

// 监听弹窗打开，加载当前对话的系统提示词
watch(() => chatStore.activeConversation, (conversation) => {
  if (conversation) {
    systemPrompt.value = conversation.systemPrompt || ''
  }
}, { immediate: true })

// 监听系统提示词变化，实时保存到 store
watch(systemPrompt, (newValue) => {
  const conversation = chatStore.activeConversation
  if (conversation) {
    conversation.systemPrompt = newValue
    conversation.updatedAt = Date.now()
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Sliders />
          {{ t('chat.conversationConfig') }}
        </DialogTitle>
        <DialogDescription>
          {{ t('chat.systemPromptDescription') }}
        </DialogDescription>
      </DialogHeader>

      <!-- 对话配置内容区域 -->
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="system-prompt">{{ t('chat.systemPrompt') }}</Label>
          <Textarea id="system-prompt" v-model="systemPrompt" :placeholder="t('chat.systemPromptPlaceholder')"
            class="min-h-32 max-h-60 resize-none" />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
