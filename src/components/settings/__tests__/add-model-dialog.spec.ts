import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// reka 的弹窗/下拉定位依赖 ResizeObserver（jsdom 里没有）
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { mount, enableAutoUnmount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { toast } from 'vue-sonner'
import AddModelDialog from '@/components/settings/AddModelDialog.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { i18n } from '@/i18n/config'
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL_ID } from '@/lib/model'
import { useSettingsStore } from '@/stores/settings'
import type { ModelPrefill } from '@/composables/useApiModelForm'

// 弹窗内容被 teleport 到 body，不卸载的话下一个用例的 DOM 查询会命中上一个用例的残留
enableAutoUnmount(afterEach)

const flushTicks = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await nextTick()
}

const mountDialog = async (prefill?: ModelPrefill) => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AddModelDialog, {
    props: { open: true, prefill },
    global: { plugins: [pinia, i18n] },
  })
  // 弹窗内容要等 useMounted 变 true 之后才渲染出来
  await flushTicks()

  // 先有一个默认模型，用来确认「添加」不会顺手改掉默认模型
  const settingsStore = useSettingsStore()
  settingsStore.models = [
    { id: 'existing', name: 'Old Model', baseUrl: 'https://old.example.com', kind: 'api' },
  ]
  settingsStore.defaultModelId = 'existing'
  return { wrapper, settingsStore }
}

// 切 tab 必须走真实的 mousedown：只 emit update:modelValue 的话 reka 的 TabsContent 不会换内容
const openTab = async (label: RegExp) => {
  const trigger = Array.from(document.body.querySelectorAll('[role=tab]')).find((el) =>
    label.test(el.textContent ?? ''),
  ) as HTMLElement
  trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  await flushTicks()
}

const inputById = (wrapper: VueWrapper, id: string) =>
  wrapper.findAllComponents(Input).find((input) => input.attributes('id') === id)!

const buttonByText = (wrapper: VueWrapper, label: RegExp) =>
  wrapper.findAllComponents(Button).find((item) => label.test(item.text().trim()))!

/** 底部的「添加」按钮 */
const addButton = (wrapper: VueWrapper) => buttonByText(wrapper, /^(Add|添加)$/)

describe('模型管理 - 添加模型弹窗', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('默认停在 API 模式：手填模型 ID 添加后入库，且不改默认模型', async () => {
    const { wrapper, settingsStore } = await mountDialog()

    await inputById(wrapper, 'api-base-url').setValue('https://api.example.com/v1')
    await inputById(wrapper, 'api-key').setValue('sk-1')
    await openTab(/Enter model ID|手动输入模型 ID/)
    await inputById(wrapper, 'api-model-id').setValue('gpt-5-mini')

    await addButton(wrapper).trigger('click')

    expect(settingsStore.models).toHaveLength(2)
    expect(settingsStore.models[1]).toMatchObject({
      name: 'gpt-5-mini',
      baseUrl: 'https://api.example.com/v1',
      kind: 'api',
      model: 'gpt-5-mini',
      apiKey: 'sk-1',
    })
    expect(settingsStore.defaultModelId).toBe('existing')
    expect(toast.success).toHaveBeenCalledWith(i18n.global.t('settings.models.addSuccess'))
    // 添加成功后关掉弹窗
    const events = wrapper.emitted('update:open') ?? []
    expect(events[events.length - 1]).toEqual([false])
  })

  it('克隆预填：带着 prefill 打开时不用手填就能添加', async () => {
    const { wrapper, settingsStore } = await mountDialog({
      kind: 'api',
      baseUrl: 'https://prefill.example.com/v1',
      modelId: 'gpt-5-mini',
      apiKey: 'sk-prefill',
    })

    // 预填直接落进「手动填写模型 ID」那条路
    expect(inputById(wrapper, 'api-base-url').element).toHaveProperty(
      'value',
      'https://prefill.example.com/v1',
    )
    expect(inputById(wrapper, 'api-key').element).toHaveProperty('value', 'sk-prefill')
    expect(inputById(wrapper, 'api-model-id').element).toHaveProperty('value', 'gpt-5-mini')

    await addButton(wrapper).trigger('click')

    expect(settingsStore.models[1]).toMatchObject({
      name: 'gpt-5-mini',
      baseUrl: 'https://prefill.example.com/v1',
      kind: 'api',
      model: 'gpt-5-mini',
      apiKey: 'sk-prefill',
    })
  })

  it('DeepSeek 官方模式：没填 Key 报错，填了就用固定的地址和模型建模型', async () => {
    const { wrapper, settingsStore } = await mountDialog()
    await openTab(/DeepSeek Official|DeepSeek 官方模式/)

    await addButton(wrapper).trigger('click')
    expect(toast.error).toHaveBeenCalledWith(i18n.global.t('setup.deepseek.apiKeyRequired'))
    expect(settingsStore.models).toHaveLength(1)

    await inputById(wrapper, 'deepseek-api-key').setValue('sk-deepseek')
    await addButton(wrapper).trigger('click')

    expect(settingsStore.models[1]).toMatchObject({
      name: 'DeepSeek',
      baseUrl: DEEPSEEK_BASE_URL,
      kind: 'api',
      model: DEEPSEEK_MODEL_ID,
      apiKey: 'sk-deepseek',
    })
  })

  it('输入框里回车等于点「添加」', async () => {
    const { wrapper, settingsStore } = await mountDialog()

    await inputById(wrapper, 'api-base-url').setValue('https://api.example.com/v1')
    await openTab(/Enter model ID|手动输入模型 ID/)
    await inputById(wrapper, 'api-model-id').setValue('my-model')
    await inputById(wrapper, 'api-model-id').trigger('keyup.enter')
    await flushTicks(2)

    expect(settingsStore.models[1]).toMatchObject({ model: 'my-model', name: 'my-model' })
  })

  it('测试连通性：按当前表单发起一次非流式请求', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper } = await mountDialog()

    await inputById(wrapper, 'api-base-url').setValue('https://api.example.com/v1')
    await inputById(wrapper, 'api-key').setValue('sk-1')
    await openTab(/Enter model ID|手动输入模型 ID/)
    await inputById(wrapper, 'api-model-id').setValue('gpt-5-mini')

    await buttonByText(wrapper, /^(Test|测试)$/)
      .trigger('click')
      .then(() => flushPromises())

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-1' }),
      }),
    )
    expect(toast.success).toHaveBeenCalledWith(
      i18n.global.t('settings.models.testSuccess', { reply: 'OK' }),
    )
  })
})
