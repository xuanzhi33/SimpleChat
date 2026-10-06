// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  fetchModelList,
  formatContextWindow,
  modelDisplayName,
  normalizeModelList,
} from '@/lib/models'
import { HttpError } from '@/lib/errors'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeModelList', () => {
  it('OpenAI / SiliconFlow 那种只有 id 的响应也能用，缺的字段就是缺', () => {
    const models = normalizeModelList({
      object: 'list',
      data: [{ id: 'deepseek-ai/DeepSeek-V4-Flash', object: 'model', created: 0, owned_by: '' }],
    })

    expect(models).toEqual([{ id: 'deepseek-ai/DeepSeek-V4-Flash' }])
  })

  it('DeepSeek：顶层 name / context_window / input_modalities', () => {
    const models = normalizeModelList({
      data: [
        {
          id: 'deepseek-v4-pro',
          object: 'model',
          owned_by: 'deepseek',
          name: 'DeepSeek V4 Pro',
          context_window: 128000,
          max_output_tokens: 64000,
          input_modalities: ['text', 'image'],
          output_modalities: ['text'],
        },
      ],
    })

    expect(models[0]).toEqual({
      id: 'deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      contextWindow: 128000,
      inputModalities: ['text', 'image'],
    })
  })

  it('OpenRouter：context_length + architecture.input_modalities', () => {
    const models = normalizeModelList({
      data: [
        {
          id: 'openai/gpt-5',
          name: 'GPT-5',
          context_length: 400000,
          architecture: { input_modalities: ['text', 'image', 'file'] },
        },
      ],
    })

    expect(models[0]).toEqual({
      id: 'openai/gpt-5',
      name: 'GPT-5',
      contextWindow: 400000,
      inputModalities: ['text', 'image', 'file'],
    })
  })

  it('vLLM 的 max_model_len 也认', () => {
    expect(normalizeModelList({ data: [{ id: 'qwen', max_model_len: 32768 }] })[0]).toEqual({
      id: 'qwen',
      contextWindow: 32768,
    })
  })

  it('脏数据丢掉、按 id 去重并排序、裸数组也认', () => {
    const models = normalizeModelList([
      null,
      { object: 'model' },
      { id: '   ' },
      { id: 'z-model' },
      { id: 'a-model', context_length: 8192 },
      { id: 'z-model', name: 'Z' },
    ])

    expect(models).toEqual([
      { id: 'a-model', contextWindow: 8192 },
      { id: 'z-model', name: 'Z' },
    ])
  })
})

describe('formatContextWindow', () => {
  it('按 K / M 显示，取整后不留 .0', () => {
    expect(formatContextWindow(128000)).toBe('128K')
    expect(formatContextWindow(200000)).toBe('200K')
    expect(formatContextWindow(8192)).toBe('8.2K')
    expect(formatContextWindow(1048576)).toBe('1M')
    expect(formatContextWindow(512)).toBe('512')
    expect(formatContextWindow(0)).toBe('')
  })
})

describe('modelDisplayName', () => {
  it('没名字或名字就是 id 时返回空', () => {
    expect(modelDisplayName({ id: 'a', name: 'A' })).toBe('A')
    expect(modelDisplayName({ id: 'a', name: 'a' })).toBe('')
    expect(modelDisplayName({ id: 'a' })).toBe('')
  })
})

describe('fetchModelList', () => {
  const stubFetch = (response: Response) => {
    const mock = vi.fn(async () => response)
    vi.stubGlobal('fetch', mock)
    return mock
  }

  it('请求 `${baseUrl}/models` 并带上 Bearer Key', async () => {
    const mock = stubFetch(
      new Response(JSON.stringify({ data: [{ id: 'gpt-5', context_length: 400000 }] }), {
        status: 200,
      }),
    )

    const models = await fetchModelList({ baseUrl: 'https://api.openai.com/v1/', apiKey: 'sk-1' })

    expect(mock).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer sk-1' },
      signal: undefined,
    })
    expect(models).toEqual([{ id: 'gpt-5', contextWindow: 400000 }])
  })

  it('没有 Key 就不发 Authorization 头（本地网关不需要鉴权）', async () => {
    const mock = stubFetch(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    await fetchModelList({ baseUrl: 'http://localhost:1234/v1' })

    expect(mock).toHaveBeenCalledWith('http://localhost:1234/v1/models', {
      headers: undefined,
      signal: undefined,
    })
  })

  it('HTTP 错误抛 HttpError，并把服务端原文带出来', async () => {
    stubFetch(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 }),
    )

    const error = await fetchModelList({ baseUrl: 'https://api.openai.com/v1' }).catch((e) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(401)
    expect((error as HttpError).message).toBe('Invalid API key')
  })
})
