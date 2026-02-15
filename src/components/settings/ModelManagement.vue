<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit, Check, X, Star, Sparkles, Sparkle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { ButtonGroup } from '../ui/button-group'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const settingsStore = useSettingsStore()
const { models, defaultModelId } = storeToRefs(settingsStore)

// 新增/编辑模型表单
const isEditing = ref(false)
const editingModelId = ref<string | null>(null)
const modelName = ref('')
const modelBaseUrl = ref('')

// 删除确认对话框
const deleteDialogOpen = ref(false)
const modelToDelete = ref<string | null>(null)

// 开始添加新模型
const startAdd = () => {
  isEditing.value = true
  editingModelId.value = null
  modelName.value = ''
  modelBaseUrl.value = ''
}

// 从 URL 推断模型名称
const inferModelNameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(part => part.trim() !== '')

    // 过滤掉版本号 (v1, v2, etc.)
    const nonVersionParts = pathParts.filter(part => !/^v\d+$/i.test(part))

    // 返回最后一个非版本部分
    if (nonVersionParts.length > 0) {
      return nonVersionParts[nonVersionParts.length - 1] || ''
    }
  } catch {
    // URL 解析失败，忽略
  }
  return ''
}

// 监听 URL 变化，自动填充名称（仅在添加新模型时）
watch(modelBaseUrl, (newUrl) => {
  // 只有在添加新模型时才自动填充
  if (!editingModelId.value && newUrl.trim()) {
    const inferredName = inferModelNameFromUrl(newUrl)
    if (inferredName) {
      modelName.value = inferredName
    }
  }
})

// 开始编辑模型
const startEdit = (id: string) => {
  const model = models.value.find(m => m.id === id)
  if (model) {
    isEditing.value = true
    editingModelId.value = id
    modelName.value = model.name
    modelBaseUrl.value = model.baseUrl
  }
}

// 取消编辑
const cancelEdit = () => {
  isEditing.value = false
  editingModelId.value = null
  modelName.value = ''
  modelBaseUrl.value = ''
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

  if (editingModelId.value) {
    // 编辑现有模型
    settingsStore.updateModel(editingModelId.value, name, baseUrl)
    toast.success(t('settings.models.updateSuccess'))
  } else {
    // 添加新模型
    settingsStore.addModel(name, baseUrl)
    toast.success(t('settings.models.addSuccess'))
  }

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
              {{ editingModelId ? t('settings.models.editModel') : t('settings.models.addModel') }}
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label for="model-url">{{ t('settings.models.modelUrl') }}</Label>
              <Input id="model-url" v-model="modelBaseUrl" :placeholder="t('settings.models.modelUrlPlaceholder')" />
              <p class="text-xs text-muted-foreground">{{ t('settings.models.modelUrlDescription') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="model-name">{{ t('settings.models.modelName') }}</Label>
              <Input id="model-name" v-model="modelName" :placeholder="t('settings.models.modelNamePlaceholder')" />
              <p class="text-xs text-muted-foreground">{{ t('settings.models.modelNameDescription') }}</p>
            </div>
            <div class="flex gap-2">
              <Button @click="saveModel" class="gap-2">
                <Check class="size-4" />
                {{ t('settings.models.save') }}
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

        <!-- 模型列表 -->
        <div class="space-y-3">
          <Card v-for="model in models" :key="model.id" class="relative">
            <CardContent>
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 space-y-2 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-semibold text-lg">{{ model.name }}</h3>
                    <Badge v-if="model.id === defaultModelId" variant="default">
                      {{ t('settings.models.default') }}
                    </Badge>
                  </div>
                  <p class="text-sm text-muted-foreground break-all">{{ model.baseUrl }}</p>
                </div>
                <ButtonGroup>

                  <Button v-if="model.id !== defaultModelId" @click="setDefaultModel(model.id)" variant="outline"
                    size="icon-sm">
                    <Star />
                  </Button>
                  <Button @click="startEdit(model.id)" variant="outline" size="icon-sm" :disabled="isEditing">
                    <Edit />
                  </Button>
                  <Button @click="confirmDelete(model.id)" variant="outline" size="icon-sm"
                    :disabled="isEditing || models.length <= 1">
                    <Trash2 />
                  </Button>
                </ButtonGroup>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>

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
        <AlertDialogAction @click="deleteModel" class="bg-destructive text-background hover:bg-destructive/90">
          {{ t('settings.models.delete') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
