import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import ThinkingLevelToggle from '@/components/chat/ThinkingLevelToggle.vue'
import { i18n } from '@/i18n/config'
import type { ThinkingStyle } from '@/configs/providers'
import type { ThinkingLevel } from '@/types/chat'

enableAutoUnmount(afterEach)

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

interface Options {
  level?: ThinkingLevel
  style?: ThinkingStyle
  conversationId?: string
  disabled?: boolean
}

const mountToggle = (options: Options = {}) => {
  const wrapper = mount(ThinkingLevelToggle, {
    props: {
      level: options.level,
      style: options.style ?? 'reasoning_effort',
      conversationId: options.conversationId ?? 'c1',
      disabled: options.disabled ?? false,
    },
    global: { plugins: [i18n] },
  })
  return wrapper
}

/** 档位名字那个 span（灰的「思考强度」是另一个） */
const levelText = (wrapper: VueWrapper) => wrapper.findAll('span')[1]!
const button = (wrapper: VueWrapper) => wrapper.find('button')
/** 最后一次 emit 的参数（TS target 没有 Array.prototype.at） */
const lastEmitted = (wrapper: VueWrapper) => {
  const all = wrapper.emitted('setLevel') ?? []
  return all[all.length - 1]
}

describe('输入框左下角的思考强度', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('外显「思考强度 + 当前档位」，档位名字单独上色', () => {
    const wrapper = mountToggle({ level: 'high' })

    expect(wrapper.text()).toContain(i18n.global.t('chat.thinkingEffort.title'))
    expect(levelText(wrapper).text()).toBe(i18n.global.t('chat.thinkingEffort.high'))
    expect(levelText(wrapper).classes()).toContain('text-orange-600')
    // 没设置过就是「默认」，灰的
    expect(levelText(mountToggle()).text()).toBe(i18n.global.t('chat.thinkingEffort.default'))
    expect(levelText(mountToggle()).classes()).toContain('text-muted-foreground')
  })

  it('档位越高颜色越烫，关 / 默认保持灰色', () => {
    expect(levelText(mountToggle({ level: 'low' })).classes()).toContain('text-emerald-600')
    expect(levelText(mountToggle({ level: 'medium' })).classes()).toContain('text-amber-600')
    expect(levelText(mountToggle({ level: 'high' })).classes()).toContain('text-orange-600')
    expect(levelText(mountToggle({ level: 'max' })).classes()).toContain('text-red-600')
    expect(levelText(mountToggle({ level: 'none' })).classes()).toContain('text-muted-foreground')
  })

  it('硅基流动的「开」显示成「开」', () => {
    const wrapper = mountToggle({ level: 'medium', style: 'enable_thinking' })

    expect(levelText(wrapper).text()).toBe(i18n.global.t('chat.thinkingEffort.on'))
  })

  it('点一下切到「关」；再点一下切回上次的档位', async () => {
    const wrapper = mountToggle({ level: 'high' })

    await button(wrapper).trigger('click')
    expect(lastEmitted(wrapper)).toEqual(['none'])

    // 外部把档位改成「关」后，记着的还是「高」
    await wrapper.setProps({ level: 'none' })
    await button(wrapper).trigger('click')
    expect(lastEmitted(wrapper)).toEqual(['high'])
  })

  it('没设置过档位就切回「默认」', async () => {
    const wrapper = mountToggle()

    await button(wrapper).trigger('click')
    await wrapper.setProps({ level: 'none' })
    await button(wrapper).trigger('click')

    expect(lastEmitted(wrapper)).toEqual([undefined])
  })

  it('切了对话就忘掉上次的档位（没记的 = 默认）', async () => {
    const wrapper = mountToggle({ level: 'high', conversationId: 'c1' })

    await wrapper.setProps({ conversationId: 'c2', level: 'none' })
    await button(wrapper).trigger('click')

    expect(lastEmitted(wrapper)).toEqual([undefined])
  })

  it('认不出的服务商（LLM Gate / 自定义地址）整块不渲染', () => {
    const wrapper = mountToggle({ style: 'none', level: 'high' })

    expect(button(wrapper).exists()).toBe(false)
    expect(wrapper.text()).not.toContain(i18n.global.t('chat.thinkingEffort.title'))
  })

  it('生成中禁用', () => {
    expect(button(mountToggle({ disabled: true })).attributes('disabled')).toBeDefined()
  })
})
