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

  it('重命名会话：去掉首尾空白并忽略空标题', () => {
    const store = useChatStore()
    store.createConversation('old')
    store.renameConversation('  new title  ')
    expect(store.activeConversation?.title).toBe('new title')
    store.renameConversation('   ')
    expect(store.activeConversation?.title).toBe('new title')
  })

  it('自动标题不覆盖用户手动重命名', () => {
    const store = useChatStore()
    const c = store.createConversation('old')
    store.applyAutoTitle(c.id, 'AI 生成的标题')
    expect(store.activeConversation?.title).toBe('AI 生成的标题')
    store.renameConversation('手动标题')
    store.applyAutoTitle(c.id, 'AI 又来一次')
    expect(store.activeConversation?.title).toBe('手动标题')
  })

  it('通过 dbOperations 持久化', () => {
    useChatStore().createConversation('saved')
    expect(dbOperations.saveConversation).toHaveBeenCalled()
  })
})
