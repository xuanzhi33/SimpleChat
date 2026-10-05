import type { Message, ChatCompletionChunk } from '@/types/chat'

export interface ChatServiceOptions {
  /** 请求体中的 model 字段（仅 API 模式需要；Gate 模式留空） */
  model?: string
  /** Bearer token，留空则不发送 Authorization 头 */
  apiKey?: string
}

/**
 * 判断错误是否疑似被浏览器 CORS 拦截。
 * 跨域被拒、断网、DNS 失败在 fetch 层面都只会抛 TypeError，无法互相区分，
 * 因此调用方展示文案时需写成“疑似”，并建议改用 LLM Gate。
 */
export function isLikelyCorsError(error: unknown): boolean {
  return error instanceof TypeError
}

export class ChatService {
  private baseUrl: string
  private options: ChatServiceOptions

  constructor(baseUrl: string, options: ChatServiceOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // 移除末尾的斜杠
    this.options = options
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.options.apiKey) {
      headers['Authorization'] = `Bearer ${this.options.apiKey}`
    }
    return headers
  }

  /** 请求体公共部分：gate 模式不带 model */
  private buildBody(extra: Record<string, unknown>): string {
    return JSON.stringify({
      ...(this.options.model ? { model: this.options.model } : {}),
      ...extra,
    })
  }

  /**
   * 发送聊天消息并处理流式响应
   */
  async sendMessage(
    messages: Message[],
    onChunk: (content: string, reasoningContent?: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      // 转换消息格式为OpenAI格式
      const apiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: this.buildBody({
          messages: apiMessages,
          stream: true,
        }),
        signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一个不完整的行

        for (const line of lines) {
          const trimmedLine = line.trim()

          if (!trimmedLine || trimmedLine === 'data: [DONE]') {
            continue
          }

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6) // 移除 'data: ' 前缀
              const chunk: ChatCompletionChunk = JSON.parse(jsonStr)

              const delta = chunk.choices[0]?.delta
              if (delta) {
                const content = delta.content || ''
                // 兼容两种字段名：多数网关用 reasoning_content，vLLM/OpenRouter/Ollama 等用 reasoning
                const reasoningContent = delta.reasoning_content || delta.reasoning

                if (content || reasoningContent) {
                  onChunk(content, reasoningContent)
                }
              }
            } catch (e) {
              console.warn('Failed to parse SSE chunk:', trimmedLine, e)
            }
          }
        }
      }

      onComplete()
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('Request was aborted')
          onComplete()
        } else {
          onError(error)
        }
      } else {
        onError(new Error('Unknown error occurred'))
      }
    }
  }

  /**
   * 测试连通性：让模型只回复 "OK"。
   * 成功返回模型回复内容，失败抛错（调用方可用 isLikelyCorsError 追加提示）
   */
  async testConnection(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: this.buildBody({
        messages: [{ role: 'user', content: 'Reply with exactly "OK" and nothing else.' }],
        stream: false,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
    }

    const data = await response.json()
    return data?.choices?.[0]?.message?.content ?? ''
  }
}
