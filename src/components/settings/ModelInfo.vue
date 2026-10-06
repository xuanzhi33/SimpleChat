<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { AudioLines, Boxes, FileText, Image as ImageIcon, Type, Video } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { formatContextWindow, type RemoteModel } from '@/lib/models'

const props = defineProps<{ model: RemoteModel }>()

const { t } = useI18n()

/** 模态用纯图标展示，认不出来的新模态退化成 Boxes + 原文 tooltip */
const MODALITY_ICONS: Record<string, Component> = {
  text: Type,
  image: ImageIcon,
  file: FileText,
  audio: AudioLines,
  video: Video,
}

const MODALITY_LABEL_KEYS: Record<string, string> = {
  text: 'setup.api.modalities.text',
  image: 'setup.api.modalities.image',
  file: 'setup.api.modalities.file',
  audio: 'setup.api.modalities.audio',
  video: 'setup.api.modalities.video',
}

const contextWindow = computed(() =>
  props.model.contextWindow ? formatContextWindow(props.model.contextWindow) : '',
)

const modalities = computed(() => props.model.inputModalities ?? [])

const hasInfo = computed(() => !!contextWindow.value || modalities.value.length > 0)

const modalityLabel = (modality: string) => {
  const key = MODALITY_LABEL_KEYS[modality]
  return key ? t(key) : modality
}
</script>

<template>
  <div class="space-y-2 rounded-lg border bg-muted/50 p-3 text-xs">
    <template v-if="hasInfo">
      <div v-if="contextWindow" class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">{{ t('setup.api.contextWindow') }}</span>
        <span class="font-medium" :title="String(model.contextWindow)">{{ contextWindow }}</span>
      </div>

      <div v-if="modalities.length" class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">{{ t('setup.api.inputModalities') }}</span>
        <div class="flex items-center gap-1">
          <Badge
            v-for="modality in modalities"
            :key="modality"
            variant="secondary"
            :title="modalityLabel(modality)"
          >
            <component :is="MODALITY_ICONS[modality] ?? Boxes" />
            <span class="sr-only">{{ modalityLabel(modality) }}</span>
          </Badge>
        </div>
      </div>
    </template>

    <p v-else class="text-muted-foreground">{{ t('setup.api.noModelInfo') }}</p>
  </div>
</template>
