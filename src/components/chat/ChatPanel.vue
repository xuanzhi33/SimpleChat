<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { ChatService } from '@/lib/chat-service'
import MessageItem from './MessageItem.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ModelManagement from '@/components/settings/ModelManagement.vue'
import SettingsDialog from '@/views/SettingsView.vue'
import { StopCircle, Trash2, AlertCircle, Bot, Cpu, ArrowUp, Settings } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const inputText = ref('')
const messagesContainerRef = ref<HTMLElement>()
const abortControllerRef = ref<AbortController | null>(null)
const error = ref<string>('')
const modelManagementOpen = ref(false)
const clearDialogOpen = ref(false)
const settingsOpen = ref(false)

const messages = computed(() => chatStore.activeConversation?.messages || [])
const isGenerating = computed(() => chatStore.isGenerating)

// 当前对话使用的模型
const currentModel = computed(() => {
  const modelId = chatStore.activeConversation?.modelId
  if (!modelId) return settingsStore.defaultModel
  return settingsStore.models.find(m => m.id === modelId) || settingsStore.defaultModel
})

// 更新当前对话的模型
const updateConversationModel = (modelId: unknown) => {
  if (!modelId || typeof modelId !== 'string') return
  const conversation = chatStore.activeConversation
  if (conversation) {
    conversation.modelId = modelId
    conversation.updatedAt = Date.now()
  }
}

// 计算每条消息是否在上下文范围内
const isMessageInContext = (index: number) => {
  const contextLength = settingsStore.contextLength
  if (contextLength === 0) return true // 0 表示不限制，所有消息都在上下文内

  // 计算从后往前的有效消息数（排除最后一条如果正在生成的话）
  const totalMessages = messages.value.length
  const lastMessageIsStreaming = messages.value[totalMessages - 1]?.isStreaming
  const effectiveTotal = lastMessageIsStreaming ? totalMessages - 1 : totalMessages

  // 如果消息在最后 contextLength 条内，则在上下文范围内
  return index >= effectiveTotal - contextLength
}

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
  }
}

// 监听消息变化，自动滚动
watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  }
)

