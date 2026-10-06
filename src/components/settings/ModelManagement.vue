<script setup lang="ts">
import { ref } from 'vue'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Trash,
  SquarePen,
  Check,
  X,
  Star,
  Sparkles,
  Sparkle,
  LoaderCircle,
  ShieldCheck,
  Cloud,
  Server,
  Cpu,
  KeyRound,
  Link,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { ButtonGroup } from '../ui/button-group'
import AddModelDialog from './AddModelDialog.vue'
import { ChatService, isLikelyCorsError } from '@/lib/chat-service'
import { describeError } from '@/lib/errors'
import { modelKind } from '@/lib/model'
import type { ModelKind } from '@/types/chat'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const settingsStore = useSettingsStore()
const { models, defaultModelId } = storeToRefs(settingsStore)

// 添加模型走独立弹窗（和欢迎弹窗同一套表单），这里只留编辑
const addDialogOpen = ref(false)

// 编辑模型表单
const isEditing = ref(false)
const editingModelId = ref<string | null>(null)
const modelName = ref('')
const modelBaseUrl = ref('')
// 模式（api / gate）在创建时就定了，编辑时只读，所以这里不是可切换的状态
const editingKind = ref<ModelKind>('api')
const modelId = ref('')
const apiKey = ref('')
const isTesting = ref(false)

// 删除确认对话框
const deleteDialogOpen = ref(false)
const modelToDelete = ref<string | null>(null)

// 开始添加新模型
const startAdd = () => {
  addDialogOpen.value = true
}

// 开始编辑模型
const startEdit = (id: string) => {
  const model = models.value.find((m) => m.id === id)
  if (model) {
    isEditing.value = true
    editingModelId.value = id
    modelName.value = model.name
    modelBaseUrl.value = model.baseUrl
    editingKind.value = modelKind(model)
    modelId.value = model.model ?? ''
    apiKey.value = model.apiKey ?? ''
  }
}

// 取消编辑
const cancelEdit = () => {
  isEditing.value = false
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
        <!-- 添加/编辑表单 -->
        <Card v-if="isEditing" class="border-primary">
          <CardHeader>
            <CardTitle class="text-lg flex items-center gap-2">
              <Sparkle />
              {{ t('settings.models.editModel') }}
              <Badge variant="outline" class="ml-auto">
                {{ t(`settings.models.kind.${editingKind}`) }}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
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
            <p v-else class="text-xs text-muted-foreground">
              {{ t('settings.models.gateHint') }}
            </p>

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
            <div class="flex gap-2">
              <Button @click="saveModel" class="gap-2">
                <Check class="size-4" />
                {{ t('settings.models.save') }}
              </Button>
              <Button @click="testModel" variant="outline" class="gap-2" :disabled="isTesting">
                <LoaderCircle v-if="isTesting" class="size-4 animate-spin" />
                <ShieldCheck v-else class="size-4" />
                {{ isTesting ? t('settings.models.testing') : t('settings.models.test') }}
              </Button>
              <Button @click="cancelEdit" variant="outline" class="gap-2">
                <X class="size-4" />
                {{ t('settings.models.cancel') }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- 添加按钮 -->
        <Button v-if="!isEditing" @click="startAdd" class="w-full gap-2">
          <Plus class="size-4" />
          {{ t('settings.models.addNew') }}
        </Button>

        <!-- 模型列表：每张卡片压成两行，竖着能多放几个 -->
        <div class="space-y-1.5">
          <Card v-for="model in models" :key="model.id" class="relative gap-0 py-0">
            <CardContent class="flex items-center gap-3 px-3 py-1.5">
              <!-- 模式图标：api 走云端接口，gate 走本地网关 -->
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground"
              >
                <Cloud v-if="modelKind(model) === 'api'" class="size-4" />
                <Server v-else class="size-4" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
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

                <!-- 第二行：模型 ID · 脱敏 Key · 地址，一律单行截断，鼠标悬停看全 -->
                <div class="mt-0.5 flex min-w-0 items-center gap-x-3 text-xs text-muted-foreground">
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
                    class="flex shrink-0 items-center gap-1"
                    :title="t('settings.models.apiKey')"
                  >
                    <KeyRound class="size-3 shrink-0" />
                    <span class="font-mono">{{ maskKey(model.apiKey) }}</span>
                  </span>
                  <span class="flex min-w-0 flex-1 items-center gap-1" :title="model.baseUrl">
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
                  :disabled="isEditing"
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
