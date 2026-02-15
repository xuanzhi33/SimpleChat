<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'
import SettingsItem from '@/components/settings/SettingsItem.vue'
import ModelManagement from '@/components/settings/ModelManagement.vue'
import { computed, ref } from 'vue'
import { AppWindow, Languages, Settings, SunMoon, Cpu, Trash2, Database, MessageSquare } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogScrollContent,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentComp,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const open = defineModel<boolean>('open', { default: false })

const settingsStore = useSettingsStore()
const { colorMode, language, contextLength } = storeToRefs(settingsStore)
const chatStore = useChatStore()

const { t, availableLocales } = useI18n()

const modelManagementOpen = ref(false)

// 上下文长度选项
const contextLengthOptions = computed(() => [
  { value: 1, label: t('settings.api.contextOptions.single') },
  { value: 5, label: t('settings.api.contextOptions.veryShort') },
  { value: 10, label: t('settings.api.contextOptions.standard') },
  { value: 25, label: t('settings.api.contextOptions.long') },
  { value: 100, label: t('settings.api.contextOptions.veryLong') },
  { value: 0, label: t('settings.api.contextOptions.unlimited') },
])

// 上下文长度（处理 Select 组件的类型转换）
const contextLengthValue = computed({
  get: () => contextLength.value,
  set: (val: number) => {
    contextLength.value = val
  }
})

const colorOptions = computed(() => {
  return ['light', 'dark', 'system'].map(mode => ({
    label: t(`settings.interface.colorModeOptions.${mode}`),
    value: mode
  }))
})

const localeOptions = computed(() => availableLocales.map(loc => ({
  label: t(`settings.interface.languageOptions.${loc}`),
  value: loc
})))

const sectionTitleClass = 'font-semibold text-muted-foreground border-b pt-3 pb-2'

const clearAllData = async () => {
  // 清空所有对话
  await chatStore.clearAllConversations()
  // 重置设置为默认值
  settingsStore.resetSettings()
}

</script>

<template>
  <Dialog v-model:open="open">
    <DialogScrollContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle class="text-2xl font-extrabold flex items-center">
          <Settings class="mr-2 size-6" />
          {{ t('settings.title') }}
        </DialogTitle>
      </DialogHeader>
      <section class="space-y-3">
        <h2 :class="sectionTitleClass" class="flex items-center">
          <AppWindow class="mr-2" />
          {{ t('settings.interface.title') }}
        </h2>

        <SettingsItem v-model="colorMode" :label="t('settings.interface.colorMode')" type="select" :icon="SunMoon"
          :options="colorOptions" />

        <SettingsItem v-model="language" :label="t('settings.interface.language')" type="select" :icon="Languages"
          :options="localeOptions" />
      </section>

      <section class="space-y-3">
        <h2 :class="sectionTitleClass" class="flex items-center">
          <Cpu class="mr-2" />
          {{ t('settings.models.section') }}
        </h2>

        <div class="space-y-1.5">
          <Button @click="modelManagementOpen = true" class="gap-2">
            <Cpu class="size-4" />
            {{ t('settings.models.manage') }}
          </Button>
          <p class="text-sm text-muted-foreground">
            {{ t('settings.models.manageDescription') }}
          </p>
        </div>

        <div class="space-y-3">
          <Label class="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MessageSquare class="size-6" />
            {{ t('settings.api.contextLength') }}
          </Label>
          <Select v-model="contextLengthValue">
            <SelectTrigger>
              <SelectValue :placeholder="t('settings.api.selectContextLength')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in contextLengthOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-sm text-muted-foreground">
            {{ t('settings.api.contextLengthDescription') }}
          </p>
        </div>
      </section>

      <section class="space-y-3">
        <h2 :class="sectionTitleClass" class="flex items-center">
          <Database class="mr-2" />
          {{ t('settings.data.title') }}
        </h2>

        <div class="space-y-1.5">
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="destructive" class="gap-2">
                <Trash2 class="size-4" />
                {{ t('settings.data.clearAllData') }}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContentComp>
              <AlertDialogHeader>
                <AlertDialogTitle>{{ t('settings.data.confirmClearAll') }}</AlertDialogTitle>
                <AlertDialogDescription>
                  {{ t('settings.data.confirmClearAllDescription') }}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{{ t('settings.data.cancel') }}</AlertDialogCancel>
                <AlertDialogAction @click="clearAllData"
                  class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {{ t('settings.data.confirm') }}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContentComp>
          </AlertDialog>
          <p class="text-sm text-muted-foreground">
            {{ t('settings.data.clearAllDataDescription') }}
          </p>
        </div>
      </section>
    </DialogScrollContent>
  </Dialog>

  <!-- 模型管理弹窗 -->
  <ModelManagement v-model:open="modelManagementOpen" />
</template>
