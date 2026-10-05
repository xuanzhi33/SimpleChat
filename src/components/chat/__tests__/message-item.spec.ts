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

  it('AI 消息里的 HTML 被净化（script / onerror 都进不来）', async () => {
    const wrapper = await render({
      content: '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>',
    })
    expect(wrapper.html()).not.toContain('<script')
    expect(wrapper.html()).not.toContain('onerror')
  })
})
