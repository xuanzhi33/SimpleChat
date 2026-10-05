import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// reka 的 tooltip 定位用 useSize，依赖 ResizeObserver（jsdom 里没有）
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// Dexie 在 jsdom 里没有 IndexedDB
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

// 让流式请求的失败可控：默认不主动失败，由每个用例决定怎么挂
const { sendMessageMock } = vi.hoisted(() => ({ sendMessageMock: vi.fn() }))
vi.mock('@/lib/chat-service', () => ({
  isLikelyCorsError: (err: unknown) => err instanceof TypeError,
  ChatService: class {
    sendMessage(...args: unknown[]) {
      return sendMessageMock(...args)
    }
    complete() {
      return Promise.resolve('')
    }
  },
}))

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import { i18n } from '@/i18n/config'
import { useChatStore } from '@/stores/chat'
import { HttpError, describeError } from '@/lib/errors'
import { toast } from 'vue-sonner'

/** 第 4 个参数是 onError，按需在请求里调用它 */
const failWith = (error: Error) => {
  sendMessageMock.mockImplementation((...args: unknown[]) => {
    ;(args[3] as (err: Error) => void)(error)
  })
}

describe('ChatPanel 发送失败', () => {
  let pinia: ReturnType<typeof createPinia>
  let wrapper: VueWrapper

  const setup = async (options: { withModel?: boolean } = {}) => {
    localStorage.clear()
    // 设置 store 的 setup 里会调 useI18n()，必须先写在 localStorage、再让它在组件 setup 期间创建
    if (options.withModel !== false) {
      localStorage.setItem(
        'xuanzhi33-models',
        JSON.stringify([
          { id: 'm1', name: 'Test', baseUrl: 'https://example.com', kind: 'api', model: 'x' },
        ]),
      )
      localStorage.setItem('xuanzhi33-default-model-id', 'm1')
    }
    pinia = createPinia()
    setActivePinia(pinia)
    wrapper = mount(ChatPanel, { global: { plugins: [pinia, i18n] } })
    await nextTick()
    return wrapper
  }

  const send = async () => {
    const input = wrapper.get('#chat-main-input')
    await input.setValue('你好')
    await input.trigger('keydown', { key: 'Enter' })
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    localStorage.clear()
    sendMessageMock.mockReset()
    vi.mocked(toast.error).mockClear()
  })

  it('错误红色显示在 AI 消息上，不再有顶部错误条，并立刻进入编辑模式', async () => {
    await setup()
    failWith(new HttpError(401, 'bad key'))
    await send()

    const chatStore = useChatStore()
    const messages = chatStore.activeConversation!.messages

    // 详情挂在 AI 消息上（第 2 条），并且就地渲染成红色文字
    expect(messages).toHaveLength(2)
    const detail = messages[1]!.error!
    expect(detail).toBe(describeError(new HttpError(401, 'bad key'), i18n.global.t))
    expect(detail).toContain('401')
    expect(detail).toContain('bad key')
    expect(wrapper.get('.text-destructive').text()).toBe(detail)
    expect(messages[1]!.isStreaming).toBe(false)

    // 顶部的 Alert 已经去掉（shadcn Alert 是唯一的 role="alert"）
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    // toast 仍然报错，但只给一行摘要
    expect(toast.error).toHaveBeenCalledWith(
      i18n.global.t('errors.requestFailed', {
        status: 401,
        reason: i18n.global.t('errors.http.401.reason'),
      }),
    )

    // 立即进入编辑模式：分割线 + 原文回到输入框（全选方便直接回车重发）
    expect(wrapper.text()).toContain(i18n.global.t('chat.editNotice'))
    expect((wrapper.get('#chat-main-input').element as HTMLTextAreaElement).value).toBe('你好')
  })

  it('网络层错误（疑似 CORS）用可能的跨域文案，红色和 toast 都是', async () => {
    await setup()
    failWith(new TypeError('Failed to fetch'))
    await send()

    const chatStore = useChatStore()
    const detail = chatStore.activeConversation!.messages[1]!.error!
    expect(detail).toBe(i18n.global.t('errors.possibleCors'))
    expect(wrapper.get('.text-destructive').text()).toBe(detail)
    expect(toast.error).toHaveBeenCalledWith(i18n.global.t('errors.possibleCors'))
  })

  it('没有可用模型时只弹 toast，不往会话里塞消息、不占 AI 位置', async () => {
    await setup({ withModel: false })
    await send()

    expect(toast.error).toHaveBeenCalledWith(i18n.global.t('chat.errors.noModel'))
    expect(useChatStore().activeConversation?.messages ?? []).toHaveLength(0)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
