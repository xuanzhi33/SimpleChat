import { nextTick } from 'vue'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

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

  afterEach(() => {
    vi.useRealTimers()
  })

  it('用户消息保持纯文本，不渲染 markdown', async () => {
    const wrapper = await render({ role: 'user', content: '**not bold** <b>x</b>' })
    expect(wrapper.text()).toContain('**not bold** <b>x</b>')
    expect(wrapper.html()).not.toContain('<strong>')
  })

  it('用户气泡的圆角有上限：不用 rounded-full（多行会变成两个大圆弧）', async () => {
    const wrapper = await render({ role: 'user', content: '多行\n内容\n也要圆得正常' })

    const bubble = wrapper.find('.rounded-3xl')
    expect(bubble.text()).toContain('多行')
    // rounded-full 会被 CSS 夹成「高度的一半」，行越多圆弧越大
    expect(bubble.classes()).not.toContain('rounded-full')
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
    // 思考中自动展开是限高的（配合自动跟到底看最新几行）
    expect(thinking.get('.thinking-md').element.parentElement!.className).toMatch(
      /max-h-25.*overflow-y-auto/,
    )

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

  it('思考结束收起时先保持限高，动画放完才解除（否则会先撑开一下再收）', async () => {
    const wrapper = mount(MessageItem, {
      props: {
        message: makeMessage({ reasoning_content: '先想一想', isStreaming: true }),
      },
      global: { plugins: [createPinia(), i18n] },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    const bodyClass = () => wrapper.get('.thinking-md').element.parentElement!.className
    expect(bodyClass()).toMatch(/max-h-25.*overflow-y-auto/)

    // 收到首个正文增量（思考结束）→ 开始收起
    vi.useFakeTimers()
    await wrapper.setProps({
      message: makeMessage({
        content: '正文',
        reasoning_content: '先想一想',
        isStreaming: true,
        thinkingDone: true,
      }),
    })
    await nextTick()
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('false')
    expect(bodyClass()).toMatch(/max-h-25.*overflow-y-auto/)

    // 动画放完再解除限高：那时内容已收成 0 高，看不出变化
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(bodyClass()).not.toMatch(/max-h-|overflow-y-/)
  })

  it('手动展开已完成的思考：整段铺开，不限高、无内部滚动条', async () => {
    const wrapper = await render({
      reasoning_content: '第一步\n\n第二步',
      isStreaming: false,
    })
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('false')

    await wrapper.get('button[aria-expanded]').trigger('click')
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true')

    // 手动展开不限高（只有思考中自动展开才限高）
    const body = wrapper.get('.thinking-md').element.parentElement!
    expect(body.className).not.toMatch(/max-h-|overflow-y-/)
    expect(body.textContent).toContain('第一步')
    expect(body.textContent).toContain('第二步')
  })

  it('AI 消息的页脚（时间/复制）流式期间占好位置、看不见，回答结束才淡入', async () => {
    const copyLabel = i18n.global.t('chat.copy')
    const wrapper = mount(MessageItem, {
      props: { message: makeMessage({ content: '正文', isStreaming: true }) },
      global: { plugins: [createPinia(), i18n] },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    // 位置先占着（不然回答结束再撑高一行，工具栏会被输入框盖住），但是看不见、点不到
    const footer = wrapper.get('.mt-1')
    expect(wrapper.find(`button[aria-label="${copyLabel}"]`).exists()).toBe(true)
    expect(footer.classes()).toContain('invisible')
    expect(footer.classes()).toContain('opacity-0')
    expect(footer.classes()).toContain('transition-opacity')

    await wrapper.setProps({ message: makeMessage({ content: '正文', isStreaming: false }) })
    await nextTick()
    expect(footer.classes()).not.toContain('invisible')
    expect(footer.classes()).not.toContain('opacity-0')
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

  it('请求失败时在 AI 输出的位置用红色（destructive）显示错误', async () => {
    const wrapper = await render({ content: '', error: '请求失败（401）：API Key 错误，认证失败' })
    const errorLine = wrapper.get('.text-destructive')
    expect(errorLine.text()).toContain('API Key')
    // 详情是多行的，需要靠 whitespace-pre-line 才不挤成一行
    expect(errorLine.classes()).toContain('whitespace-pre-line')
    // 一点正文都没收到时不该再留一个空的 markdown 块
    expect(wrapper.find('.markstream-vue').exists()).toBe(false)
  })

  it('拿到半截正文后失败：正文和错误都在，错误接在正文下面', async () => {
    const wrapper = await render({ content: '半截回答', error: '连接被中断' })
    expect(wrapper.text()).toContain('半截回答')
    expect(wrapper.get('.text-destructive').text()).toBe('连接被中断')
  })
})
