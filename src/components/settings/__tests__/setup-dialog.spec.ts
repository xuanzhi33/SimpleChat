import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// reka 的弹窗/下拉定位依赖 ResizeObserver（jsdom 里没有）
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// jsdom 没有实现 pointer capture，reka 的 SelectTrigger 在 pointerdown 里会调它
Element.prototype.hasPointerCapture = () => false

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { mount, enableAutoUnmount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SetupDialog from '@/components/settings/SetupDialog.vue'
import ModelInfo from '@/components/settings/ModelInfo.vue'
import { Select } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { i18n } from '@/i18n/config'
import { providerList } from '@/configs/providers'
import { useSettingsStore } from '@/stores/settings'

// 弹窗内容被 teleport 到 body，不卸载的话下一个用例的 DOM 查询会命中上一个用例的残留
enableAutoUnmount(afterEach)

/** reka 的 TabsContent/Presence 要几个 tick 才把新面板渲染出来，统一多冲几次 */
const flushTicks = async (times = 4) => {
  for (let i = 0; i < times; i += 1) await nextTick()
}

// 弹窗内容会被 teleport 到 body，所以统一按组件查（wrapper.find 的 DOM 查询跨不过 teleport）
const mountDialog = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(SetupDialog, {
    props: { open: true },
    global: { plugins: [pinia, i18n] },
  })
  // 弹窗内容要等 useMounted 变 true 之后才渲染出来
  await flushTicks()
  return { wrapper, settingsStore: useSettingsStore() }
}

// 切 tab 必须走真实的 mousedown：只 emit update:modelValue 的话 reka 的 TabsContent 不会换内容
const openTab = async (label: RegExp) => {
  const trigger = Array.from(document.body.querySelectorAll('[role=tab]')).find((el) =>
    label.test(el.textContent ?? ''),
  ) as HTMLElement
  trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  await flushTicks()
}

const openApiTab = () => openTab(/API Mode|API 模式/)
const openManualModelTab = () => openTab(/Enter model ID|手动输入模型 ID/)

/** Base URL 的下拉框：另一个 Select 是语言选择，靠取值认出它（'custom' 是「自定义」选项的值） */
const providerSelect = (wrapper: VueWrapper) =>
  wrapper
    .findAllComponents(Select)
    .find(
      (select) =>
        select.props('modelValue') === 'custom' ||
        providerList.some((provider) => provider.name === select.props('modelValue')),
    )!

/** 模型选择框：整个弹窗里只有这一个 Combobox */
const modelSelect = (wrapper: VueWrapper) => wrapper.findComponent(Combobox)

/** 模型输入框（Combobox 里那个 input）里的文字 */
const modelInputValue = (wrapper: VueWrapper) =>
  (modelSelect(wrapper).find('input').element as HTMLInputElement).value

const selectProvider = async (wrapper: VueWrapper, value: string) => {
  providerSelect(wrapper).vm.$emit('update:modelValue', value)
  await flushTicks(2)
}

/** 往模型选择框里打字（Combobox 的搜索），然后返回当前可见的选项文字 */
const searchModels = async (text: string) => {
  const input = document.body.querySelector('#api-model-select') as HTMLInputElement
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushTicks()
  return Array.from(document.body.querySelectorAll('[role=option]')).map(
    (option) => option.textContent?.trim() ?? '',
  )
}

const inputById = (wrapper: VueWrapper, id: string) =>
  wrapper.findAllComponents(Input).find((input) => input.attributes('id') === id)!

const baseUrlInput = (wrapper: VueWrapper) => inputById(wrapper, 'api-base-url')
const baseUrlValue = (wrapper: VueWrapper) =>
  (baseUrlInput(wrapper).element as HTMLInputElement).value

const buttonByText = (wrapper: VueWrapper, label: RegExp) =>
  wrapper.findAllComponents(Button).find((item) => label.test(item.text()))!

const submit = (wrapper: VueWrapper) =>
  buttonByText(wrapper, /Complete Setup|完成设置/).trigger('click')

