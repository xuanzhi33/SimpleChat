<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageSquarePlus, Pencil } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useChatStore } from '@/stores/chat'
import { isImeComposing } from '@/lib/ime'
import NewChatHint from './NewChatHint.vue'

const { t } = useI18n()
const chatStore = useChatStore()

// 边栏折叠时，胶囊里补一个「新对话」按钮，免得要先展开边栏
const { state } = useSidebar()

const currentTitle = computed(() => chatStore.activeConversation?.title ?? '')

// 标题就地编辑
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

// 组字中的 Enter 是「上屏」，不该顺手把标题也存了
const saveTitleOnEnter = (event: KeyboardEvent) => {
  if (isImeComposing(event)) return
  saveTitle()
}

// 换了会话（点列表、快捷键新建）就退出重命名：草稿里还是上一个会话的标题，
// 继续保存会把新会话改成旧标题
watch(
  () => chatStore.activeConversationId,
  () => cancelRename(),
)

const createNew = () => {
  chatStore.createConversation(t('chat.newConversation'))
}
</script>

<template>
  <!-- 顶部胶囊：边栏开关（+折叠时的新对话）+ 当前对话标题；悬停向右展开并浮现编辑图标 -->
  <div
    class="group absolute top-3 left-4 flex items-center gap-1.5 rounded-full border bg-background/50 py-1 pr-2.5 pl-2 shadow-sm backdrop-blur-md"
  >
    <SidebarTrigger class="rounded-full" />

    <Tooltip v-if="state === 'collapsed'">
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" class="size-7 rounded-full" @click="createNew">
          <MessageSquarePlus />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <NewChatHint />
      </TooltipContent>
    </Tooltip>

    <input
      v-if="isRenaming"
      ref="titleInputRef"
      v-model="titleDraft"
      class="h-7 w-44 rounded-full bg-transparent px-2 text-sm outline-none focus:bg-muted/60"
      @keydown.enter="saveTitleOnEnter"
      @keydown.esc="cancelRename"
      @blur="saveTitle"
    />

    <Tooltip v-else-if="currentTitle">
      <TooltipTrigger asChild>
        <button
          type="button"
          class="flex min-w-0 items-center gap-1 rounded-full py-0.5 pr-1 pl-1.5 text-sm transition-colors hover:bg-muted/60"
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
      </TooltipTrigger>
      <TooltipContent>
        <p>{{ t('chat.renameTitle') }}</p>
      </TooltipContent>
    </Tooltip>
  </div>
</template>
