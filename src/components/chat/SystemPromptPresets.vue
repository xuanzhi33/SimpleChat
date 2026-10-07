<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import type { SystemPromptPreset } from '@/types/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Trash2 } from '@lucide/vue'

const props = defineProps<{ modelValue: string }>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

const open = ref(false)

// 保存：在按钮原位展开一行名称输入。不开嵌套 Dialog —— 焦点陷阱和弹窗内滚动容器容易打架
const saving = ref(false)
const name = ref('')

const canSave = computed(() => props.modelValue.trim().length > 0)

/** 默认名取内容第一个非空行，太长就截断 */
const defaultName = () =>
  (props.modelValue.split('\n').find((line) => line.trim()) ?? '').trim().slice(0, 20)

const openSave = () => {
  name.value = defaultName()
  saving.value = true
  // Input 是组件，ref 拿不到原生节点，按 ChatPanel 的方式从 document 取
  nextTick(() => document.getElementById('system-prompt-preset-name')?.focus())
}

const confirmSave = () => {
  if (!name.value.trim()) return
  settingsStore.addSystemPromptPreset(name.value.trim(), props.modelValue)
  saving.value = false
}

// 填入 = 覆盖当前内容（落库交给外层的防抖）
const apply = (preset: SystemPromptPreset) => {
  emit('update:modelValue', preset.content)
  open.value = false
}

/** 列表里显示的内容摘要：换行压成空格，截断交给 truncate */
const previewOf = (preset: SystemPromptPreset) => preset.content.replace(/\s+/g, ' ').trim()
</script>

<template>
  <div class="flex min-w-0 items-center justify-end gap-1">
    <!-- 展开态：名称输入 + 保存/取消，占的就是右边两个按钮的位置，行高不变 -->
    <template v-if="saving">
      <Input
        id="system-prompt-preset-name"
        v-model="name"
        :placeholder="t('chat.systemPromptPresets.namePlaceholder')"
        class="h-8 w-40"
        @keydown.enter="confirmSave"
      />
      <Button variant="ghost" size="sm" :disabled="!name.trim()" @click="confirmSave">
        {{ t('chat.systemPromptPresets.confirm') }}
      </Button>
      <Button variant="ghost" size="sm" class="text-muted-foreground" @click="saving = false">
        {{ t('chat.systemPromptPresets.cancel') }}
      </Button>
    </template>

    <template v-else>
      <Popover v-model:open="open">
        <PopoverTrigger as-child>
          <Button variant="ghost" size="sm" class="text-muted-foreground">
            {{ t('chat.systemPromptPresets.title') }}
            <ChevronDown class="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-64 p-1">
          <!-- 没预设时也留着入口，不然这功能发现不了 -->
          <p
            v-if="!settingsStore.systemPromptPresets.length"
            class="px-2 py-4 text-center text-xs text-muted-foreground"
          >
            {{ t('chat.systemPromptPresets.empty') }}
          </p>

          <div
            v-for="preset in settingsStore.systemPromptPresets"
            :key="preset.id"
            class="group flex items-center gap-0.5 rounded-sm hover:bg-accent"
          >
            <button
              type="button"
              class="min-w-0 flex-1 px-2 py-1.5 text-left"
              @click="apply(preset)"
            >
              <span class="block truncate text-sm">{{ preset.name }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{
                previewOf(preset)
              }}</span>
            </button>
            <button
              type="button"
              class="shrink-0 rounded-sm p-1.5 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
              :aria-label="t('chat.systemPromptPresets.delete')"
              @click="settingsStore.deleteSystemPromptPreset(preset.id)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground"
        :disabled="!canSave"
        @click="openSave"
      >
        {{ t('chat.systemPromptPresets.save') }}
      </Button>
    </template>
  </div>
</template>
