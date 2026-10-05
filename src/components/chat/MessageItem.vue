<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { Message } from '@/types/chat'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Lightbulb } from 'lucide-vue-next'
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
      html =
        html.slice(0, insertPos) +
        '<span class="inline-block w-2 h-4 ml-1 bg-current animate-pulse align-middle"></span>' +
        html.slice(insertPos)
    } else {
      // 如果没有结束标签，直接追加
      html +=
        '<span class="inline-block w-2 h-4 ml-1 bg-current animate-pulse align-middle"></span>'
    }
  }

  return html
})

const renderedReasoningContent = computed(() => {
  return props.message.reasoning_content ? renderMarkdown(props.message.reasoning_content) : ''
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
  },
)
</script>

<template>
  <div
    class="flex gap-3 mb-4"
    :class="[isUser ? 'flex-row-reverse' : 'flex-row', !isInContext && 'opacity-50']"
  >
    <!-- 头像：只有用户保留，AI 回复直接是文字 -->
    <div
      v-if="isUser"
      class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900"
    >
      <User class="w-5 h-5 text-blue-700 dark:text-blue-100" />
    </div>

    <!-- 消息内容：宽度随文字伸缩，最多 80% -->
    <div class="w-fit max-w-[80%]">
      <!-- 超出上下文标识 -->
      <div v-if="!isInContext" class="mb-1">
        <Badge variant="outline" class="text-xs text-muted-foreground">
          {{ t('chat.outOfContext') }}
        </Badge>
      </div>

      <!-- Thinking 内容 (如果有)：左侧细线 + 灰字，不用卡片 -->
      <div v-if="message.reasoning_content" class="mb-2 space-y-1">
        <div class="flex items-center gap-2">
          <Lightbulb
            class="w-4 h-4 text-amber-600 dark:text-amber-400"
            :class="message.isStreaming && 'animate-pulse'"
          />
          <Badge variant="outline" class="text-xs border-amber-300 dark:border-amber-700">
            {{ message.isStreaming ? t('chat.thinkingInProgress') : t('chat.thinkingComplete') }}
          </Badge>
        </div>
        <div
          ref="thinkingContentRef"
          class="text-sm text-muted-foreground markdown-body max-h-25 overflow-y-auto border-l-2 border-amber-200 pl-3 dark:border-amber-800"
          v-html="renderedReasoningContent"
        ></div>
      </div>

      <!-- 用户消息：淡色气泡 -->
      <Card
        v-if="isUser"
        class="p-3 bg-blue-100 text-blue-950 border-blue-100 dark:bg-blue-900/60 dark:text-blue-50 dark:border-blue-900/40"
      >
        <div class="text-base whitespace-pre-wrap wrap-break-word">
          {{ message.content }}
          <span
            v-if="message.isStreaming"
            class="inline-block w-2 h-4 ml-1 bg-current animate-pulse"
          ></span>
        </div>
      </Card>

      <!-- AI 回复：无气泡，只剩文字 -->
      <div v-else class="text-base markdown-body" v-html="renderedContent"></div>

      <!-- 时间戳 -->
      <div class="text-xs text-gray-400 mt-1 px-1" :class="isUser ? 'text-right' : 'text-left'">
        {{ formattedTime }}
      </div>
    </div>
  </div>
</template>
