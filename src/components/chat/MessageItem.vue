<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { Message } from '@/types/chat'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Bot, Lightbulb } from 'lucide-vue-next'
import { renderMarkdown } from '@/lib/markdown'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  message: Message
  isInContext?: boolean
}>()

const { t } = useI18n()
const isUser = computed(() => props.message.role === 'user')

const formattedTime = computed(() => {
  return new Date(props.message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
})

// 渲染 Markdown 内容
const renderedContent = computed(() => {
  // 用户消息保持纯文本
  if (isUser.value) {
    return props.message.content
  }
  // AI 消息渲染为 Markdown
  let html = renderMarkdown(props.message.content)

  // 如果正在流式传输，在HTML末尾添加光标
  if (props.message.isStreaming) {
    html = html.trimEnd()
    // 在最后一个标签前插入光标
    const lastTagMatch = html.match(/<\/[^>]+>$/)
    if (lastTagMatch) {
      const insertPos = html.lastIndexOf(lastTagMatch[0])
      html = html.slice(0, insertPos) +
        '<span class="inline-block w-2 h-4 ml-1 bg-current animate-pulse align-middle"></span>' +
        html.slice(insertPos)
    } else {
      // 如果没有结束标签，直接追加
      html += '<span class="inline-block w-2 h-4 ml-1 bg-current animate-pulse align-middle"></span>'
    }
  }

  return html
})

const renderedReasoningContent = computed(() => {
  return props.message.reasoning_content
    ? renderMarkdown(props.message.reasoning_content)
    : ''
})

// thinking内容容器引用
const thinkingContentRef = ref<HTMLElement | null>(null)

// 监听thinking内容变化，自动滚动到底部
watch(
  () => props.message.reasoning_content,
  () => {
    if (props.message.reasoning_content && thinkingContentRef.value) {
      nextTick(() => {
        if (thinkingContentRef.value) {
          thinkingContentRef.value.scrollTop = thinkingContentRef.value.scrollHeight
        }
      })
    }
  }
)
</script>

<template>
  <div class="flex gap-3 mb-4" :class="[
    isUser ? 'flex-row-reverse' : 'flex-row',
    !isInContext && 'opacity-50'
  ]">
    <!-- 头像 -->
    <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
      :class="isUser ? 'bg-blue-500' : 'bg-green-500'">
      <User v-if="isUser" class="w-5 h-5 text-white" />
      <Bot v-else class="w-5 h-5 text-white" />
    </div>

    <!-- 消息内容 -->
    <div class="flex-1 max-w-[80%]">
      <!-- 超出上下文标识 -->
      <div v-if="!isInContext" class="mb-1">
        <Badge variant="outline" class="text-xs text-muted-foreground">
          {{ t('chat.outOfContext') }}
        </Badge>
      </div>

      <!-- Thinking内容 (如果有) -->
      <Card v-if="message.reasoning_content"
        class="p-3 mb-2 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 gap-2">
        <div class="flex items-center gap-2">
          <Lightbulb class="w-4 h-4 text-amber-600 dark:text-amber-400"
            :class="message.isStreaming && 'animate-pulse'" />
          <Badge variant="outline" class="text-xs border-amber-300 dark:border-amber-700">
            {{ message.isStreaming ? t('chat.thinkingInProgress') : t('chat.thinkingComplete') }}
          </Badge>
        </div>
        <div ref="thinkingContentRef"
          class="text-sm text-gray-700 dark:text-gray-300 markdown-body max-h-25 overflow-y-auto"
          v-html="renderedReasoningContent">
        </div>
      </Card>

      <!-- 主要消息内容 -->
      <Card class="p-3" :class="isUser
        ? 'bg-blue-500 text-white border-blue-500'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        ">
        <div v-if="isUser" class="text-sm whitespace-pre-wrap wrap-break-words">
          {{ message.content }}
          <span v-if="message.isStreaming" class="inline-block w-2 h-4 ml-1 bg-current animate-pulse"></span>
        </div>
        <div v-else class="text-sm markdown-body" v-html="renderedContent"></div>
      </Card>

      <!-- 时间戳 -->
      <div class="text-xs text-gray-400 mt-1 px-1" :class="isUser ? 'text-right' : 'text-left'">
        {{ formattedTime }}
      </div>
    </div>
  </div>
</template>
