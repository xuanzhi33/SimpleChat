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

      <!-- 顶部胶囊：边栏开关 + 当前对话标题；悬停向右展开并浮现编辑图标，点击标题即可重命名 -->
      <div
        class="group absolute top-3 left-4 flex items-center gap-1.5 rounded-full border bg-background/80 py-1 pr-2 pl-2 shadow-sm backdrop-blur"
      >
        <SidebarTrigger class="rounded-full" />

        <input
          v-if="isRenaming"
          ref="titleInputRef"
          v-model="titleDraft"
          class="h-7 w-44 rounded-full bg-transparent px-2 text-sm outline-none focus:bg-muted/60"
          @keydown.enter="saveTitle"
          @keydown.esc="cancelRename"
          @blur="saveTitle"
        />

        <button
          v-else-if="currentTitle"
          type="button"
          class="flex min-w-0 items-center rounded-full py-0.5 pr-0.5 pl-1.5 text-sm transition-colors hover:bg-muted/60"
          :aria-label="t('chat.renameTitle')"
          @click="startRename"
        >
          <span class="max-w-[40vw] truncate font-medium">{{ currentTitle }}</span>
          <!-- 默认不占宽度，悬停胶囊时向右展开并淡入 -->
          <span
            class="grid w-0 place-items-center overflow-hidden opacity-0 transition-all duration-200 group-hover:w-5 group-hover:opacity-100"
          >
            <Pencil class="size-3.5" />
          </span>
        </button>
      </div>
    </SidebarInset>

    <!-- 设置弹窗 -->
    <SettingsDialog v-model:open="settingsOpen" />
  </SidebarProvider>
</template>
