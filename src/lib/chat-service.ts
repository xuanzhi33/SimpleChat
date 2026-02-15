import type { Message, ChatCompletionChunk } from '@/types/chat'

export class ChatService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // 移除末尾的斜杠
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
                const reasoningContent = delta.reasoning_content

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
   * 测试网关连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }
}
