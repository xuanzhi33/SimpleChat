<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { MessageSquarePlus, Settings } from 'lucide-vue-next'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import ConversationList from '@/components/chat/ConversationList.vue'
import NewChatHint from '@/components/chat/NewChatHint.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import TitleBar from '@/components/chat/TitleBar.vue'
import SettingsDialog from '@/views/SettingsView.vue'
import { useChatStore } from '@/stores/chat'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEventListener } from '@vueuse/core'
import { isNewChatShortcut } from '@/lib/shortcuts'

const { t } = useI18n()

const chatStore = useChatStore()

const settingsOpen = ref(false)

const createNew = () => {
  chatStore.createConversation(t('chat.newConversation'))
}

// Ctrl/Cmd + J 新建对话（createConversation 会切会话，ChatPanel 的 watch 会跟着聚焦输入框）
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!isNewChatShortcut(event)) return
  event.preventDefault()
  createNew()
})
</script>

<template>
  <SidebarProvider class="h-screen">
    <!-- 左侧对话列表 -->
    <Sidebar variant="inset">
      <SidebarHeader class="flex items-center justify-between flex-row pt-3">
        <h1 class="text-lg font-semibold px-2 py-1">{{ t('common.title') }}</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button @click="createNew" size="icon" variant="outline">
              <MessageSquarePlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <NewChatHint />
          </TooltipContent>
        </Tooltip>
      </SidebarHeader>
      <SidebarContent>
        <ConversationList />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton @click="settingsOpen = true">
              <Settings />
              <span>{{ t('settings.title') }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    <!-- 右侧主内容区域 -->
    <SidebarInset class="flex flex-col">
      <!-- 聊天面板 -->
      <div class="flex-1 overflow-hidden">
        <ChatPanel />
      </div>

      <!-- 顶部胶囊：边栏开关 + 当前对话标题 -->
      <TitleBar />
    </SidebarInset>

    <!-- 设置弹窗 -->
    <SettingsDialog v-model:open="settingsOpen" />
  </SidebarProvider>
</template>
