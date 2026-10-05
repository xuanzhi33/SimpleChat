<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { useChatStore } from '@/stores/chat'

const { t } = useI18n()
const chatStore = useChatStore()

const systemPrompt = computed(() => chatStore.activeConversation?.systemPrompt?.trim() ?? '')
</script>

<template>
  <!-- 系统提示词：新对话时贴着欢迎语，已有消息时贴在消息列表最上方 -->
  <div v-if="systemPrompt">
    <div class="mb-1">
      <Badge variant="secondary" class="text-xs">
        {{ t('chat.systemPrompt') }}
      </Badge>
    </div>
    <div class="border-l-2 border-border pl-3 text-sm text-muted-foreground whitespace-pre-wrap">
      {{ systemPrompt }}
    </div>
  </div>
</template>
