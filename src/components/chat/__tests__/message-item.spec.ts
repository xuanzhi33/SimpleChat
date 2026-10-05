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

  it('AI 消息的页脚（时间/复制）等回答结束才出现', async () => {
    const copyLabel = i18n.global.t('chat.copy')
    const wrapper = mount(MessageItem, {
      props: { message: makeMessage({ content: '正文', isStreaming: true }) },
      global: { plugins: [createPinia(), i18n] },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(wrapper.find(`button[aria-label="${copyLabel}"]`).exists()).toBe(false)

    await wrapper.setProps({ message: makeMessage({ content: '正文', isStreaming: false }) })
    await nextTick()
    expect(wrapper.find(`button[aria-label="${copyLabel}"]`).exists()).toBe(true)
  })

  it('AI 消息里的 HTML 被净化（script / onerror 都进不来）', async () => {
    const wrapper = await render({
      content: '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>',
    })
    expect(wrapper.html()).not.toContain('<script')
    expect(wrapper.html()).not.toContain('onerror')
  })

  it('用户消息的页脚一直都在（复制 / 编辑），且靠右', async () => {
    const wrapper = await render({ role: 'user', content: '你好' })
    expect(wrapper.find(`button[aria-label="${i18n.global.t('chat.copy')}"]`).exists()).toBe(true)
    expect(wrapper.find(`button[aria-label="${i18n.global.t('chat.editMessage')}"]`).exists()).toBe(
      true,
    )
    const footer = wrapper.get('.mt-1')
    expect(footer.classes()).toContain('justify-end')
    expect(footer.classes()).toContain('px-1')
  })

  it('时间戳走 i18n：en 是 AM/PM、zh 是 24 小时制，悬停 tooltip 给完整日期时间', async () => {
    const ts = Date.now()
    const wrapper = await render({ content: '正文', timestamp: ts })
    const footer = wrapper.get('.mt-1')
    // AI 回复的时间戳要和正文文字左边缘齐：markstream 的段落没有水平内边距，
    // 所以 footer 也不能有，否则时间戳整体右移
    expect(footer.classes()).toContain('justify-start')
    expect(footer.classes()).not.toContain('justify-end')
    expect(footer.classes().filter((c) => /^(p|m)[xl]-/.test(c))).toEqual([])

    const stamp = footer.get('span')
    expect(stamp.text()).toBe(i18n.global.d(ts, 'time'))
    expect(stamp.text()).toMatch(/[AP]M/)
    expect(stamp.attributes('data-slot')).toBe('tooltip-trigger')

    // 切语言后跟着变（也验证 d() 在 computed 里对 locale 是响应式的）
    i18n.global.locale.value = 'zh'
    await nextTick()
    expect(stamp.text()).toBe(i18n.global.d(ts, 'time'))
    expect(stamp.text()).not.toMatch(/[AP]M/)
    i18n.global.locale.value = 'en'
    await nextTick()

    // 悬停 → tooltip 里是完整日期时间
    stamp.trigger('pointerenter')
    stamp.trigger('pointermove')
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(document.body.textContent).toContain(i18n.global.d(ts, 'dateTime'))
  })

  it('时间戳只分三档：今天只给钟点、昨天前面加「昨天」、更早一律带年份', async () => {
    const stampOf = async (ts: number) =>
      (await render({ content: '正文', timestamp: ts })).get('.mt-1 span')

    const now = new Date()
    const year = now.getFullYear()

    // 今天：只有钟点，不该出现年份
    const today = await stampOf(now.getTime())
    expect(today.text()).toBe(i18n.global.d(now.getTime(), 'time'))
    expect(today.text()).not.toContain(String(year))

    // 昨天：用 setDate 保证是日历上的昨天（不用 86400000 硬减，DST 那天会偏）
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    yesterdayDate.setHours(10, 0, 0, 0)
    const yesterdayTs = yesterdayDate.getTime()
    const yesterday = await stampOf(yesterdayTs)
    expect(yesterday.text()).toBe(
      i18n.global.t('chat.timestampYesterday', { time: i18n.global.d(yesterdayTs, 'time') }),
    )
    expect(yesterday.text()).not.toContain(String(year))

    // 更早：不管是不是今年都带年份
    const olderTs = new Date(year - 1, 0, 15, 10, 0).getTime()
    const older = await stampOf(olderTs)
    expect(older.text()).toBe(i18n.global.d(olderTs, 'dateTimeWithYear'))
    expect(older.text()).toContain(String(year - 1))
  })
})
