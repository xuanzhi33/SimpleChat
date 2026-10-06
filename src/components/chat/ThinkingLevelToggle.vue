<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { thinkingLevelLabelKey, thinkingStops } from '@/lib/thinking'
import { InputGroupButton } from '@/components/ui/input-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ThinkingStyle } from '@/configs/providers'
import type { ThinkingLevel } from '@/types/chat'

const { t } = useI18n()

const props = defineProps<{
  level?: ThinkingLevel
  style: ThinkingStyle
  /** 换对话就要忘掉记住的档位，所以得知道现在是谁 */
  conversationId?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'setLevel', value: ThinkingLevel | undefined): void
}>()

/** 档位颜色按「想得多不多」分档：关/默认是灰的，越往右越烫 */
const LEVEL_CLASS: Record<ThinkingLevel, string> = {
  none: 'text-muted-foreground',
  low: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  high: 'text-orange-600 dark:text-orange-400',
  max: 'text-red-600 dark:text-red-400',
}

/** 认不出的服务商（LLM Gate / 自定义地址）没有档位可切，整块不渲染 */
const supported = computed(() => thinkingStops(props.style).length > 0)

const off = computed(() => props.level === 'none')
const label = computed(() => t(thinkingLevelLabelKey(props.style, props.level)))
const levelClass = computed(() =>
  props.level ? LEVEL_CLASS[props.level] : 'text-muted-foreground',
)

/**
 * 记住上次不是「关」的档位，好在「关」和它之间来回切。
 * 「默认」也是一个要记住的档位（用户主动选过），不是「没记住」——所以这里比较的是
 * 「不是关」而不是「为真」。故意不持久化：只活在这轮页面里，切对话（或重新进来）时
 * 重新看当前档位，当前就是「关」时切回去就落到「默认」。
 */
const lastLevel = ref<ThinkingLevel>()

watch(
  () => props.conversationId,
  () => {
    lastLevel.value = props.level === 'none' ? undefined : props.level
  },
  { immediate: true },
)

watch(
  () => props.level,
  (level) => {
    if (level !== 'none') lastLevel.value = level
  },
)

const nextLevel = computed<ThinkingLevel | undefined>(() => (off.value ? lastLevel.value : 'none'))
const nextLabel = computed(() => t(thinkingLevelLabelKey(props.style, nextLevel.value)))
</script>

<template>
  <TooltipProvider v-if="supported">
    <Tooltip>
      <TooltipTrigger as-child>
        <InputGroupButton
          variant="ghost"
          class="text-xs font-normal"
          :disabled="disabled"
          @click="emit('setLevel', nextLevel)"
        >
          <span class="text-muted-foreground">{{ t('chat.thinkingEffort.title') }}</span>
          <span :class="levelClass">{{ label }}</span>
        </InputGroupButton>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('chat.thinkingEffort.toggleTo', { level: nextLabel }) }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
