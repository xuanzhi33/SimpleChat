import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import type { Conversation, Message } from '@/types/chat'
import { LOCAL_STORAGE_KEY_PREFIX } from './settings'
import { dbOperations } from '@/lib/db'
import { useSettingsStore } from './settings'

export const useChatStore = defineStore('chat', () => {
  // 会话列表（响应式，从 IndexedDB 加载）
  const conversations = ref<Conversation[]>([])

  // 是否已初始化
  const isInitialized = ref(false)

  // 使用 useStorage 自动持久化当前激活的会话ID（保留在 localStorage，因为数据量小）
  const activeConversationId = useStorage<string | null>(
    LOCAL_STORAGE_KEY_PREFIX + 'active-conversation-id',
    null,
    localStorage,
    { mergeDefaults: true },
  )

  // 初始化：从 IndexedDB 加载会话
  const initializeStore = async () => {
    if (isInitialized.value) return

    try {
      conversations.value = await dbOperations.getAllConversations()
      isInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize chat store:', error)
    }
  }

  // 保存单个会话到 IndexedDB
  const persistConversation = async (conversation: Conversation) => {
    try {
      // 深拷贝以去除 Vue 响应式代理，IndexedDB 无法存储代理对象
      const plainConversation: Conversation = JSON.parse(JSON.stringify(conversation))
      await dbOperations.saveConversation(plainConversation)
    } catch (error) {
      console.error('Failed to persist conversation:', error)
    }
  }

  // 是否正在生成
  const isGenerating = ref(false)

  // 当前激活的会话
  const activeConversation = computed(() => {
    if (!activeConversationId.value) return null
    return conversations.value.find((c) => c.id === activeConversationId.value) || null
  })

  // 创建新会话
  const createConversation = (title: string = '新对话', modelId?: string) => {
    const settingsStore = useSettingsStore()
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title,
      messages: [],
      modelId: modelId || settingsStore.defaultModelId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    conversations.value.unshift(newConversation)
    activeConversationId.value = newConversation.id
    // 异步保存到 IndexedDB
    persistConversation(newConversation)
    return newConversation
  }

  // 删除会话
  const deleteConversation = async (id: string) => {
    const index = conversations.value.findIndex((c) => c.id === id)
    if (index !== -1) {
      conversations.value.splice(index, 1)
      if (activeConversationId.value === id) {
        activeConversationId.value = conversations.value[0]?.id || null
      }
      // 从 IndexedDB 删除
      await dbOperations.deleteConversation(id)
    }
  }

  // 恢复已删除的会话（用于撤销删除）
  const restoreConversation = (conversation: Conversation, index: number) => {
    // 将会话插入到原来的位置
    const insertIndex = Math.min(index, conversations.value.length)
    conversations.value.splice(insertIndex, 0, conversation)
    // 异步保存到 IndexedDB
    persistConversation(conversation)
  }

  // 清空所有会话
  const clearAllConversations = async () => {
    conversations.value = []
    activeConversationId.value = null
    // 清空 IndexedDB
    await dbOperations.clearAllConversations()
  }

  // 添加消息到当前会话
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    if (!activeConversationId.value) {
      createConversation()
    }

    const conversation = activeConversation.value
    if (!conversation) return null

    const newMessage: Message = {
      ...message,
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
    }

    conversation.messages.push(newMessage)
    conversation.updatedAt = Date.now()

    // 如果是第一条用户消息，使用它作为标题
    if (conversation.messages.length === 1 && message.role === 'user') {
      conversation.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
    }

    // 异步保存到 IndexedDB
    persistConversation(conversation)
    return newMessage
  }

  // 更新消息内容（用于流式响应）
  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    const conversation = activeConversation.value
    if (!conversation) return

    const message = conversation.messages.find((m) => m.id === messageId)
    if (message) {
      Object.assign(message, updates)
      conversation.updatedAt = Date.now()
      // 异步保存到 IndexedDB（流式更新时会频繁调用，但 Dexie 会处理好）
      persistConversation(conversation)
    }
  }

  // 删除消息
  const deleteMessage = (messageId: string) => {
    const conversation = activeConversation.value
    if (!conversation) return

    const index = conversation.messages.findIndex((m) => m.id === messageId)
    if (index !== -1) {
      conversation.messages.splice(index, 1)
      conversation.updatedAt = Date.now()
      // 异步保存到 IndexedDB
      persistConversation(conversation)
    }
  }

  // 清空当前会话的消息
  const clearMessages = () => {
    const conversation = activeConversation.value
    if (!conversation) return

    conversation.messages = []
    conversation.updatedAt = Date.now()
    // 异步保存到 IndexedDB
    persistConversation(conversation)
  }

  return {
    conversations,
    activeConversationId,
    activeConversation,
    isGenerating,
    isInitialized,
    initializeStore,
    createConversation,
    deleteConversation,
    restoreConversation,
    clearAllConversations,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
  }
})
