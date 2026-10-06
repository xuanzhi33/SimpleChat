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
import { Plus, SquarePen } from '@lucide/vue'
import ModelManagement from '@/components/settings/ModelManagement.vue'
import AddModelDialog from '@/components/settings/AddModelDialog.vue'
import { Button } from '@/components/ui/button'
import { CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { i18n } from '@/i18n/config'
import { useSettingsStore } from '@/stores/settings'

enableAutoUnmount(afterEach)

const flushTicks = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await nextTick()
}

const mountManagement = async () => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(ModelManagement, {
    props: { open: true },
    global: { plugins: [pinia, i18n] },
  })
  await flushTicks()

  const settingsStore = useSettingsStore()
  settingsStore.models = [
    {
      id: 'm1',
      name: 'Model One',
      baseUrl: 'https://api.example.com/v1',
      kind: 'api',
      model: 'gpt-5',
    },
  ]
  settingsStore.defaultModelId = 'm1'
  await flushTicks()
  return { wrapper, settingsStore }
}

const buttonWithIcon = (wrapper: VueWrapper, icon: unknown) =>
  wrapper.findAllComponents(Button).find((button) => button.findComponent(icon as never).exists())!

const cardTitles = (wrapper: VueWrapper) =>
  wrapper.findAllComponents(CardTitle).map((title) => title.text())

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
    expect(cardTitles(wrapper)).not.toContain(i18n.global.t('settings.models.editModel'))
  })

  it('编辑仍然用内联表单，并带出该模型的字段', async () => {
    const { wrapper } = await mountManagement()

    await buttonWithIcon(wrapper, SquarePen).trigger('click')
    await flushTicks()

    expect(cardTitles(wrapper)).toContain(i18n.global.t('settings.models.editModel'))
    expect(wrapper.findComponent(AddModelDialog).props('open')).toBe(false)

    const nameInput = wrapper
      .findAllComponents(Input)
      .find((input) => input.attributes('id') === 'model-name')!
    expect((nameInput.element as HTMLInputElement).value).toBe('Model One')
  })
})
