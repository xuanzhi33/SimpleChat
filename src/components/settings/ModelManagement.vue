<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogHeader, DialogTitle, DialogScrollContent } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Trash,
  SquarePen,
  Check,
  X,
  Star,
  Sparkles,
  LoaderCircle,
  ShieldCheck,
  Cloud,
  Lock,
  Cpu,
  KeyRound,
  Link,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { ButtonGroup } from '../ui/button-group'
import AddModelDialog from './AddModelDialog.vue'
import { ChatService, isLikelyCorsError } from '@/lib/chat-service'
import { describeError } from '@/lib/errors'
import { isApiModel, modelKind } from '@/lib/model'
import { findProviderByUrl } from '@/configs/providers'
import type { Model, ModelKind } from '@/types/chat'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const settingsStore = useSettingsStore()
const { models, defaultModelId } = storeToRefs(settingsStore)

// 添加模型走独立弹窗（和欢迎弹窗同一套表单）
const addDialogOpen = ref(false)

// 编辑是「在卡片里展开」，所以同一时刻只展开一张
const editingModelId = ref<string | null>(null)
const isEditing = computed(() => editingModelId.value !== null)

// 编辑表单
const modelName = ref('')
const modelBaseUrl = ref('')
// 模式（api / gate）在创建时就定了，编辑时只读
const editingKind = ref<ModelKind>('api')
const modelId = ref('')
const apiKey = ref('')
const isTesting = ref(false)

// 删除确认对话框
const deleteDialogOpen = ref(false)
const modelToDelete = ref<string | null>(null)

/** 模型里没存服务商，列表只能按 base url 反推（预设地址是选服务商时原样存进去的） */
const providerOf = (model: Model) =>
  isApiModel(model) ? findProviderByUrl(model.baseUrl) : undefined

const logoOf = (model: Model) => providerOf(model)?.logo

/** 单色 logo（用 currentColor 画的那种）在深色模式下要反色 */
const logoInvert = (model: Model) => !!providerOf(model)?.logoInvert

// 展开编辑（切到另一张卡片时，前一张会自动收起）
const startEdit = (id: string) => {
  const model = models.value.find((m) => m.id === id)
  if (!model) return

  editingModelId.value = id
  modelName.value = model.name
  modelBaseUrl.value = model.baseUrl
  editingKind.value = modelKind(model)
  modelId.value = model.model ?? ''
  apiKey.value = model.apiKey ?? ''
}

// 收起编辑
const cancelEdit = () => {
  editingModelId.value = null
  modelName.value = ''
  modelBaseUrl.value = ''
  editingKind.value = 'api'
  modelId.value = ''
  apiKey.value = ''
}

// 保存模型
const saveModel = () => {
  const name = modelName.value.trim()
  const baseUrl = modelBaseUrl.value.trim()

  if (!name) {
    toast.error(t('settings.models.nameRequired'))
    return
  }

  if (!baseUrl) {
    toast.error(t('settings.models.urlRequired'))
    return
  }

  const isApi = editingKind.value === 'api'
  const modelIdValue = modelId.value.trim()
  if (isApi && !modelIdValue) {
    toast.error(t('settings.models.modelIdRequired'))
    return
  }

  // 只按当前模式补字段：gate 传 { kind: 'gate' } 会清掉 api 专用字段
  const extra = isApi
    ? { kind: 'api' as const, model: modelIdValue, apiKey: apiKey.value.trim() || undefined }
    : { kind: 'gate' as const }

  if (!editingModelId.value) return

  settingsStore.updateModel(editingModelId.value, name, baseUrl, extra)
  toast.success(t('settings.models.updateSuccess'))
  cancelEdit()
}

// 确认删除模型
const confirmDelete = (id: string) => {
  modelToDelete.value = id
  deleteDialogOpen.value = true
}

// 删除模型
const deleteModel = () => {
  if (modelToDelete.value) {
    if (models.value.length <= 1) {
      toast.error(t('settings.models.cannotDeleteLast'))
      deleteDialogOpen.value = false
      return
    }

    settingsStore.deleteModel(modelToDelete.value)
    toast.success(t('settings.models.deleteSuccess'))
    deleteDialogOpen.value = false
    modelToDelete.value = null
  }
}

// 设置默认模型
const setDefaultModel = (id: string) => {
  defaultModelId.value = id
  toast.success(t('settings.models.defaultSet'))
}

