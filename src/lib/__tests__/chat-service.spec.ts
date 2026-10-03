import { describe, it, expect, vi, afterEach } from 'vitest'
import { ChatService } from '@/lib/chat-service'

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

describe('ChatService.sendMessage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('累加 content 与 reasoning_content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(delta({ content: 'hi' }), delta({ reasoning_content: 'think' }), 'data: [DONE]\n\n')),
    )
    const chunks: Array<[string, string | undefined]> = []
    await new ChatService('http://x/v1').sendMessage([], (c, r) => chunks.push([c, r]), vi.fn(), vi.fn())
    expect(chunks).toEqual([
      ['hi', undefined],
      ['', 'think'],
    ])
  })

  it('兼容 reasoning 字段', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(delta({ reasoning: 'r' }))))
    const onChunk = vi.fn()
    await new ChatService('http://x/v1').sendMessage([], onChunk, vi.fn(), vi.fn())
    expect(onChunk).toHaveBeenCalledWith('', 'r')
  })

  it('abort 走 onComplete 而非 onError', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw abort }))
    const onComplete = vi.fn()
    const onError = vi.fn()
    await new ChatService('http://x/v1').sendMessage([], vi.fn(), onComplete, onError)
    expect(onComplete).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
