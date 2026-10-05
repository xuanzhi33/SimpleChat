<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import type { Message } from '@/types/chat'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Lightbulb, Copy, Check, ChevronDown, Pencil } from 'lucide-vue-next'
import MarkdownRender from 'markstream-vue'
import { useSettingsStore } from '@/stores/settings'
import { dayBucket } from '@/lib/time'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  message: Message
  isInContext?: boolean
  /** 正在被编辑、即将被替换掉的那条消息 */
  isEditing?: boolean
}>()

const emit = defineEmits<{
  edit: [messageId: string]
}>()

const { t, d } = useI18n()
const settingsStore = useSettingsStore()
const isUser = computed(() => props.message.role === 'user')

// 复制消息原文（AI 消息即 Markdown 源码）；legacy 回退兼容没有 navigator.clipboard 的 http 环境
const { copy, copied } = useClipboard({
  source: () => props.message.content,
  legacy: true,
})

// 时间戳只分三档：今天给钟点、昨天加「昨天」、更早一律带年份（钟点跟随语言，zh 24h / en AM-PM）。
// 不挂定时器，跨午夜就靠下一次重渲染刷新；悬停 tooltip 始终给完整日期时间
const formattedTime = computed(() => {
  const ts = props.message.timestamp
  switch (dayBucket(ts)) {
    case 'yesterday':
      return t('chat.timestampYesterday', { time: d(ts, 'time') })
    case 'older':
      return d(ts, 'dateTimeWithYear')
    default:
      return d(ts, 'time')
  }
})
const formattedDateTime = computed(() => d(props.message.timestamp, 'dateTime'))

// 思考耗时（秒，保留一位小数；不足 0.1 秒也显示 0.1）
const thinkingSeconds = computed(() =>
  props.message.reasoningDurationMs
    ? Math.max(0.1, props.message.reasoningDurationMs / 1000).toFixed(1)
    : '',
)

// 思考阶段：有思考内容且还没开始输出正文（收到首个正文增量就算结束）
const isThinking = computed(() => !!props.message.isStreaming && !props.message.thinkingDone)

// 默认折叠：历史消息（一加载出来就是完成态）收起，正在思考的消息展开
const thinkingCollapsed = ref(!isThinking.value)

// 思考中展开，思考一结束（正文开始）自动收起；之后手动展开不会被覆盖
watch(isThinking, (thinking) => {
  thinkingCollapsed.value = !thinking
})
</script>

<template>
  <div
    class="flex mb-4"
    :data-message-id="message.id"
    :class="[
      isUser ? 'justify-end' : 'justify-start',
      !isInContext && 'opacity-50',
      isEditing && 'opacity-40',
    ]"
  >
    <!-- 消息内容：用户气泡随文字伸缩（最多 80%）并靠右，AI 回复占满 -->
    <div :class="isUser ? 'w-fit max-w-[80%]' : 'min-w-0 flex-1'">
      <!-- 超出上下文标识 -->
      <div v-if="!isInContext" class="mb-1">
        <Badge variant="outline" class="text-xs text-muted-foreground">
          {{ t('chat.outOfContext') }}
        </Badge>
      </div>

      <!-- Thinking 内容 (如果有)：灯泡/状态/箭头整行可点击，正文可折叠 -->
      <div v-if="message.reasoning_content" class="mb-2">
        <button
          type="button"
          class="flex w-fit items-center rounded-sm text-xs leading-4 text-muted-foreground transition-colors outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          :aria-expanded="!thinkingCollapsed"
          @click="thinkingCollapsed = !thinkingCollapsed"
        >
          <Lightbulb class="w-4 h-4 mr-3 shrink-0" :class="isThinking && 'animate-pulse'" />
          <span>
            {{ isThinking ? t('chat.thinkingInProgress') : t('chat.thinkingComplete') }}
          </span>
          <Badge
            v-if="!isThinking && thinkingSeconds"
            variant="secondary"
            class="ml-1.5 px-1.5 py-0 text-[11px] font-normal"
          >
            {{ t('chat.thinkingDuration', { seconds: thinkingSeconds }) }}
          </Badge>
          <ChevronDown
            class="ml-1.5 size-3.5 shrink-0 transition-transform"
            :class="thinkingCollapsed && '-rotate-90'"
          />
        </button>

        <div
          class="grid transition-[grid-template-rows] duration-200 ease-out"
          :class="thinkingCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
        >
          <div class="overflow-hidden">
            <div class="mt-1.5 flex gap-3">
              <!-- 细线顶端与右侧思考正文顶端对齐 -->
              <div class="flex w-4 shrink-0 justify-center">
                <div class="w-px bg-border"></div>
              </div>
              <!-- 不加限高 / overflow：整段思考直接铺开，不用内部滚动条 -->
              <div class="min-w-0 flex-1 text-muted-foreground">
                <MarkdownRender
                  class="thinking-md"
                  mode="chat"
                  fade
                  :content="message.reasoning_content!"
                  :final="!isThinking"
                  :is-dark="settingsStore.isDarkMode"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 用户消息：淡色气泡（全圆角，上下内边距收紧） -->
      <Card
        v-if="isUser"
        class="w-fit max-w-full ml-auto rounded-full px-3 py-1.5 bg-blue-100 text-blue-950 border-blue-100 dark:bg-blue-900/60 dark:text-blue-50 dark:border-blue-900/40"
      >
        <div class="text-base whitespace-pre-wrap wrap-break-word">
          {{ message.content }}
        </div>
      </Card>

      <!-- AI 回复：无气泡，无头像，交给 markstream 流式渲染；
           失败时详情用红色接在（可能有半截的）正文下面。详情可能多行 → whitespace-pre-line -->
      <template v-else>
        <MarkdownRender
          v-if="message.content"
          mode="chat"
          fade
          :content="message.content"
          :final="!message.isStreaming"
          :is-dark="settingsStore.isDarkMode"
        />
        <p
          v-if="message.error"
          class="text-sm whitespace-pre-line text-destructive"
          :class="message.content && 'mt-1.5'"
        >
          {{ message.error }}
        </p>
      </template>

      <!-- 时间戳 + 复制 + 编辑：AI 消息流式期间不显示，回答结束才淡入。
           AI 这边不能加 px-*：markstream 的段落没有任何水平内边距，一加时间戳就会比正文文字右移 -->
      <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0">
        <div
          v-if="!message.isStreaming"
          class="mt-1 flex items-center gap-1 text-xs text-gray-400"
          :class="isUser ? 'justify-end px-1' : 'justify-start'"
        >
          <TooltipProvider>
            <!-- 时间戳：悬停看完整日期时间 -->
            <Tooltip>
              <TooltipTrigger as-child>
                <span>{{ formattedTime }}</span>
              </TooltipTrigger>
              <TooltipContent>{{ formattedDateTime }}</TooltipContent>
            </Tooltip>
            <Tooltip v-if="message.content">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="size-6 text-gray-400 hover:text-foreground"
                  :aria-label="copied ? t('chat.copied') : t('chat.copy')"
                  @click="copy()"
                >
                  <Check v-if="copied" class="size-3.5" />
                  <Copy v-else class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ copied ? t('chat.copied') : t('chat.copy') }}</TooltipContent>
            </Tooltip>
            <!-- 编辑：把这条消息写回输入框，发送时从这条开始截断历史 -->
            <Tooltip v-if="isUser">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="size-6 text-gray-400 hover:text-foreground"
                  :aria-label="t('chat.editMessage')"
                  @click="emit('edit', message.id)"
                >
                  <Pencil class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ t('chat.editMessage') }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </Transition>
    </div>
  </div>
</template>
