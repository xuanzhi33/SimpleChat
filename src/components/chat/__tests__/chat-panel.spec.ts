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
import SetupDialog from '@/components/settings/SetupDialog.vue'
import { Button } from '@/components/ui/button'
import { i18n } from '@/i18n/config'
import { useChatStore } from '@/stores/chat'
import { HttpError, describeError } from '@/lib/errors'
import { toast } from 'vue-sonner'

/** 第 2 个参数是 onDelta：拿在手里，由用例决定何时喂增量 */
const streamWith = () => {
  let emit: ((content: string, reasoning?: string) => void) | undefined
  sendMessageMock.mockImplementation((...args: unknown[]) => {
    emit = args[1] as typeof emit
  })
  return (content: string, reasoning?: string) => emit?.(content, reasoning)
}

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

  it('空状态提示「请点击添加模型」，点按钮弹出欢迎弹窗', async () => {
    await setup({ withModel: false })

    expect(wrapper.text()).toContain(i18n.global.t('chat.noModelHint'))

    const setupDialog = wrapper.findComponent(SetupDialog)
    expect(setupDialog.props('open')).toBe(false)

    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === i18n.global.t('settings.models.addModel'))!
      .trigger('click')
    await nextTick()

    expect(setupDialog.props('open')).toBe(true)
  })

  it('流式期间把用户消息钉在列表顶部，用户自己滚过就不再抢', async () => {
    await setup()
    const emit = streamWith()
    await send()

    // jsdom 没有布局，容器和消息的 rect 都要假装一下（容器顶边 100、用户消息顶边 300）
    const userMessage = wrapper.get('[data-message-id]').element as HTMLElement
    // 消息列表容器就是消息节点的父节点（ChatPanel 模板是多根 Fragment，包装元素不是它）
    const container = userMessage.parentElement as HTMLElement
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    vi.spyOn(userMessage, 'getBoundingClientRect').mockReturnValue({ top: 300 } as DOMRect)

    emit('你好')
    await nextTick()
    await nextTick()
    expect(container.scrollTop).toBe(200)

    // 用户自己滚动（滚轮）后，后续增量不再把视图拉回去
    container.scrollTop = 0
    container.dispatchEvent(new WheelEvent('wheel'))
    emit(' 世界')
    await nextTick()
    await nextTick()
    expect(container.scrollTop).toBe(0)
  })
})

describe('ChatPanel 输入法组字', () => {
  let pinia: ReturnType<typeof createPinia>
  let wrapper: VueWrapper

  beforeEach(async () => {
    localStorage.clear()
    sendMessageMock.mockReset()
    localStorage.setItem(
      'xuanzhi33-models',
      JSON.stringify([
        { id: 'm1', name: 'Test', baseUrl: 'https://example.com', kind: 'api', model: 'x' },
      ]),
    )
    localStorage.setItem('xuanzhi33-default-model-id', 'm1')
    pinia = createPinia()
    setActivePinia(pinia)
    wrapper = mount(ChatPanel, { global: { plugins: [pinia, i18n] } })
    await nextTick()
  })

  /** 派发原生事件：isComposing 能放进 init，keyCode 得自己 defineProperty（jsdom 不认） */
  const pressEnter = async (init: { isComposing?: boolean; keyCode: number }) => {
    const input = wrapper.get('#chat-main-input')
    await input.setValue('nihao')
    const event = new KeyboardEvent('keydown', { key: 'Enter', isComposing: init.isComposing })
    Object.defineProperty(event, 'keyCode', { value: init.keyCode })
    input.element.dispatchEvent(event)
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  it('组字中的 Enter 只上屏不发送：Chrome 的 isComposing 和 Safari 的 keyCode 229 都挡住', async () => {
    await pressEnter({ isComposing: true, keyCode: 229 })
    expect(sendMessageMock).not.toHaveBeenCalled()
    // 输入框没被清空、也没进会话
    expect((wrapper.get('#chat-main-input').element as HTMLTextAreaElement).value).toBe('nihao')
    expect(useChatStore().activeConversation?.messages ?? []).toHaveLength(0)

    // Safari：compositionend 已先发生，只剩 229
    await pressEnter({ isComposing: false, keyCode: 229 })
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(useChatStore().activeConversation?.messages ?? []).toHaveLength(0)
  })

  it('普通 Enter 照旧发送（守卫没把正常发送带坏）', async () => {
    await pressEnter({ isComposing: false, keyCode: 13 })
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(useChatStore().activeConversation!.messages[0]!.content).toBe('nihao')
  })
})