// 发送消息
const sendMessage = async () => {
  const content = inputText.value.trim()
  if (!content || isGenerating.value) return

  // 检查是否有可用的模型
  if (!currentModel.value) {
    error.value = t('chat.errors.noModel')
    return
  }

  error.value = ''
  inputText.value = ''

  // 添加用户消息
  chatStore.addMessage({
    role: 'user',
    content,
  })

  scrollToBottom()

  // 创建助手消息占位符
  const assistantMessage = chatStore.addMessage({
    role: 'assistant',
    content: '',
    isStreaming: true,
  })

  if (!assistantMessage) return

  // 开始生成
  chatStore.isGenerating = true
  abortControllerRef.value = new AbortController()

  const chatService = new ChatService(currentModel.value.baseUrl)
  let fullContent = ''
  let fullReasoningContent = ''

  let hasScrolledOnStart = false

  try {
    // 根据上下文长度设置截取历史消息
    const contextLength = settingsStore.contextLength
    let messagesToSend = messages.value.slice(0, -1) // 排除刚添加的助手消息
    if (contextLength > 0 && messagesToSend.length > contextLength) {
      messagesToSend = messagesToSend.slice(-contextLength)
    }

    await chatService.sendMessage(
      messagesToSend,
      (content, reasoningContent) => {
        // 流式更新
        if (content) {
          fullContent += content
        }
        if (reasoningContent) {
          fullReasoningContent += reasoningContent
        }

        chatStore.updateMessage(assistantMessage.id, {
          content: fullContent,
          reasoning_content: fullReasoningContent || undefined,
          isStreaming: true,
        })

        // 仅在开始回答时滚动一次，之后用户可自行滚动阅读
        if (!hasScrolledOnStart) {
          hasScrolledOnStart = true
          scrollToBottom()
        }
      },
      () => {
        // 完成
        chatStore.updateMessage(assistantMessage.id, {
          isStreaming: false,
        })
        chatStore.isGenerating = false
        abortControllerRef.value = null
      },
      (err) => {
        // 错误
        console.error('Chat error:', err)
        error.value = err.message
        chatStore.updateMessage(assistantMessage.id, {
          isStreaming: false,
        })
        chatStore.isGenerating = false
        abortControllerRef.value = null
        toast.error(t('chat.errors.sendFailed'))
      },
      abortControllerRef.value.signal
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    error.value = err instanceof Error ? err.message : 'Unknown error'
    chatStore.isGenerating = false
    abortControllerRef.value = null
  }
}

// 停止生成
const stopGenerating = () => {
  if (abortControllerRef.value) {
    abortControllerRef.value.abort()
    abortControllerRef.value = null
  }
  chatStore.isGenerating = false
}

// 清空对话
const confirmClearConversation = () => {
  chatStore.clearMessages()
  clearDialogOpen.value = false
}

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 错误提示 -->
    <Alert v-if="error" variant="destructive" class="p-4 pl-14">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <!-- 消息列表 -->
    <div ref="messagesContainerRef" class="flex-1 overflow-y-auto px-4 py-6">
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center">
        <Bot class="w-20 h-20 mb-6 text-blue-500 opacity-50" />
        <h2 class="text-2xl font-bold mb-2 text-gray-700 dark:text-gray-300">
          {{ t('common.title') }}
        </h2>
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          {{ t('chat.emptyState') }}
        </p>
        <div v-if="!currentModel"
          class="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg">
          <AlertCircle class="inline-block w-4 h-4 mr-1" />
          {{ t('chat.errors.noModel') }}
        </div>
      </div>

      <MessageItem v-for="(message, index) in messages" :key="message.id" :message="message"
        :is-in-context="isMessageInContext(index)" />
    </div>

    <!-- 输入区域 -->
    <div class="border-t border-gray-200 dark:border-gray-700 p-4">
      <InputGroup>
        <InputGroupTextarea v-model="inputText" :placeholder="t('chat.inputPlaceholder')" @keydown="handleKeyDown"
          class="min-h-16 max-h-50 resize-none" />
        <InputGroupAddon align="block-end" class="justify-end">
          <!-- 设置按钮 -->
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <InputGroupButton variant="ghost" size="icon-xs" @click="settingsOpen = true" :disabled="isGenerating">
                  <Settings class="size-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>
                {{ t('settings.title') }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <!-- 清空对话按钮 -->
          <TooltipProvider v-if="messages.length > 0">
            <Tooltip>
              <TooltipTrigger as-child>
                <InputGroupButton variant="ghost" size="icon-xs" @click="clearDialogOpen = true"
                  :disabled="isGenerating">
                  <Trash2 class="size-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>
                {{ t('chat.clearConversation') }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>


          <!-- 模型选择下拉菜单 -->
          <DropdownMenu v-if="chatStore.activeConversation">
            <DropdownMenuTrigger as-child>
              <InputGroupButton variant="ghost" :disabled="isGenerating">
                <Cpu class="size-4 mr-1.5" />
                {{ currentModel?.name || t('chat.selectModel') }}
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
              <DropdownMenuItem v-for="model in settingsStore.models" :key="model.id"
                @click="updateConversationModel(model.id)">
                <Cpu class="size-4 mr-2" />
                {{ model.name }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="modelManagementOpen = true">
                <Settings class="size-4 mr-2" />
                {{ t('chat.manageModels') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" class="h-4! mx-1" />

          <!-- 发送/停止按钮 -->
          <InputGroupButton v-if="!isGenerating" variant="default" class="rounded-full" size="icon-xs"
            @click="sendMessage" :disabled="!inputText.trim()">
            <ArrowUp class="size-4" />
            <span class="sr-only">{{ t('chat.send') }}</span>
          </InputGroupButton>

          <InputGroupButton v-else variant="destructive" class="rounded-full" size="icon-xs" @click="stopGenerating">
            <StopCircle class="size-4" />
            <span class="sr-only">{{ t('chat.stop') }}</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  </div>

  <!-- 设置弹窗 -->
  <SettingsDialog v-model:open="settingsOpen" />

  <!-- 模型管理弹窗 -->
  <ModelManagement v-model:open="modelManagementOpen" />

  <!-- 清空对话确认对话框 -->
  <AlertDialog v-model:open="clearDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('chat.confirmClear') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('chat.confirmClearDescription') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('chat.cancel') }}</AlertDialogCancel>
        <AlertDialogAction @click="confirmClearConversation"
          class="bg-destructive text-background hover:bg-destructive/90">
          {{ t('chat.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
