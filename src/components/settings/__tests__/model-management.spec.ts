import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// reka 的弹窗定位依赖 ResizeObserver（jsdom 里没有）
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { mount, enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Plus, SquarePen, Check, X, Cloud, Lock } from '@lucide/vue'
import ModelManagement from '@/components/settings/ModelManagement.vue'
import AddModelDialog from '@/components/settings/AddModelDialog.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { i18n } from '@/i18n/config'
import { useSettingsStore } from '@/stores/settings'
import type { Model } from '@/types/chat'

enableAutoUnmount(afterEach)

const API_MODEL: Model = {
  id: 'm1',
  name: 'Model One',
  baseUrl: 'https://api.example.com/v1',
  kind: 'api',
  model: 'gpt-5',
  apiKey: 'sk-1234567890abcdef',
}

const OPENAI_MODEL: Model = { ...API_MODEL, id: 'm3', baseUrl: 'https://api.openai.com/v1' }

const GATE_MODEL: Model = {
  id: 'm2',
  name: 'Local Gate',
  baseUrl: 'http://localhost:11456/model-01/v1',
  kind: 'gate',
}

const flushTicks = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await nextTick()
}

const mountManagement = async (models: Model[] = [API_MODEL]) => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(ModelManagement, {
    props: { open: true },
    global: { plugins: [pinia, i18n] },
  })
  await flushTicks()

  const settingsStore = useSettingsStore()
  settingsStore.models = models.map((model) => ({ ...model }))
  settingsStore.defaultModelId = models[0]!.id
  await flushTicks()
  return { wrapper, settingsStore }
}

const buttonsWithIcon = (wrapper: VueWrapper, icon: unknown) =>
  wrapper.findAllComponents(Button).filter((button) => button.findComponent(icon as never).exists())

const buttonWithIcon = (wrapper: VueWrapper, icon: unknown) => buttonsWithIcon(wrapper, icon)[0]!

const inputById = (wrapper: VueWrapper, id: string) =>
  wrapper.findAllComponents(Input).find((input) => input.attributes('id') === id)

const inputValue = (wrapper: VueWrapper, id: string) =>
  (inputById(wrapper, id)!.element as HTMLInputElement).value

const cardByIndex = (wrapper: VueWrapper, index: number) => wrapper.findAllComponents(Card)[index]!

