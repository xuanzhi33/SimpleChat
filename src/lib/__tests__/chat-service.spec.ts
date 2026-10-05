import { describe, it, expect, vi, afterEach } from 'vitest'
import { ChatService, isLikelyCorsError } from '@/lib/chat-service'
import { HttpError } from '@/lib/errors'

const encoder = new TextEncoder()

function sseResponse(...chunks: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)))
      controller.close()
    },
  })
  return { ok: true, body }
}

const delta = (d: object) => `data: ${JSON.stringify({ choices: [{ delta: d }] })}\n\n`

const errorResponse = (status: number, body: string) => ({
  ok: false,
  status,
  text: async () => body,
})

describe('ChatService.sendMessage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('累加 content 与 reasoning_content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse(
          delta({ content: 'hi' }),
          delta({ reasoning_content: 'think' }),
          'data: [DONE]\n\n',
        ),
      ),
    )
    const chunks: Array<[string, string | undefined]> = []
    await new ChatService('http://x/v1').sendMessage(
      [],
      (c, r) => chunks.push([c, r]),
      vi.fn(),
      vi.fn(),
    )
    expect(chunks).toEqual([
      ['hi', undefined],
      ['', 'think'],
    ])
  })

  it('兼容 reasoning 字段', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(delta({ reasoning: 'r' }))),
    )
    const onChunk = vi.fn()
    await new ChatService('http://x/v1').sendMessage([], onChunk, vi.fn(), vi.fn())
    expect(onChunk).toHaveBeenCalledWith('', 'r')
  })

  it('api 模式发送 model 与 Authorization', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<unknown>>(async () =>
      sseResponse('data: [DONE]\n\n'),
    )
    vi.stubGlobal('fetch', fetchMock)
    await new ChatService('http://x/v1', { model: 'gpt-4o', apiKey: 'sk-1' }).sendMessage(
      [],
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    const init = fetchMock.mock.calls[0]![1]
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-1' })
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'gpt-4o' })
  })

  it('gate 模式不发 model 与 Authorization', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<unknown>>(async () =>
      sseResponse('data: [DONE]\n\n'),
    )
    vi.stubGlobal('fetch', fetchMock)
    await new ChatService('http://x/v1').sendMessage([], vi.fn(), vi.fn(), vi.fn())
    const init = fetchMock.mock.calls[0]![1]
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(JSON.parse(String(init.body))).not.toHaveProperty('model')
  })

  it('非 2xx 时包成 HttpError，并带上服务端给的提示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => errorResponse(401, JSON.stringify({ error: { message: 'bad key' } }))),
    )
    const onError = vi.fn()
    await new ChatService('http://x/v1').sendMessage([], vi.fn(), vi.fn(), onError)
    expect(onError.mock.calls[0]![0]).toMatchObject({ status: 401, message: 'bad key' })
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(HttpError)
  })

  it('testConnection 失败时同样抛 HttpError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => errorResponse(503, 'gateway down')),
    )
    await expect(new ChatService('http://x/v1').testConnection()).rejects.toMatchObject({
      status: 503,
      message: 'gateway down',
    })
  })

  it('isLikelyCorsError 只认 TypeError', () => {
    expect(isLikelyCorsError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isLikelyCorsError(new Error('HTTP 401'))).toBe(false)
  })

  it('abort 走 onComplete 而非 onError', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abort
      }),
    )
    const onComplete = vi.fn()
    const onError = vi.fn()
    await new ChatService('http://x/v1').sendMessage([], vi.fn(), onComplete, onError)
    expect(onComplete).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
