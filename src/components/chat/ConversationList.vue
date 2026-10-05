<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { dayDiff } from '@/lib/time'
import { toast } from 'vue-sonner'
import type { Conversation } from '@/types/chat'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'

const { t, d } = useI18n()
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

  const deletedConversation: Conversation = JSON.parse(
    JSON.stringify(chatStore.conversations[index]),
  )

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
      },
    },
  })
}

const formatDate = (timestamp: number) => {
  // 用共享的日历天差：原来拿时间差除 86400000 取整，会把“昨天 23:00”算成今天
  const days = dayDiff(timestamp)

  if (days <= 0) {
    return t('chat.today')
  } else if (days === 1) {
    return t('chat.yesterday')
  } else if (days < 7) {
    return `${days} ${t('chat.daysAgo')}`
  } else {
    return d(timestamp, 'date')
  }
}
</script>

<template>
  <!-- 会话列表 -->
  <SidebarGroup class="flex-1">
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="conversation in conversations" :key="conversation.id">
          <!-- 选中态：覆盖 ui/sidebar 里默认的 sidebar-accent（0.97，跟边栏底色只差一点点，几乎看不出来）；
               tw-merge 会把 cva 里冲突的 data-[active=true]:bg-* / font-* 去掉，所以这里能直接盖。
               用 foreground/10 而不是写死颜色，深色模式下会自动变成变亮；想更深就改这个 /10 -->
          <SidebarMenuButton
            size="lg"
            class="pr-8 data-[active=true]:bg-foreground/10 data-[active=true]:font-normal"
            :data-active="activeId === conversation.id"
            @click="selectConversation(conversation.id)"
          >
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ conversation.title }}</span>
              <span class="truncate text-xs text-muted-foreground">
                {{ conversation.messages.length }} {{ t('chat.messages') }} ·
                {{ formatDate(conversation.updatedAt) }}
              </span>
            </div>
          </SidebarMenuButton>
          <!-- 删除：默认灰，悬停变红；桌面端悬停整行才淡入 -->
          <button
            type="button"
            class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-opacity duration-200 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:pointer-events-none md:opacity-0 group-hover/menu-item:pointer-events-auto group-hover/menu-item:opacity-100 group-focus-within/menu-item:pointer-events-auto group-focus-within/menu-item:opacity-100"
            :aria-label="t('chat.deleteConversation')"
            @click="(e: Event) => deleteConversation(conversation.id, e)"
          >
            <Trash2 class="size-4" />
          </button>
        </SidebarMenuItem>

        <div
          v-if="conversations.length === 0"
          class="text-center text-muted-foreground text-sm py-8 px-4"
        >
          {{ t('chat.noConversations') }}
        </div>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
