<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { resolveConversationModel } from '@/lib/model'
import {
  thinkingLevelColors,
  thinkingStopIndex,
  thinkingStops,
  thinkingStyleOf,
} from '@/lib/thinking'
import { findProviderByUrl } from '@/configs/providers'
import SystemPromptPresets from './SystemPromptPresets.vue'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { SlidersVertical } from '@lucide/vue'

const { t } = useI18n()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const conversation = computed(() => chatStore.activeConversation)
const conversationId = computed(() => conversation.value?.id ?? '')

// 思考强度：按当前模型的服务商决定档位；认不出服务商（LLM Gate / 自定义地址）就不显示这一项
const model = computed(() =>
  resolveConversationModel(conversation.value, settingsStore.models, settingsStore.defaultModel),
)
const provider = computed(() => (model.value ? findProviderByUrl(model.value.baseUrl) : undefined))
const stops = computed(() => thinkingStops(thinkingStyleOf(model.value)))

// 滑块值：本地状态，拖动过程中只动它，松手（valueCommit）才写库
const levelIndex = ref<number[]>([0])
const currentStop = computed(() => stops.value[levelIndex.value[0] ?? 0])
const currentStopLabel = computed(() => currentStop.value?.labelKey ?? '')
// 档位名和滑轨都按当前档位配色
const currentColors = computed(() => thinkingLevelColors(currentStop.value?.level))

const syncLevelIndex = () => {
  levelIndex.value = [
    thinkingStopIndex(thinkingStyleOf(model.value), conversation.value?.thinkingLevel),
  ]
}

watch([model, () => conversation.value?.thinkingLevel], syncLevelIndex, { immediate: true })

const commitLevel = (value: number[]) => {
  if (!conversationId.value) return
  chatStore.updateConversationSettings(conversationId.value, {
    thinkingLevel: stops.value[value[0] ?? 0]?.level,
  })
}

// 系统提示词：本地编辑，防抖落库（以前只改内存，刷新就丢）
const systemPrompt = ref('')

watch(
  conversation,
  (value) => {
    systemPrompt.value = value?.systemPrompt || ''
  },
  { immediate: true },
)

const saveSystemPrompt = useDebounceFn((id: string, value: string) => {
  chatStore.updateConversationSettings(id, { systemPrompt: value })
}, 400)

watch(systemPrompt, (value) => {
  if (conversationId.value) saveSystemPrompt(conversationId.value, value)
})

// 防抖还没到点就关弹窗 / 卸载时，立刻补一次（写同样的值不会有副作用）
const flushSystemPrompt = () => {
  if (conversationId.value)
    chatStore.updateConversationSettings(conversationId.value, { systemPrompt: systemPrompt.value })
}

watch(
  () => props.open,
  (open) => {
    if (!open) flushSystemPrompt()
  },
)

onBeforeUnmount(flushSystemPrompt)
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogScrollContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <SlidersVertical />
          {{ t('chat.conversationConfig') }}
        </DialogTitle>
        <DialogDescription>
          {{ t('chat.conversationConfigDescription') }}
        </DialogDescription>
      </DialogHeader>

      <!-- 思考强度：只在内置服务商（认得出来风格）上显示 -->
      <div v-if="stops.length" class="space-y-3">
        <div class="flex items-baseline justify-between gap-3">
          <!-- reka 的滑块不给 thumb 传 aria-label，label 就不写 for 了 -->
          <Label>{{ t('chat.thinkingEffort.title') }}</Label>
          <span class="text-sm font-medium" :class="currentColors.text">{{
            t(currentStopLabel)
          }}</span>
        </div>

        <Slider
          v-model="levelIndex"
          :min="0"
          :max="stops.length - 1"
          :step="1"
          :class="currentColors.range"
          @value-commit="commitLevel"
        />

        <!-- 刻度：每一格都用自己的颜色 -->
        <div class="flex justify-between text-[10px]">
          <span
            v-for="stop in stops"
            :key="stop.labelKey"
            :class="thinkingLevelColors(stop.level).text"
          >
            {{ t(stop.labelKey) }}
          </span>
        </div>

        <p class="text-xs text-muted-foreground">
          {{ t('chat.thinkingEffort.hint', { provider: provider?.name ?? '' }) }}
        </p>
      </div>

      <Separator v-if="stops.length" />

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <Label for="system-prompt">{{ t('chat.systemPrompt') }}</Label>
          <SystemPromptPresets v-model="systemPrompt" />
        </div>
        <Textarea
          id="system-prompt"
          v-model="systemPrompt"
          :placeholder="t('chat.systemPromptPlaceholder')"
          class="min-h-32 max-h-60 resize-none"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('chat.systemPromptDescription') }}
        </p>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>
