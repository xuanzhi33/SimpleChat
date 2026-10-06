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
import { Plus, SquarePen, Check } from '@lucide/vue'
import ModelManagement from '@/components/settings/ModelManagement.vue'
import AddModelDialog from '@/components/settings/AddModelDialog.vue'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
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

const buttonWithIcon = (wrapper: VueWrapper, icon: unknown) =>
  wrapper.findAllComponents(Button).find((button) => button.findComponent(icon as never).exists())!

const inputById = (wrapper: VueWrapper, id: string) =>
  wrapper.findAllComponents(Input).find((input) => input.attributes('id') === id)

const inputValue = (wrapper: VueWrapper, id: string) =>
  (inputById(wrapper, id)!.element as HTMLInputElement).value

const cardTitles = (wrapper: VueWrapper) =>
  wrapper.findAllComponents(CardTitle).map((title) => title.text())

/** 卡片标题现在带模式徽标，所以按「包含」判断 */
const hasCardTitle = (wrapper: VueWrapper, label: string) =>
  cardTitles(wrapper).some((text) => text.includes(label))

const startEdit = async (wrapper: VueWrapper) => {
  await buttonWithIcon(wrapper, SquarePen).trigger('click')
  await flushTicks()
}

describe('模型管理', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('添加走独立弹窗，不再复用编辑用的内联表单', async () => {
    const { wrapper } = await mountManagement()

    await buttonWithIcon(wrapper, Plus).trigger('click')
    await flushTicks()

    expect(wrapper.findComponent(AddModelDialog).props('open')).toBe(true)
    expect(hasCardTitle(wrapper, i18n.global.t('settings.models.editModel'))).toBe(false)
  })

  it('编辑 api 模型：内联表单带出字段，且没有切换模式的 tab', async () => {
    const { wrapper, settingsStore } = await mountManagement()

    await startEdit(wrapper)

    expect(hasCardTitle(wrapper, i18n.global.t('settings.models.editModel'))).toBe(true)
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
  })

  it('编辑 gate 模型：只有模式说明，没有模型 ID / API Key，保存后仍是 gate', async () => {
    const { wrapper, settingsStore } = await mountManagement([GATE_MODEL])

    await startEdit(wrapper)

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

  it('卡片把模型信息摊在第二行：模型 ID、脱敏 Key、地址', async () => {
    const { wrapper, settingsStore } = await mountManagement()

    // 只有一张模型卡片（编辑卡片没打开）
    expect(cardTitles(wrapper)).toHaveLength(0)
    const card = wrapper.findAllComponents(Card)[0]!
    expect(card.text()).toContain('Model One')
    expect(card.text()).toContain('gpt-5')
    expect(card.text()).toContain('sk-1…cdef')
    expect(card.text()).toContain('https://api.example.com/v1')
    expect(card.text()).toContain(i18n.global.t('settings.models.kind.api'))
    // 默认模型才有「默认」标
    expect(card.text()).toContain(i18n.global.t('settings.models.default'))

    settingsStore.defaultModelId = ''
    await flushTicks()
    expect(wrapper.findAllComponents(Card)[0]!.text()).not.toContain(
      i18n.global.t('settings.models.default'),
    )
  })
})
