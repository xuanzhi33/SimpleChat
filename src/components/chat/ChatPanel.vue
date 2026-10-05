<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { ChatService, isLikelyCorsError } from '@/lib/chat-service'
import { describeError, summarizeError } from '@/lib/errors'
import { modelRequestOptions } from '@/lib/model'
import { buildTitlePrompt, cleanTitle } from '@/lib/title'
import MessageItem from './MessageItem.vue'
import SystemPromptBlock from './SystemPromptBlock.vue'
import ConversationConfig from './ConversationConfig.vue'
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
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ModelManagement from '@/components/settings/ModelManagement.vue'
import { StopCircle, AlertCircle, Bot, Cpu, ArrowUp, Settings, Sliders } from 'lucide-vue-next'
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
const conversationConfigOpen = ref(false)
/** 正在编辑的消息 id；非空时输入框里是这条消息的内容，发送时会从这条开始截断 */
const editingMessageId = ref<string | null>(null)

const messages = computed(() => chatStore.activeConversation?.messages || [])
const isGenerating = computed(() => chatStore.isGenerating)

// 当前对话使用的模型
const currentModel = computed(() => {
  const modelId = chatStore.activeConversation?.modelId
  if (!modelId) return settingsStore.defaultModel
  return settingsStore.models.find((m) => m.id === modelId) || settingsStore.defaultModel
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

// 聚焦输入框
const focusInput = () => {
  nextTick(() => {
    const inputElement = document.getElementById('chat-main-input')
    if (inputElement) {
      inputElement.focus()
    }
  })
}

// 监听消息变化，自动滚动
watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  },
)

// 监听对话切换，自动聚焦输入框
watch(
  () => chatStore.activeConversationId,
  () => {
    // 被编辑的消息已经不属于当前会话了，退出编辑模式
    if (editingMessageId.value) cancelEdit()
    focusInput()
  },
)

