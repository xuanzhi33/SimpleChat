<script setup lang="ts">
import { computed } from 'vue'
import { Cloud, Lock } from '@lucide/vue'
import { findProviderByUrl, type ProviderPreset } from '@/configs/providers'
import { isApiModel } from '@/lib/model'
import type { Model } from '@/types/chat'

/**
 * 模型/服务商图标：认得出来的服务商用它的 logo（单色 logo 深色模式反色），
 * api 模型认不出来用云朵，LLM Gate 用锁。
 *
 * 传 `model`（列表、模型选择器）或 `provider`（服务商下拉）其中一个。
 */
const props = defineProps<{
  model?: Model
  provider?: ProviderPreset
}>()

const logo = computed(
  () =>
    props.provider ??
    (props.model && isApiModel(props.model) ? findProviderByUrl(props.model.baseUrl) : undefined),
)

const fallbackIcon = computed(() => (props.model && !isApiModel(props.model) ? Lock : Cloud))
</script>

<template>
  <img
    v-if="logo"
    :src="logo.logo"
    alt=""
    class="size-4 shrink-0"
    :class="logo.logoInvert && 'dark:invert'"
  />
  <component :is="fallbackIcon" v-else class="size-4 shrink-0" />
</template>