// 脱敏显示 API Key
const maskKey = (key: string) => (key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '••••••')

// 测试连通性：让模型只回复 "OK"
const testModel = async () => {
  const baseUrl = modelBaseUrl.value.trim()
  if (!baseUrl) {
    toast.error(t('settings.models.urlRequired'))
    return
  }

  const isApi = editingKind.value === 'api'
  const modelIdValue = modelId.value.trim()
  if (isApi && !modelIdValue) {
    toast.error(t('settings.models.modelIdRequired'))
    return
  }

  isTesting.value = true
  try {
    const service = new ChatService(
      baseUrl,
      isApi ? { model: modelIdValue, apiKey: apiKey.value.trim() || undefined } : {},
    )
    const reply = await service.testConnection()
    toast.success(t('settings.models.testSuccess', { reply: reply.trim().slice(0, 50) }))
  } catch (err) {
    console.error('Model test failed:', err)
    const message = isLikelyCorsError(err)
      ? t('errors.possibleCors')
      : (describeError(err, t) ?? (err instanceof Error ? err.message : String(err)))
    toast.error(t('settings.models.testFailed', { message }))
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogScrollContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle class="text-2xl font-extrabold flex items-center gap-2">
          <Sparkles />
          {{ t('settings.models.title') }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-4">
        <!-- 添加按钮（展开某个模型编辑时先收起来，避免和保存按钮抢注意力） -->
        <Button v-if="!isEditing" @click="addDialogOpen = true" class="w-full gap-2">
          <Plus class="size-4" />
          {{ t('settings.models.addNew') }}
        </Button>

        <!-- 模型列表：卡片压成两行，编辑时在卡片内部展开表单 -->
        <div class="space-y-1.5">
          <Card
            v-for="model in models"
            :key="model.id"
            class="@container relative gap-0 py-0"
            :class="editingModelId === model.id && 'border-primary'"
          >
            <CardContent class="flex items-center gap-3 px-3 py-1.5">
              <!-- 图标：api 认得出来就用服务商 logo，认不出来用云朵；gate 用锁 -->
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground"
              >
                <template v-if="isApiModel(model)">
                  <img
                    v-if="logoOf(model)"
                    :src="logoOf(model)"
                    alt=""
                    :class="['size-4', logoInvert(model) && 'dark:invert']"
                  />
                  <Cloud v-else class="size-4" />
                </template>
                <Lock v-else class="size-4" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-sm font-medium" :title="model.name">
                    {{ model.name }}
                  </span>
                  <Badge v-if="model.id === defaultModelId" class="h-5 px-2 text-[11px]">
                    {{ t('settings.models.default') }}
                  </Badge>
                  <Badge variant="outline" class="h-5 px-2 text-[11px]">
                    {{ t(`settings.models.kind.${modelKind(model)}`) }}
                  </Badge>
                </div>

                <!-- 第二行：模型 ID · 脱敏 Key · 地址；窄屏只留模型 ID，允许换行防止横向溢出 -->
                <div
                  class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
                >
                  <span
                    v-if="model.model"
                    class="flex min-w-0 items-center gap-1"
                    :title="t('settings.models.modelId')"
                  >
                    <Cpu class="size-3 shrink-0" />
                    <span class="truncate font-mono">{{ model.model }}</span>
                  </span>
                  <span
                    v-if="model.apiKey"
                    class="hidden shrink-0 items-center gap-1 @sm:flex"
                    :title="t('settings.models.apiKey')"
                  >
                    <KeyRound class="size-3 shrink-0" />
                    <span class="font-mono">{{ maskKey(model.apiKey) }}</span>
                  </span>
                  <span
                    class="hidden min-w-0 flex-1 items-center gap-1 @sm:flex"
                    :title="model.baseUrl"
                  >
                    <Link class="size-3 shrink-0" />
                    <span class="truncate font-mono">{{ model.baseUrl }}</span>
                  </span>
                </div>
              </div>

              <ButtonGroup>
                <Button
                  v-if="model.id !== defaultModelId"
                  @click="setDefaultModel(model.id)"
                  variant="outline"
                  size="icon-sm"
                >
                  <Star />
                </Button>
                <Button
                  @click="startEdit(model.id)"
                  variant="outline"
                  size="icon-sm"
                  :disabled="editingModelId === model.id"
                >
                  <SquarePen />
                </Button>
                <Button
                  @click="confirmDelete(model.id)"
                  variant="outline"
                  size="icon-sm"
                  :disabled="isEditing || models.length <= 1"
                >
                  <Trash />
                </Button>
              </ButtonGroup>
            </CardContent>

            <!-- 卡片内展开的编辑表单：grid-rows 0fr→1fr 做高度动画，收起时直接卸载 -->
            <Transition
              enter-active-class="transition-[grid-template-rows,opacity] duration-200 ease-out"
              enter-from-class="grid-rows-[0fr] opacity-0"
              enter-to-class="grid-rows-[1fr] opacity-100"
              leave-active-class="transition-[grid-template-rows,opacity] duration-200 ease-out"
              leave-from-class="grid-rows-[1fr] opacity-100"
              leave-to-class="grid-rows-[0fr] opacity-0"
            >
              <div v-if="editingModelId === model.id" class="grid overflow-hidden">
                <div class="min-h-0">
                  <div class="space-y-3 border-t px-3 py-3">
                    <div class="grid gap-3 @md:grid-cols-2">
                      <div class="space-y-2">
                        <Label for="model-name">{{ t('settings.models.modelName') }}</Label>
                        <Input
                          id="model-name"
                          v-model="modelName"
                          :placeholder="t('settings.models.modelNamePlaceholder')"
                        />
                        <p class="text-xs text-muted-foreground">
                          {{ t('settings.models.modelNameDescription') }}
                        </p>
                      </div>

                      <div class="space-y-2">
                        <Label for="model-url">{{ t('settings.models.modelUrl') }}</Label>
                        <Input
                          id="model-url"
                          v-model="modelBaseUrl"
                          :placeholder="t('settings.models.modelUrlPlaceholder')"
                        />
                        <p class="text-xs text-muted-foreground">
                          {{ t('settings.models.modelUrlDescription') }}
                        </p>
                      </div>

                      <!-- 模式创建时就定了，不再给切换入口：api 才要模型 ID / API Key -->
                      <template v-if="editingKind === 'api'">
                        <div class="space-y-2">
                          <Label for="model-id">{{ t('settings.models.modelId') }}</Label>
                          <Input
                            id="model-id"
                            v-model="modelId"
                            :placeholder="t('settings.models.modelIdPlaceholder')"
                          />
                          <p class="text-xs text-muted-foreground">
                            {{ t('settings.models.modelIdDescription') }}
                          </p>
                        </div>
                        <div class="space-y-2">
                          <Label for="model-api-key">{{ t('settings.models.apiKey') }}</Label>
                          <Input
                            id="model-api-key"
                            v-model="apiKey"
                            :placeholder="t('settings.models.apiKeyPlaceholder')"
                          />
                          <p class="text-xs text-muted-foreground">
                            {{ t('settings.models.apiKeyDescription') }}
                          </p>
                        </div>
                      </template>
                      <p v-else class="text-xs text-muted-foreground @md:col-span-2">
                        {{ t('settings.models.gateHint') }}
                      </p>
                    </div>

                    <div class="flex gap-2">
                      <Button @click="saveModel" class="gap-2">
                        <Check class="size-4" />
                        {{ t('settings.models.save') }}
                      </Button>
                      <Button
                        @click="testModel"
                        variant="outline"
                        class="gap-2"
                        :disabled="isTesting"
                      >
                        <LoaderCircle v-if="isTesting" class="size-4 animate-spin" />
                        <ShieldCheck v-else class="size-4" />
                        {{ isTesting ? t('settings.models.testing') : t('settings.models.test') }}
                      </Button>
                      <Button @click="cancelEdit" variant="outline" class="gap-2">
                        <X class="size-4" />
                        {{ t('settings.models.cancel') }}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </Card>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>

  <!-- 添加模型（和欢迎弹窗同一套表单） -->
  <AddModelDialog v-model:open="addDialogOpen" />

  <!-- 删除确认对话框 -->
  <AlertDialog v-model:open="deleteDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('settings.models.confirmDelete') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('settings.models.confirmDeleteDescription') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('settings.models.cancel') }}</AlertDialogCancel>
        <AlertDialogAction
          @click="deleteModel"
          class="bg-destructive text-background hover:bg-destructive/90"
        >
          {{ t('settings.models.delete') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