// 页面加载完成后聚焦输入框
onMounted(() => {
  focusInput()
})

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

  // 编辑模式：丢弃被编辑消息及其之后的内容，然后把新内容当成普通消息发出去
  if (editingMessageId.value) {
    chatStore.truncateFrom(editingMessageId.value)
    editingMessageId.value = null
  }

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

  const conversationId = chatStore.activeConversation?.id

  // 开始生成
  chatStore.isGenerating = true
  abortControllerRef.value = new AbortController()

  const chatService = new ChatService(
    currentModel.value.baseUrl,
    modelRequestOptions(currentModel.value),
  )
  let fullContent = ''
  let fullReasoningContent = ''
  // 思考耗时：从请求发出到最后一个思考增量
  const thinkingStartedAt = Date.now()
  let thinkingEndedAt = 0

  let hasScrolledOnStart = false

  try {
    // 根据上下文长度设置截取历史消息
    const contextLength = settingsStore.contextLength
    let messagesToSend = messages.value.slice(0, -1) // 排除刚添加的助手消息
    if (contextLength > 0 && messagesToSend.length > contextLength) {
      messagesToSend = messagesToSend.slice(-contextLength)
    }

    // 如果配置了系统提示词，添加到消息列表最前面
    const systemPrompt = chatStore.activeConversation?.systemPrompt
    if (systemPrompt && systemPrompt.trim()) {
      messagesToSend = [
        {
          id: 'system-prompt',
          role: 'system' as const,
          content: systemPrompt.trim(),
          timestamp: Date.now(),
        },
        ...messagesToSend,
      ]
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
          thinkingEndedAt = Date.now()
        }

        chatStore.updateMessage(assistantMessage.id, {
          content: fullContent,
          reasoning_content: fullReasoningContent || undefined,
          reasoningDurationMs:
            thinkingEndedAt > thinkingStartedAt ? thinkingEndedAt - thinkingStartedAt : undefined,
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
        if (conversationId) maybeGenerateTitle(conversationId, fullContent)
      },
      (err) => {
        // 错误
        console.error('Chat error:', err)
        const possibleCors = isLikelyCorsError(err)
        error.value = possibleCors
          ? t('errors.possibleCors')
          : (describeError(err, t) ?? err.message)
        chatStore.updateMessage(assistantMessage.id, {
          isStreaming: false,
        })
        chatStore.isGenerating = false
        abortControllerRef.value = null
        toast.error(
          possibleCors
            ? t('errors.possibleCors')
            : (summarizeError(err, t) ?? t('chat.errors.sendFailed')),
        )
      },
      abortControllerRef.value.signal,
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    const possibleCors = isLikelyCorsError(err)
    error.value = possibleCors
      ? t('errors.possibleCors')
      : (describeError(err, t) ??
        (err instanceof Error ? err.message : t('chat.errors.sendFailed')))
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

/**
 * 第一轮问答结束后，让模型给这轮对话起个标题。
 * 只在「一条用户消息 + 一条 AI 回复」时触发一次，失败就静默保留原标题。
 */
const maybeGenerateTitle = async (conversationId: string, assistantContent: string) => {
  const conversation = chatStore.conversations.find((c) => c.id === conversationId)
  const userMessage = conversation?.messages[0]?.content

  if (
    !conversation ||
    conversation.messages.length !== 2 ||
    conversation.titleIsManual ||
    !userMessage ||
    !assistantContent
  ) {
    return
  }

  // 用这个会话自己的模型，而不是当前选中的，避免用户中途切了对话
  const model =
    settingsStore.models.find((m) => m.id === conversation.modelId) || settingsStore.defaultModel
  if (!model) return

  try {
    const service = new ChatService(model.baseUrl, modelRequestOptions(model))
    const title = cleanTitle(
      await service.complete(buildTitlePrompt(userMessage, assistantContent)),
    )
    if (title) chatStore.applyAutoTitle(conversationId, title)
  } catch (err) {
    // 标题只是锦上添花，失败不打扰用户
    console.error('Failed to generate title:', err)
  }
}

// 进入编辑模式：把原消息写回输入框，发送时从这条消息开始截断
const startEdit = (messageId: string) => {
  const message = messages.value.find((m) => m.id === messageId)
  if (!message) return

  editingMessageId.value = messageId
  inputText.value = message.content
  error.value = ''
  focusInput()

  // 光标移到末尾，方便直接续写
  nextTick(() => {
    const input = document.getElementById('chat-main-input')
    if (input instanceof HTMLTextAreaElement) {
      input.setSelectionRange(input.value.length, input.value.length)
    }
  })
}

// 取消编辑：清空输入框，什么也不做
const cancelEdit = () => {
  editingMessageId.value = null
  inputText.value = ''
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
      <AlertDescription class="whitespace-pre-line">{{ error }}</AlertDescription>
    </Alert>

    <!-- 消息列表：底边比输入框顶边低 24px（= rounded-3xl 的圆角半径），
         滚动的文字会从输入框圆角下面滑过，形成被盖住的悬浮感 -->
    <div ref="messagesContainerRef" class="flex-1 overflow-y-auto px-6 py-6 -mb-6">
      <div
        v-if="messages.length === 0"
        class="flex flex-col items-center justify-center min-h-full text-center"
      >
        <Bot class="w-20 h-20 mb-6 text-blue-500 opacity-50" />
        <h2 class="text-2xl font-bold mb-2 text-gray-700 dark:text-gray-300">
          {{ t('common.title') }}
        </h2>
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          {{ t('chat.emptyState') }}
        </p>
        <!-- 设置了系统提示词时紧贴欢迎语显示，不再撑出滚动条 -->
        <SystemPromptBlock class="w-full max-w-md text-left" />
        <div
          v-if="!currentModel"
          class="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg"
        >
          <AlertCircle class="inline-block w-4 h-4 mr-1" />
          {{ t('chat.errors.noModel') }}
        </div>
      </div>

      <!-- 系统提示词显示 -->
      <SystemPromptBlock v-if="messages.length > 0" class="mb-6" />

      <template v-for="(message, index) in messages" :key="message.id">
        <!-- 编辑模式：分割线标出「这条及以下会被替换」的边界 -->
        <div
          v-if="message.id === editingMessageId"
          class="mb-4 flex items-center gap-3 text-xs text-muted-foreground"
        >
          <div class="h-px flex-1 bg-border"></div>
          <span class="shrink-0">{{ t('chat.editNotice') }}</span>
          <Button variant="ghost" size="sm" class="h-6 shrink-0 px-2 text-xs" @click="cancelEdit">
            {{ t('chat.cancelEdit') }}
          </Button>
          <div class="h-px flex-1 bg-border"></div>
        </div>

        <MessageItem
          :message="message"
          :is-in-context="isMessageInContext(index)"
          @edit="startEdit"
        />
      </template>
    </div>

    <!-- 输入区域：悬浮在底部的卡片，不再用分割线隔开 -->
    <div class="relative z-10 px-4 pb-4">
      <InputGroup
        class="rounded-3xl bg-background shadow-lg dark:bg-background has-[[data-slot=input-group-control]:focus-visible]:border-foreground/20 has-[[data-slot=input-group-control]:focus-visible]:ring-foreground/10"
      >
        <InputGroupTextarea
          id="chat-main-input"
          v-model="inputText"
          :placeholder="t('chat.inputPlaceholder')"
          @keydown="handleKeyDown"
          class="min-h-16 max-h-50 resize-none md:text-base"
        />
        <InputGroupAddon align="block-end" class="justify-end">
          <!-- 对话配置按钮 -->
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <InputGroupButton
                  variant="ghost"
                  size="icon-xs"
                  @click="conversationConfigOpen = true"
                  :disabled="isGenerating"
                >
                  <Sliders class="size-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>
                {{ t('chat.conversationConfig') }}
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
              <DropdownMenuItem
                v-for="model in settingsStore.models"
                :key="model.id"
                @click="updateConversationModel(model.id)"
              >
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
          <TooltipProvider v-if="!isGenerating">
            <Tooltip>
              <TooltipTrigger as-child>
                <InputGroupButton
                  variant="default"
                  class="rounded-full"
                  size="icon-xs"
                  @click="sendMessage"
                  :disabled="!inputText.trim()"
                >
                  <ArrowUp class="size-4" />
                  <span class="sr-only">{{ t('chat.send') }}</span>
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>
                {{ t('chat.sendTooltip') }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <InputGroupButton
            v-else
            variant="destructive"
            class="rounded-full"
            size="icon-xs"
            @click="stopGenerating"
          >
            <StopCircle class="size-4" />
            <span class="sr-only">{{ t('chat.stop') }}</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  </div>

  <!-- 模型管理弹窗 -->
  <ModelManagement v-model:open="modelManagementOpen" />

  <!-- 对话配置弹窗 -->
  <ConversationConfig v-model:open="conversationConfigOpen" />
</template>
