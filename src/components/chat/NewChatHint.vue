<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { newChatShortcutLabel } from '@/lib/shortcuts'

const { t } = useI18n()

// 文案和键位标签必须在同一行：TooltipContent 是块级流，之前用的是 <p> + <kbd>，
// kbd 会掉到第二行，所以这里用 flex 行把它们箍在一起
// （注意：模板里别在这层之前写注释，否则根会变成 Fragment，测试拿不到 element）
</script>

<template>
  <span class="flex items-center gap-1.5 whitespace-nowrap">
    {{ t('chat.newConversation') }}
    <kbd
      class="rounded border border-current/25 px-1 py-0.5 font-sans text-[10px] leading-none opacity-70"
    >
      {{ newChatShortcutLabel }}
    </kbd>
  </span>
</template>
