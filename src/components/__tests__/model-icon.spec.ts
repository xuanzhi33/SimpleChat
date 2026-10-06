import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { Cloud, Lock } from '@lucide/vue'
import ModelIcon from '@/components/ModelIcon.vue'
import { providerList } from '@/configs/providers'
import type { Model } from '@/types/chat'
// 单色 logo 必须用 currentColor 上色，颜色才能跟着主题走
import openaiSvg from '@/assets/openai.svg?raw'
import openrouterSvg from '@/assets/openrouter.svg?raw'
import siliconcloudSvg from '@/assets/siliconcloud.svg?raw'

enableAutoUnmount(afterEach)

const model = (extra: Partial<Model> = {}): Model => ({
  id: 'm1',
  name: 'Model',
  baseUrl: 'https://api.example.com/v1',
  kind: 'api',
  ...extra,
})

const mountIcon = (props: { model?: Model; provider?: (typeof providerList)[number] }) =>
  mount(ModelIcon, { props })

describe('模型图标', () => {
  it('认得出服务商就用它的 logo；单色的深色模式反色，彩色的不反色', () => {
    const openai = mountIcon({ model: model({ baseUrl: 'https://api.openai.com/v1' }) })
    expect(openai.find('img').exists()).toBe(true)
    expect(openai.find('img').classes()).toContain('dark:invert')
    expect(openai.findComponent(Cloud).exists()).toBe(false)

    const openrouter = mountIcon({ model: model({ baseUrl: 'https://openrouter.ai/api/v1' }) })
    expect(openrouter.find('img').classes()).toContain('dark:invert')

    const deepseek = mountIcon({ model: model({ baseUrl: 'https://api.deepseek.com' }) })
    expect(deepseek.find('img').exists()).toBe(true)
    expect(deepseek.find('img').classes()).not.toContain('dark:invert')
  })

  it('认不出地址的 api 模型用云朵，gate 模型用锁（不看地址）', () => {
    const unknown = mountIcon({ model: model() })
    expect(unknown.find('img').exists()).toBe(false)
    expect(unknown.findComponent(Cloud).exists()).toBe(true)

    const gate = mountIcon({ model: model({ kind: 'gate', baseUrl: 'https://api.openai.com/v1' }) })
    expect(gate.findComponent(Lock).exists()).toBe(true)
    expect(gate.find('img').exists()).toBe(false)
  })

  it('服务商下拉可以直接传 provider', () => {
    const openai = providerList.find((provider) => provider.name === 'OpenAI')!
    const wrapper = mountIcon({ provider: openai })
    expect(wrapper.find('img').attributes('src')).toBe(openai.logo)
    expect(wrapper.find('img').classes()).toContain('dark:invert')
  })

  it('外面传的 class 会合到图标上，不会丢掉默认尺寸', () => {
    const wrapper = mount(ModelIcon, { props: { model: model() }, attrs: { class: 'mr-1.5' } })
    expect(wrapper.findComponent(Cloud).classes()).toEqual(
      expect.arrayContaining(['size-4', 'shrink-0', 'mr-1.5']),
    )
  })

  it('单色 logo 只用 currentColor，不写死颜色', () => {
    for (const svg of [openaiSvg, openrouterSvg]) {
      expect(svg).toContain('currentColor')
      expect(svg).not.toMatch(/fill="#/)
    }

    // 品牌色 logo（DeepSeek / 硅基流动）反过来：必须写死颜色
    expect(siliconcloudSvg).toMatch(/fill="#/)
  })
})
