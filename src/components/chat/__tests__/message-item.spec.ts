import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MessageItem from '@/components/chat/MessageItem.vue'
import { i18n } from '@/i18n/config'
import type { Message } from '@/types/chat'

const makeMessage = (partial: Partial<Message>): Message => ({
  id: 'm1',
  role: 'assistant',
  content: '',
  timestamp: 0,
  ...partial,
})

/** markstream 是异步渲染的，等一拍再断言 */
const render = async (partial: Partial<Message>) => {
  const wrapper = mount(MessageItem, {
    props: { message: makeMessage(partial) },
    global: { plugins: [createPinia(), i18n] },
  })
  await new Promise((resolve) => setTimeout(resolve, 50))
  return wrapper
}

describe('MessageItem 渲染', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('用户消息保持纯文本，不渲染 markdown', async () => {
    const wrapper = await render({ role: 'user', content: '**not bold** <b>x</b>' })
    expect(wrapper.text()).toContain('**not bold** <b>x</b>')
    expect(wrapper.html()).not.toContain('<strong>')
  })

  it('AI 消息渲染 markdown', async () => {
    const wrapper = await render({ content: '**bold** and `code`' })
    expect(wrapper.html()).toContain('<strong')
    expect(wrapper.html()).toContain('<code')
  })

  it('AI 消息里的软换行原样带在 text-node 里（reasoning 常有单换行）', async () => {
    const wrapper = await render({ content: '一\n**二**' })
    // markstream 不做 breaks 转换，换行以 \n 留在 text-node 里，靠它自带的 pre-wrap 显示成换行
    expect(wrapper.find('.paragraph-node').element.textContent).toContain('\n')
  })

  it('收到正文增量（thinkingDone）后思考块立即收起、改状态、亮出耗时', async () => {
    const thinking = await render({
      reasoning_content: '先想一想',
      reasoningDurationMs: 1500,
      isStreaming: true,
    })
    expect(thinking.text()).toContain(i18n.global.t('chat.thinkingInProgress'))
    expect(thinking.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true')
    expect(thinking.find('.animate-pulse').exists()).toBe(true)

    const answering = await render({
      content: '正文',
      reasoning_content: '先想一想',
      reasoningDurationMs: 1500,
      isStreaming: true,
      thinkingDone: true,
    })
    expect(answering.text()).toContain(i18n.global.t('chat.thinkingComplete'))
    expect(answering.text()).toContain('1.5')
    expect(answering.get('button[aria-expanded]').attributes('aria-expanded')).toBe('false')
    expect(answering.find('.animate-pulse').exists()).toBe(false)
  })

  it('AI 消息里的 HTML 被净化（script / onerror 都进不来）', async () => {
    const wrapper = await render({
      content: '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>',
    })
    expect(wrapper.html()).not.toContain('<script')
    expect(wrapper.html()).not.toContain('onerror')
  })
})
