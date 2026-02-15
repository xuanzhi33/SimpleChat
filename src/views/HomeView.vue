<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { MessageSquarePlus } from 'lucide-vue-next'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarTrigger,
  SidebarRail
} from '@/components/ui/sidebar'
import ConversationList from '@/components/chat/ConversationList.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import { useChatStore } from '@/stores/chat'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()

const chatStore = useChatStore()

const createNew = () => {
  chatStore.createConversation(t('chat.newConversation'))
}
</script>

<template>
  <SidebarProvider class="h-screen">
    <!-- 左侧对话列表 -->
    <Sidebar>
      <SidebarHeader class="flex items-center justify-between flex-row">
        <h1 class="text-lg font-semibold px-2 py-1">{{ t('common.title') }}</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button @click="createNew" size="icon" variant="outline">
              <MessageSquarePlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ t('chat.newConversation') }}</p>
          </TooltipContent>
        </Tooltip>
      </SidebarHeader>
      <SidebarContent>
        <ConversationList />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>

    <!-- 右侧主内容区域 -->
    <SidebarInset class="flex flex-col">
      <!-- 聊天面板 -->
      <div class="flex-1 overflow-hidden">
        <ChatPanel />
      </div>

      <!-- 顶部导航栏 -->
      <SidebarTrigger class="bg-background absolute top-3 left-4" />
    </SidebarInset>
  </SidebarProvider>
</template>