const fetchModels = (wrapper: VueWrapper) =>
  buttonByText(wrapper, /Validate key & fetch models|校验 Key 并获取模型列表/).trigger('click')

describe('欢迎弹窗 API 模式', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('三个 tab 各带一个图标', async () => {
    await mountDialog()

    const tabs = Array.from(document.body.querySelectorAll('[role=tab]'))
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => !!tab.querySelector('svg, img'))).toEqual([true, true, true])
  })

  it('默认自定义：Base URL 可以自己填，手动填模型 ID 后提交', async () => {
    const { wrapper, settingsStore } = await mountDialog()
    await openApiTab()

    expect(baseUrlInput(wrapper).attributes('disabled')).toBeUndefined()

    await baseUrlInput(wrapper).setValue('https://my-gateway.example/v1')
    await openManualModelTab()
    await inputById(wrapper, 'api-model-id').setValue('my-model')
    await submit(wrapper)

    expect(settingsStore.models).toHaveLength(1)
    expect(settingsStore.models[0]).toMatchObject({
      baseUrl: 'https://my-gateway.example/v1',
      kind: 'api',
      model: 'my-model',
    })
  })

  it('选预设：地址自动填成预设值且输入框禁用，提交时用预设地址', async () => {
    const { wrapper, settingsStore } = await mountDialog()
    await openApiTab()

    await selectProvider(wrapper, 'OpenRouter')
    expect(baseUrlInput(wrapper).attributes('disabled')).toBeDefined()
    expect(baseUrlValue(wrapper)).toBe('https://openrouter.ai/api/v1')

    await openManualModelTab()
    await inputById(wrapper, 'api-model-id').setValue('openai/gpt-5')
    await submit(wrapper)

    expect(settingsStore.models[0]).toMatchObject({
      baseUrl: 'https://openrouter.ai/api/v1',
      kind: 'api',
      model: 'openai/gpt-5',
    })
  })

  it('切到预设再切回自定义：自己填的地址还在，输入框恢复可编辑', async () => {
    const { wrapper } = await mountDialog()
    await openApiTab()

    await baseUrlInput(wrapper).setValue('https://my-gateway.example/v1')

    await selectProvider(wrapper, providerList[0]!.name)
    expect(baseUrlValue(wrapper)).toBe(providerList[0]!.url)
    expect(baseUrlInput(wrapper).attributes('disabled')).toBeDefined()

    await selectProvider(wrapper, 'custom')
    expect(baseUrlInput(wrapper).attributes('disabled')).toBeUndefined()
    expect(baseUrlValue(wrapper)).toBe('https://my-gateway.example/v1')
  })

  it('字段顺序：Base URL → API Key → 模型选择', async () => {
    await mountDialog()
    await openApiTab()

    const html = document.body.innerHTML
    const baseUrl = html.indexOf('api-base-url')
    const apiKeyInput = html.indexOf('id="api-key"')
    // 第 1 个 tabs-list 是模式切换，第 2 个才是「从列表选择 / 手动输入」
    const tabLists = [...html.matchAll(/data-slot="tabs-list"/g)].map((match) => match.index)

    expect(baseUrl).toBeGreaterThan(-1)
    expect(apiKeyInput).toBeGreaterThan(baseUrl)
    expect(tabLists).toHaveLength(2)
    expect(tabLists[1]).toBeGreaterThan(apiKeyInput)
  })

  it('获取模型列表：按接口返回渲染模型名（id），选中后展示上下文长度与输入模态', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'plain-model', object: 'model' },
          {
            id: 'deepseek-v4',
            name: 'DeepSeek V4',
            context_window: 128000,
            input_modalities: ['text', 'image'],
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper } = await mountDialog()
    await openApiTab()

    await selectProvider(wrapper, 'OpenRouter')
    await inputById(wrapper, 'api-key').setValue('sk-test')
    await fetchModels(wrapper)
    await flushPromises()
    await flushTicks()

    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: 'Bearer sk-test' },
      signal: undefined,
    })

    // 模型下拉里带上了选中的 id（选项文案由 modelDisplayName + i18n 拼，见 models.spec）
    expect(modelSelect(wrapper).props('modelValue')).toBe('')

    modelSelect(wrapper).vm.$emit('update:modelValue', 'deepseek-v4')
    await flushTicks(2)

    // 选中之后输入框里显示的是「模型名（模型 id）」而不是光秃秃的 id
    expect(modelInputValue(wrapper)).toBe(
      i18n.global.t('setup.api.modelOption', { name: 'DeepSeek V4', id: 'deepseek-v4' }),
    )

    const info = wrapper.findComponent(ModelInfo)
    expect(info.exists()).toBe(true)
    expect(info.text()).toContain('128K')
    expect(info.findAllComponents(Badge)).toHaveLength(2)

    // 模型 ID 写进 model，列表接口给的 name 直接当展示名
    const settingsStore = useSettingsStore()
    await submit(wrapper)
    expect(settingsStore.models[0]).toMatchObject({
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'deepseek-v4',
      name: 'DeepSeek V4',
    })
  })

  it('模型列表可以按模型名或模型 ID 搜索，搜不到时有提示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { id: 'deepseek-v4', name: 'DeepSeek V4' },
            { id: 'plain-model' },
            { id: 'gpt-5' },
          ],
        }),
      })),
    )

    const { wrapper } = await mountDialog()
    await openApiTab()

    await selectProvider(wrapper, 'OpenRouter')
    await fetchModels(wrapper)
    await flushPromises()
    await flushTicks()

    // 按名字里的片段搜
    const byName = await searchModels('deepseek')
    expect(byName).toHaveLength(1)
    expect(byName[0]).toContain('deepseek-v4')

    // 按模型 ID 搜（没名字的模型只能这样搜）
    expect(await searchModels('plain-model')).toEqual(['plain-model'])

    // 搜不到时给个提示，而不是空白
    expect(await searchModels('zzzz')).toEqual([])
    expect(document.body.querySelector('[data-slot=combobox-empty]')?.textContent?.trim()).toBe(
      i18n.global.t('setup.api.modelsNoMatch'),
    )
  })

  it('列表接口没给名字（OpenAI 那种）时，展示名回落成模型 ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 'gpt-5' }] }) })),
    )

    const { wrapper } = await mountDialog()
    await openApiTab()

    await selectProvider(wrapper, 'OpenAI')
    await fetchModels(wrapper)
    await flushPromises()
    await flushTicks()

    modelSelect(wrapper).vm.$emit('update:modelValue', 'gpt-5')
    await flushTicks(2)
    expect(modelInputValue(wrapper)).toBe('gpt-5')

    await submit(wrapper)
    expect(useSettingsStore().models[0]).toMatchObject({ model: 'gpt-5', name: 'gpt 5' })
  })
})

describe('欢迎弹窗 语言选择', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('下拉列出全部语言，选中繁体中文后写进设置', async () => {
    const { wrapper, settingsStore } = await mountDialog()

    // 弹窗里有两个 Select：语言选择是唯一「值是语言代码」的那个
    const localeValues: string[] = [...i18n.global.availableLocales]
    const languageSelect = wrapper
      .findAllComponents(Select)
      .find((select) => localeValues.includes(String(select.props('modelValue'))))!

    // reka 的 SelectTrigger 靠 pointerdown 打开
    const trigger = document.body.querySelector('#language-select') as HTMLElement
    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    await flushTicks()

    const options = Array.from(document.body.querySelectorAll('[role=option]')).map((option) =>
      option.textContent?.trim(),
    )
    expect(options).toEqual(
      i18n.global.availableLocales.map((locale) =>
        i18n.global.t(`settings.interface.languageOptions.${locale}`),
      ),
    )

    languageSelect.vm.$emit('update:modelValue', 'zh-hant')
    await flushTicks()
    expect(settingsStore.language).toBe('zh-hant')
  })
})
