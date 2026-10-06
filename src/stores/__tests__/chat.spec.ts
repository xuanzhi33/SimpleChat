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

  it('从指定消息开始截断（含自身）', () => {
    const store = useChatStore()
    store.createConversation()
    const first = store.addMessage({ role: 'user', content: 'a' })!
    store.addMessage({ role: 'assistant', content: 'b' })

    store.truncateFrom(first.id)
    expect(store.activeConversation?.messages).toHaveLength(0)

    store.addMessage({ role: 'user', content: 'c' })
    const last = store.addMessage({ role: 'assistant', content: 'd' })!
    store.truncateFrom(last.id)
    store.truncateFrom('does-not-exist') // 找不到这条消息时什么都不做
    expect(store.activeConversation?.messages.map((m) => m.content)).toEqual(['c'])
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

  it('对话自己的设置（系统提示词 / 思考档位）会写回库', () => {
    const store = useChatStore()
    const c = store.createConversation('c')

    store.updateConversationSettings(c.id, { systemPrompt: '你是助手', thinkingLevel: 'high' })

    expect(store.activeConversation).toMatchObject({
      systemPrompt: '你是助手',
      thinkingLevel: 'high',
    })
    expect(dbOperations.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: c.id, systemPrompt: '你是助手', thinkingLevel: 'high' }),
    )
  })

  it('带 id 更新设置：不会写到当前激活的另一条对话上', () => {
    const store = useChatStore()
    // 会话 id 用的是 Date.now()，同一毫秒建两条会撞 id，所以这里把时钟往前挪一点
    vi.useFakeTimers()
    const first = store.createConversation('first')
    vi.advanceTimersByTime(1000)
    const second = store.createConversation('second')
    vi.useRealTimers()
    expect(first.id).not.toBe(second.id)

    store.updateConversationSettings(first.id, { systemPrompt: 'first 的提示词' })

    expect(store.conversations.find((c) => c.id === first.id)?.systemPrompt).toBe('first 的提示词')
    expect(store.conversations.find((c) => c.id === second.id)?.systemPrompt).toBeUndefined()
  })
})
