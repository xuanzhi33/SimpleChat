import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, enableAutoUnmount, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// reka 的弹层定位要 ResizeObserver（jsdom 里没有）
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

import SystemPromptPresets from '@/components/chat/SystemPromptPresets.vue'
import { Input } from '@/components/ui/input'
import { i18n } from '@/i18n/config'
import { useSettingsStore } from '@/stores/settings'

enableAutoUnmount(afterEach)

const t = (key: string) => i18n.global.t(`chat.systemPromptPresets.${key}`)

const flushTicks = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await nextTick()
}

const PROMPT = '你是一位专业的编程助手，擅长解答技术问题'

const mountPresets = async (value = PROMPT) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const wrapper = mount(SystemPromptPresets, {
    props: { modelValue: value },
    global: { plugins: [pinia, i18n] },
  })
  await flushTicks()

  return wrapper
}

const button = (wrapper: VueWrapper, label: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(label))!

/** 弹层是 portal 到 body 的，wrapper 里找不到 */
const bodyButtons = () =>
  Array.from(document.body.querySelectorAll('button')).map((el) => new DOMWrapper(el))

const popoverItem = (name: string) => bodyButtons().find((b) => b.text().includes(name))!

const openPopover = async (wrapper: VueWrapper) => {
  await button(wrapper, t('title')).trigger('click')
  await flushTicks()
}

describe('系统提示词预设', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('没有预设时给出空状态提示（入口还在）', async () => {
    const wrapper = await mountPresets()

    await openPopover(wrapper)

    expect(document.body.textContent).toContain(t('empty'))
  })

  it('系统提示词为空（或只有空白）时不能保存为预设', async () => {
    const wrapper = await mountPresets('   ')

    expect(button(wrapper, t('save')).attributes('disabled')).toBeDefined()
  })

  it('保存为预设：默认名取内容首行前 20 字，可改', async () => {
    const wrapper = await mountPresets()

    await button(wrapper, t('save')).trigger('click')
    await flushTicks()

    const nameInput = wrapper.findComponent(Input)
    expect((nameInput.element as HTMLInputElement).value).toBe(PROMPT.slice(0, 20))

    await nameInput.setValue('代码审查')
    await button(wrapper, t('confirm')).trigger('click')
    await flushTicks()

    expect(useSettingsStore().systemPromptPresets).toHaveLength(1)
    expect(useSettingsStore().systemPromptPresets[0]).toMatchObject({
      name: '代码审查',
      content: PROMPT,
    })
    // 保存完收起名称输入，回到两个按钮
    expect(wrapper.findComponent(Input).exists()).toBe(false)
  })

  it('名称为空时保存按钮禁用', async () => {
    const wrapper = await mountPresets()

    await button(wrapper, t('save')).trigger('click')
    await flushTicks()
    await wrapper.findComponent(Input).setValue('   ')

    expect(button(wrapper, t('confirm')).attributes('disabled')).toBeDefined()
  })

  it('点预设项就把内容填进去（覆盖当前内容）', async () => {
    const wrapper = await mountPresets('旧内容')
    useSettingsStore().addSystemPromptPreset('预设一', '新内容')
    await flushTicks()

    await openPopover(wrapper)
    // 列表里同时有名称和内容摘要
    const item = popoverItem('预设一')
    expect(item.text()).toContain('新内容')

    await item.trigger('click')
    await flushTicks()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['新内容'])
    // 选完就收起来
    expect(document.body.textContent).not.toContain('预设一')
  })

  it('垃圾桶删掉预设，不动正在编辑的内容', async () => {
    const wrapper = await mountPresets('当前内容')
    useSettingsStore().addSystemPromptPreset('预设一', '新内容')
    await flushTicks()

    await openPopover(wrapper)
    const trash = bodyButtons().find((b) => b.attributes('aria-label') === t('delete'))!
    await trash.trigger('click')
    await flushTicks()

    expect(useSettingsStore().systemPromptPresets).toHaveLength(0)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
