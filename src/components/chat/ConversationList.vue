<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { MessageSquare, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import type { Conversation } from '@/types/chat'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction
} from '@/components/ui/sidebar'

const { t } = useI18n()
const chatStore = useChatStore()

const conversations = computed(() => chatStore.conversations)
const activeId = computed(() => chatStore.activeConversationId)

const selectConversation = (id: string) => {
  chatStore.activeConversationId = id
}


const deleteConversation = (id: string, event: Event) => {
  event.stopPropagation()

  // 找到要删除的会话和其位置
  const index = chatStore.conversations.findIndex((c) => c.id === id)
  if (index === -1) return

  const deletedConversation: Conversation = JSON.parse(JSON.stringify(chatStore.conversations[index]))

  // 直接删除
  chatStore.deleteConversation(id)

  // 显示 toast 并提供撤销功能
  toast(t('chat.deleted'), {
    description: deletedConversation.title,
    action: {
      label: t('chat.undo'),
      onClick: () => {
        // 撤销删除：恢复会话
        chatStore.restoreConversation(deletedConversation, index)
      }
    }
  })
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return t('chat.today')
  } else if (days === 1) {
    return t('chat.yesterday')
  } else if (days < 7) {
    return `${days} ${t('chat.daysAgo')}`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}
</script>

<template>
  <!-- 会话列表 -->
  <SidebarGroup class="flex-1">
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="conversation in conversations" :key="conversation.id">
          <SidebarMenuButton size="lg" :data-active="activeId === conversation.id"
            @click="selectConversation(conversation.id)">
            <MessageSquare class="h-4 w-4" />
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ conversation.title }}</span>
              <span class="truncate text-xs text-muted-foreground">
                {{ conversation.messages.length }} {{ t('chat.messages') }} · {{ formatDate(conversation.updatedAt) }}
              </span>
            </div>
          </SidebarMenuButton>
          <SidebarMenuAction show-on-hover @click="(e: Event) => deleteConversation(conversation.id, e)">
            <Trash2 />
          </SidebarMenuAction>
        </SidebarMenuItem>

        <div v-if="conversations.length === 0" class="text-center text-muted-foreground text-sm py-8 px-4">
          {{ t('chat.noConversations') }}
        </div>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
