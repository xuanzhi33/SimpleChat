<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useClipboard } from '@vueuse/core'
import type { Message } from '@/types/chat'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Lightbulb, Copy, Check, ChevronDown, Pencil } from '@lucide/vue'
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

// HTML 代码块预览：允许 iframe 内跑脚本（→ sandbox="allow-scripts"）。
// 只给 allow-scripts，绝不给 allow-same-origin：srcdoc 文档会继承同源，
// 那样预览里的脚本就能读到 localStorage（模型列表里存着 apiKey）。
// HTML 代码块预览：允许 iframe 内跑脚本（→ sandbox="allow-scripts"）。
// 只给 allow-scripts，绝不给 allow-same-origin：srcdoc 文档会继承同源，
// 那样预览里的脚本就能读到 localStorage（模型列表里存着 apiKey）。
// （markstream 没导出 NodeRendererCodeBlockProps 类型，所以这里不做类型标注）
const codeBlockProps = { htmlPreviewAllowScripts: true }
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

// 思考内容容器
const thinkingContentRef = ref<HTMLElement | null>(null)

/** 折叠动画时长（模板里的过渡用它，免两处各写一个数） */
const THINKING_FOLD_MS = 200

/**
 * 是否给思考内容限高（不限定高时整段铺开）。
 * 只有「思考中自动展开」限高：等思考结束再解除的话，收起动画是从当前行高开始动画的，
 * 同时解除限高会让行高先被撑满再往回收 —— 看着就是“突然撑开一下”。
 * 所以等收起动画放完再解除（此时内容已经收成 0 高，看不出变化），之后手动展开就是全文。
 */
const thinkingHeightLimited = ref(isThinking.value)

// 思考中展开，思考一结束（正文开始）自动收起；之后手动展开不会被覆盖
watch(isThinking, (thinking) => {
  thinkingCollapsed.value = !thinking
  if (thinking) {
    thinkingHeightLimited.value = true
    return
  }
  window.setTimeout(() => (thinkingHeightLimited.value = false), THINKING_FOLD_MS)
})

// 限高时监听thinking内容变化，自动滚动到底部
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
          class="grid transition-[grid-template-rows] ease-out"
          :style="{ transitionDuration: `${THINKING_FOLD_MS}ms` }"
          :class="thinkingCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
        >
          <div class="overflow-hidden">
            <div class="mt-1.5 flex gap-3">
              <!-- 细线顶端与右侧思考正文顶端对齐 -->
              <div class="flex w-4 shrink-0 justify-center">
                <div class="w-px bg-border"></div>
              </div>
              <div
                ref="thinkingContentRef"
                class="min-w-0 flex-1 text-muted-foreground"
                :class="thinkingHeightLimited && 'max-h-25 overflow-y-auto'"
              >
                <MarkdownRender
                  class="thinking-md"
                  mode="chat"
                  fade
                  :content="message.reasoning_content!"
                  :final="!isThinking"
                  :is-dark="settingsStore.isDarkMode"
                  :code-block-props="codeBlockProps"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 用户消息：淡色气泡（上下内边距收紧）
           圆角不用 rounded-full：它会被 CSS 夹成「高度的一半」，多行气泡就在左/右边缘变成
           两个大圆弧。这里用 24px 封顶；单行气泡只有 38px 高（text-base 行高 24 + py-1.5 共 12
           + 上下边框 2），24px 超出会被 CSS 等比压回 19px，正好还是两端半圆的胶囊样 -->
      <Card
        v-if="isUser"
        class="w-fit max-w-full ml-auto rounded-3xl px-3 py-1.5 bg-blue-100 text-blue-950 border-blue-100 dark:bg-blue-900/60 dark:text-blue-50 dark:border-blue-900/40"
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
          :code-block-props="codeBlockProps"
        />
        <p
          v-if="message.error"
          class="text-sm whitespace-pre-line text-destructive"
          :class="message.content && 'mt-1.5'"
        >
          {{ message.error }}
        </p>
      </template>

      <!-- 时间戳 + 复制 + 编辑：AI 消息流式期间先占住位置（invisible 就是看不见、点不到、不进无障碍树），
           回答结束才淡入。先占位而不是事后插入，是因为结束时再撑高一行的话，这 28px 会把工具栏
           正好顶到输入框盖住的那条带里（外层列表是 -mb-6，底边比输入框顶边低 24px）。
           附带的好处：实时对话里正文和输入框之间留这一段，比文字贴着输入框更透气。
           AI 这边不能加 px-*：markstream 的段落没有任何水平内边距，一加时间戳就会比正文文字右移 -->
      <div
        class="mt-1 flex items-center gap-1 text-xs text-gray-400 transition-opacity duration-200"
        :class="[
          isUser ? 'justify-end px-1' : 'justify-start',
          message.isStreaming && 'invisible opacity-0',
        ]"
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
    </div>
  </div>
</template>
