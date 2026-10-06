import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// reka 的滑块量 thumb 尺寸、弹窗定位都要 ResizeObserver（jsdom 里没有）
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

import { mount, enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConversationConfig from '@/components/chat/ConversationConfig.vue'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { i18n } from '@/i18n/config'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { dbOperations } from '@/lib/db'
import type { Model } from '@/types/chat'

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

enableAutoUnmount(afterEach)

const flushTicks = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await nextTick()
}

const MODEL: Model = {
  id: 'm1',
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  kind: 'api',
  model: 'deepseek-flash',
}

const mountConfig = async (model: Model = MODEL) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  // 先挂载：settings store 内部会调 useI18n()，必须在组件 setup 里创建；
  // 而且 chat store 的 createConversation 也会去取 settings store，所以它也得到挂载后再建对话
  const wrapper = mount(ConversationConfig, {
    props: { open: true },
    global: { plugins: [pinia, i18n] },
  })
  await flushTicks()

  const settingsStore = useSettingsStore()
  settingsStore.models = [{ ...model }]
  settingsStore.defaultModelId = model.id

  const chatStore = useChatStore()
  const conversation = chatStore.createConversation('对话')
  await flushTicks()

  // 把「建对话时那次落库」清掉，后面的断言只关心配置改动写了几次
  vi.clearAllMocks()

  return { wrapper, chatStore, settingsStore, conversationId: conversation.id }
}

const slider = (wrapper: VueWrapper) => wrapper.findComponent(Slider)
const textarea = (wrapper: VueWrapper) => wrapper.findComponent(Textarea)

/** 拖滑块：先 update:modelValue 再 valueCommit（reka 松手才发后一个） */
const moveSlider = async (wrapper: VueWrapper, index: number) => {
  slider(wrapper).vm.$emit('update:modelValue', [index])
  await flushTicks()
  slider(wrapper).vm.$emit('valueCommit', [index])
  await flushTicks()
}

describe('对话配置弹窗', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('内置服务商（DeepSeek）：顶部是思考强度滑块，档位没有「中」', async () => {
    const { wrapper } = await mountConfig()

    expect(slider(wrapper).exists()).toBe(true)
    expect(slider(wrapper).props('max')).toBe(4)
    // 默认档在最左，也就是当前状态
    expect(slider(wrapper).props('modelValue')).toEqual([0])
    expect(document.body.textContent).toContain(i18n.global.t('chat.thinkingEffort.title'))
    expect(document.body.textContent).toContain(i18n.global.t('chat.thinkingEffort.max'))

    // DeepSeek 只有 low/high/max，滑块上没有「中」（0=默认、1=关、2=低、3=高、4=最高）
    expect(slider(wrapper).props('modelValue')).toEqual([0])
    await moveSlider(wrapper, 3)
    expect(useChatStore().activeConversation?.thinkingLevel).toBe('high')
  })

  it('拖滑块松手后写库（拖动过程中不写）', async () => {
    const { wrapper, conversationId } = await mountConfig()

    slider(wrapper).vm.$emit('update:modelValue', [4])
    await flushTicks()
    expect(dbOperations.saveConversation).not.toHaveBeenCalled()

    slider(wrapper).vm.$emit('valueCommit', [4])
    await flushTicks()
    expect(useChatStore().activeConversation?.thinkingLevel).toBe('max')
    expect(dbOperations.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: conversationId, thinkingLevel: 'max' }),
    )
  })

  it('拖回「默认」档 = 清掉设置（不发送任何思考参数）', async () => {
    const { wrapper, chatStore, conversationId } = await mountConfig()
    chatStore.updateConversationSettings(conversationId, { thinkingLevel: 'low' })
    await flushTicks()

    await moveSlider(wrapper, 0)
    expect(useChatStore().activeConversation?.thinkingLevel).toBeUndefined()
  })

  it('硅基流动只有开关两档，「开」不显示成「中」', async () => {
    const { wrapper } = await mountConfig({
      ...MODEL,
      baseUrl: 'https://api.siliconflow.cn/v1',
      name: 'SiliconFlow',
    })

    expect(slider(wrapper).props('max')).toBe(2)
    expect(document.body.textContent).toContain(i18n.global.t('chat.thinkingEffort.on'))
    expect(document.body.textContent).not.toContain(i18n.global.t('chat.thinkingEffort.medium'))
  })

  it('LLM Gate / 自定义地址：不显示思考强度，只剩系统提示词', async () => {
    const { wrapper } = await mountConfig({ ...MODEL, kind: 'gate', baseUrl: 'http://x/v1' })

    expect(slider(wrapper).exists()).toBe(false)
    expect(document.body.textContent).not.toContain(i18n.global.t('chat.thinkingEffort.title'))
    expect(textarea(wrapper).exists()).toBe(true)
  })

  it('换模型后按最近档位吸附（中 → DeepSeek 的高）', async () => {
    const { wrapper, settingsStore } = await mountConfig()
    await moveSlider(wrapper, 3)
    expect(useChatStore().activeConversation?.thinkingLevel).toBe('high')

    // 换成 OpenAI：档位表多出「中」，原来的「高」应该落在同一个位置上
    settingsStore.models = [{ ...MODEL, id: 'm2', baseUrl: 'https://api.openai.com/v1' }]
    useChatStore().activeConversation!.modelId = 'm2'
    await flushTicks()

    expect(slider(wrapper).props('modelValue')).toEqual([4])
  })

  it('系统提示词：防抖后落库，关弹窗时不用等防抖', async () => {
    const { wrapper, conversationId } = await mountConfig()

    await textarea(wrapper).setValue('你是助手')
    // 还没到 400ms，先关弹窗 -> 立刻落库
    await wrapper.setProps({ open: false })
    await flushTicks()

    expect(dbOperations.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: conversationId, systemPrompt: '你是助手' }),
    )
  })

  it('系统提示词：防抖到点后自己落库', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { wrapper, conversationId } = await mountConfig()

    await textarea(wrapper).setValue('你是助手')
    vi.clearAllMocks()
    await vi.advanceTimersByTimeAsync(400)

    expect(dbOperations.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: conversationId, systemPrompt: '你是助手' }),
    )
  })
})