describe('模型管理', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('添加走独立弹窗，不再复用编辑用的表单', async () => {
    const { wrapper } = await mountManagement()

    await buttonWithIcon(wrapper, Plus).trigger('click')
    await flushTicks()

    expect(wrapper.findComponent(AddModelDialog).props('open')).toBe(true)
    expect(inputById(wrapper, 'model-name')).toBeUndefined()
  })

  it('编辑 api 模型：表单在卡片里展开，带出字段，且没有切换模式的 tab', async () => {
    const { wrapper, settingsStore } = await mountManagement()

    await buttonWithIcon(wrapper, SquarePen).trigger('click')
    await flushTicks()

    expect(wrapper.findComponent(AddModelDialog).props('open')).toBe(false)
    // 模式在创建时就定了，编辑表单里不该再有 tab
    expect(document.body.querySelectorAll('[role=tablist]')).toHaveLength(0)

    expect(inputValue(wrapper, 'model-name')).toBe('Model One')
    expect(inputValue(wrapper, 'model-url')).toBe('https://api.example.com/v1')
    expect(inputValue(wrapper, 'model-id')).toBe('gpt-5')
    expect(inputValue(wrapper, 'model-api-key')).toBe('sk-1234567890abcdef')

    await buttonWithIcon(wrapper, Check).trigger('click')
    await flushTicks()
    expect(settingsStore.models[0]).toMatchObject({ kind: 'api', model: 'gpt-5' })
    // 保存后表单收起
    expect(inputById(wrapper, 'model-name')).toBeUndefined()
  })

  it('编辑 gate 模型：只有模式说明，没有模型 ID / API Key，保存后仍是 gate', async () => {
    const { wrapper, settingsStore } = await mountManagement([GATE_MODEL])

    await buttonWithIcon(wrapper, SquarePen).trigger('click')
    await flushTicks()

    expect(inputById(wrapper, 'model-id')).toBeUndefined()
    expect(inputById(wrapper, 'model-api-key')).toBeUndefined()
    expect(document.body.textContent).toContain(i18n.global.t('settings.models.gateHint'))

    await inputById(wrapper, 'model-name')!.setValue('Renamed Gate')
    await buttonWithIcon(wrapper, Check).trigger('click')
    await flushTicks()

    expect(settingsStore.models[0]).toMatchObject({ name: 'Renamed Gate', kind: 'gate' })
    expect(settingsStore.models[0]!.model).toBeUndefined()
    expect(settingsStore.models[0]!.apiKey).toBeUndefined()
  })

  it('取消收起表单；点另一张卡片的铅笔会收起前一张', async () => {
    const { wrapper, settingsStore } = await mountManagement([API_MODEL, GATE_MODEL])

    const pencils = buttonsWithIcon(wrapper, SquarePen)
    expect(pencils).toHaveLength(2)

    await pencils[0]!.trigger('click')
    await flushTicks()
    expect(inputById(wrapper, 'model-id')).toBeDefined()

    await buttonWithIcon(wrapper, X).trigger('click')
    await flushTicks()
    expect(inputById(wrapper, 'model-id')).toBeUndefined()

    // 展开第二张（gate）：前一张收起，gate 卡片里没有 model-id
    await pencils[1]!.trigger('click')
    await flushTicks()
    expect(document.body.textContent).toContain(i18n.global.t('settings.models.gateHint'))
    expect(inputById(wrapper, 'model-id')).toBeUndefined()
    expect(inputById(wrapper, 'model-name')!.element).toBeInstanceOf(HTMLInputElement)

    // 展开的卡片会被标成主色，保存前后状态不变
    expect(cardByIndex(wrapper, 1).classes()).toContain('border-primary')
    expect(cardByIndex(wrapper, 0).classes()).not.toContain('border-primary')
    expect(settingsStore.models).toHaveLength(2)
  })

  it('卡片把模型信息摊在第二行：模型 ID、脱敏 Key、地址', async () => {
    const { wrapper, settingsStore } = await mountManagement()

    const card = cardByIndex(wrapper, 0)
    expect(card.text()).toContain('Model One')
    expect(card.text()).toContain('gpt-5')
    expect(card.text()).toContain('sk-1…cdef')
    expect(card.text()).toContain('https://api.example.com/v1')
    expect(card.text()).toContain(i18n.global.t('settings.models.kind.api'))
    // 默认模型才有「默认」标
    expect(card.text()).toContain(i18n.global.t('settings.models.default'))

    settingsStore.defaultModelId = ''
    await flushTicks()
    expect(cardByIndex(wrapper, 0).text()).not.toContain(i18n.global.t('settings.models.default'))
  })

  it('卡片图标：认得出服务商用 logo（单色的深色模式反色），认不出用云朵，gate 用锁', async () => {
    const { wrapper } = await mountManagement([OPENAI_MODEL, API_MODEL, GATE_MODEL])

    const [openai, custom, gate] = [0, 1, 2].map((index) => cardByIndex(wrapper, index))

    expect(openai!.find('img').exists()).toBe(true)
    expect(openai!.find('img').classes()).toContain('dark:invert')
    expect(openai!.findComponent(Cloud).exists()).toBe(false)

    expect(custom!.find('img').exists()).toBe(false)
    expect(custom!.findComponent(Cloud).exists()).toBe(true)

    expect(gate!.find('img').exists()).toBe(false)
    expect(gate!.findComponent(Lock).exists()).toBe(true)
  })
})
