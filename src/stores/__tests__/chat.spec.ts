import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: ref('en'), t: (k: string) => k }) }))
vi.mock('@/lib/db', () => ({
  db: {},
  dbOperations: {
    getAllConversations: vi.fn(async () => []),
    getConversation: vi.fn(),
    saveConversation: vi.fn(async () => {}),
    deleteConversation: vi.fn(async () => {}),
    clearAllConversations: vi.fn(async () => {}),
  },
}))

import { useChatStore } from '@/stores/chat'
import { dbOperations } from '@/lib/db'

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('新建会话并激活', () => {
    const store = useChatStore()
    const c = store.createConversation('hello')
    expect(store.conversations[0]).toEqual(c)
    expect(store.activeConversationId).toBe(c.id)
  })

  it('用首条用户消息生成标题（超 30 字截断）', () => {
    const store = useChatStore()
    store.createConversation()
    store.addMessage({ role: 'user', content: 'x'.repeat(40) })
    expect(store.activeConversation?.title).toBe('x'.repeat(30) + '...')
  })

  it('更新与删除消息', () => {
    const store = useChatStore()
    store.createConversation()
    const msg = store.addMessage({ role: 'assistant', content: 'a' })!
    store.updateMessage(msg.id, { content: 'b', reasoning_content: 'r' })
    expect(store.activeConversation?.messages[0]).toMatchObject({
      content: 'b',
      reasoning_content: 'r',
    })
    store.deleteMessage(msg.id)
    expect(store.activeConversation?.messages).toHaveLength(0)
  })

  it('通过 dbOperations 持久化', () => {
    useChatStore().createConversation('saved')
    expect(dbOperations.saveConversation).toHaveBeenCalled()
  })
})
