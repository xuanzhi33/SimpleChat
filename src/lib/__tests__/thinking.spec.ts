// @vitest-environment node（纯逻辑，不需要 jsdom，省掉环境启动开销）
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  THINKING_LEVELS,
  completeWithoutThinking,
  thinkingLevelColors,
  thinkingLevelLabelKey,
  thinkingPayload,
  thinkingStopIndex,
  thinkingStops,
  thinkingStyleOf,
} from '@/lib/thinking'
import type { Model } from '@/types/chat'

const model = (baseUrl: string, extra: Partial<Model> = {}): Model => ({
  id: 'm1',
  name: 'Model',
  baseUrl,
  kind: 'api',
  model: 'x',
  ...extra,
})

const okResponse = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
})

const errorResponse = (status: number, body: string) => ({
  ok: false,
  status,
  text: async () => body,
})

const requestBody = (init: RequestInit) => JSON.parse(String(init.body))

describe('思考档位', () => {
  it('按服务商提供档位：关在最左，第二格是「默认」（不发送参数）', () => {
    expect(thinkingStops('reasoning_effort').map((stop) => stop.level)).toEqual([
      'none',
      undefined,
      'low',
      'medium',
      'high',
      'max',
    ])
    // DeepSeek 没有「中」
    expect(thinkingStops('thinking_effort').map((stop) => stop.level)).toEqual([
      'none',
      undefined,
      'low',
      'high',
      'max',
    ])
    // 只支持开关的：两档
    expect(thinkingStops('enable_thinking').map((stop) => stop.level)).toEqual([
      'none',
      undefined,
      'medium',
    ])
    // 没接的风格：界面直接不显示这一项
    expect(thinkingStops('none')).toEqual([])
    expect(THINKING_LEVELS.none).toBeUndefined()
  })

  it('硅基流动的「开」显示成「开」而不是「中」', () => {
    expect(thinkingStops('enable_thinking').map((stop) => stop.labelKey)).toEqual([
      'chat.thinkingEffort.none',
      'chat.thinkingEffort.default',
      'chat.thinkingEffort.on',
    ])
    expect(thinkingLevelLabelKey('enable_thinking', 'none')).toBe('chat.thinkingEffort.none')
  })

  it('风格按 base url 反推；LLM Gate 和自定义地址判断不出来', () => {
    expect(thinkingStyleOf(model('https://api.openai.com/v1'))).toBe('reasoning_effort')
    expect(thinkingStyleOf(model('https://api.deepseek.com'))).toBe('thinking_effort')
    expect(thinkingStyleOf(model('https://openrouter.ai/api/v1'))).toBe('unified_reasoning')
    expect(thinkingStyleOf(model('https://api.siliconflow.cn/v1'))).toBe('enable_thinking')
    expect(thinkingStyleOf(model('http://localhost:11456/model-01/v1'))).toBe('none')
    expect(thinkingStyleOf(model('https://api.deepseek.com', { kind: 'gate' }))).toBe('none')
    expect(thinkingStyleOf(undefined)).toBe('none')
  })

  it('档位映射到各家字段，「最高」落到各家的顶档', () => {
    expect(thinkingPayload('reasoning_effort', 'none')).toEqual({ reasoning_effort: 'none' })
    expect(thinkingPayload('reasoning_effort', 'high')).toEqual({ reasoning_effort: 'high' })
    expect(thinkingPayload('reasoning_effort', 'max')).toEqual({ reasoning_effort: 'xhigh' })

    // 关掉不能用 reasoning_effort: none，得走开关字段
    expect(thinkingPayload('thinking_effort', 'none')).toEqual({ thinking: { type: 'disabled' } })
    expect(thinkingPayload('thinking_effort', 'max')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'max',
    })

    expect(thinkingPayload('unified_reasoning', 'none')).toEqual({ reasoning: { enabled: false } })
    expect(thinkingPayload('unified_reasoning', 'low')).toEqual({ reasoning: { effort: 'low' } })

    expect(thinkingPayload('enable_thinking', 'none')).toEqual({ enable_thinking: false })
    expect(thinkingPayload('enable_thinking', 'medium')).toEqual({ enable_thinking: true })
  })

  it('不支持、没选档位、档位不在该风格里，都一个字段都不发', () => {
    expect(thinkingPayload('none', 'high')).toEqual({})
    expect(thinkingPayload('reasoning_effort')).toEqual({})
    expect(thinkingPayload('thinking_effort', 'medium')).toEqual({})
  })

  it('档位配色：五个档位各不相同，关和默认也不是一个颜色', () => {
    const levels = ['none', 'low', 'medium', 'high', 'max'] as const

    expect(new Set(levels.map((level) => thinkingLevelColors(level).text)).size).toBe(levels.length)
    expect(thinkingLevelColors('none').text).not.toBe(thinkingLevelColors().text)
    expect(thinkingLevelColors().text).toBe('text-sky-600 dark:text-sky-400')
    // 滑轨色要带选择器（打到 Slider 内部元素上，不改 ui/slider），每档同样不同色
    expect(thinkingLevelColors('high').range).toBe('[&_[data-slot=slider-range]]:bg-orange-500')
    expect(new Set(levels.map((level) => thinkingLevelColors(level).range)).size).toBe(
      levels.length,
    )
  })

  it('换模型后按最近档位吸附，一样近时取更高的那档', () => {
    expect(thinkingStopIndex('reasoning_effort', 'high')).toBe(4)
    expect(thinkingStopIndex('reasoning_effort', 'max')).toBe(5)
    // 中 → DeepSeek：低和高一样近 → 高
    expect(thinkingStopIndex('thinking_effort', 'medium')).toBe(3)
    // 低 / 最高 → 硅基流动：都是「开」
    expect(thinkingStopIndex('enable_thinking', 'low')).toBe(2)
    expect(thinkingStopIndex('enable_thinking', 'max')).toBe(2)
    expect(thinkingStopIndex('enable_thinking', 'none')).toBe(0)
    // 没设置过就落在「默认」那一格（紧挨着「关」）
    expect(thinkingStopIndex('enable_thinking')).toBe(1)
    expect(thinkingStopIndex('thinking_effort')).toBe(1)
  })
})

