<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { MessageSquarePlus, Pencil, Settings } from 'lucide-vue-next'
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
  SidebarTrigger,
} from '@/components/ui/sidebar'
import ConversationList from '@/components/chat/ConversationList.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import SettingsDialog from '@/views/SettingsView.vue'
import { useChatStore } from '@/stores/chat'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()

const chatStore = useChatStore()

const settingsOpen = ref(false)

const currentTitle = computed(() => chatStore.activeConversation?.title ?? '')

// 标题重命名（就地编辑）
const isRenaming = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement>()

const startRename = async () => {
  titleDraft.value = currentTitle.value
  isRenaming.value = true
  await nextTick()
  titleInputRef.value?.select()
}

const saveTitle = () => {
  if (!isRenaming.value) return
  isRenaming.value = false
  chatStore.renameConversation(titleDraft.value)
}

const cancelRename = () => {
  isRenaming.value = false
}

const createNew = () => {
  chatStore.createConversation(t('chat.newConversation'))
}
</script>

<template>
  <SidebarProvider class="h-screen">
    <!-- 左侧对话列表 -->
    <Sidebar variant="inset">
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

      <!-- 顶部胶囊：边栏开关 + 当前对话标题，悬停出现重命名按钮 -->
      <div
        class="group absolute top-3 left-4 flex items-center gap-1 rounded-full border bg-background/80 py-0.5 pl-0.5 shadow-sm backdrop-blur"
        :class="currentTitle || isRenaming ? 'pr-2' : 'pr-0.5'"
      >
        <SidebarTrigger />

        <input
          v-if="isRenaming"
          ref="titleInputRef"
          v-model="titleDraft"
          class="h-6 w-40 rounded-full bg-transparent px-2 text-sm outline-none focus:bg-muted/60"
          @keydown.enter="saveTitle"
          @keydown.esc="cancelRename"
          @blur="saveTitle"
        />

        <template v-else-if="currentTitle">
          <span class="max-w-[40vw] truncate text-sm font-medium">{{ currentTitle }}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                class="rounded-full p-1 text-muted-foreground transition-opacity md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                :aria-label="t('chat.renameTitle')"
                @click="startRename"
              >
                <Pencil class="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{{ t('chat.renameTitle') }}</p>
            </TooltipContent>
          </Tooltip>
        </template>
      </div>
    </SidebarInset>

    <!-- 设置弹窗 -->
    <SettingsDialog v-model:open="settingsOpen" />
  </SidebarProvider>
</template>