describe('内部请求（标题）关思考', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('支持配档位的服务商：带上「关」的字段请求', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<unknown>>(async () =>
      okResponse('标题'),
    )
    vi.stubGlobal('fetch', fetchMock)

    const title = await completeWithoutThinking(model('https://api.deepseek.com'), [
      { role: 'user', content: 'hi' },
    ])

    expect(title).toBe('标题')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(requestBody(fetchMock.mock.calls[0]![1])).toMatchObject({
      thinking: { type: 'disabled' },
      stream: false,
    })
  })

  it('不认识的地址（LLM Gate 那种）：一个思考字段都不发', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<unknown>>(async () =>
      okResponse('标题'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await completeWithoutThinking(model('http://localhost:11456/model-01/v1'), [
      { role: 'user', content: 'hi' },
    ])

    expect(requestBody(fetchMock.mock.calls[0]![1])).not.toHaveProperty('thinking')
  })

  it('模型不认这些参数（400）时，退回不带参数的版本再试一次', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchMock = vi
      .fn<(url: string, init: RequestInit) => Promise<unknown>>()
      .mockResolvedValueOnce(errorResponse(400, 'Unsupported parameter: reasoning_effort'))
      .mockResolvedValueOnce(okResponse('标题'))
    vi.stubGlobal('fetch', fetchMock)

    const title = await completeWithoutThinking(model('https://api.openai.com/v1'), [
      { role: 'user', content: 'hi' },
    ])

    expect(title).toBe('标题')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBody(fetchMock.mock.calls[1]![1])).not.toHaveProperty('reasoning_effort')
  })

  it('其他错误（401 之类）不重试，直接抛出去', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<unknown>>(async () =>
      errorResponse(401, 'bad key'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      completeWithoutThinking(model('https://api.deepseek.com'), [{ role: 'user', content: 'hi' }]),
    ).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
