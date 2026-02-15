export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
  timestamp: number
  isStreaming?: boolean
}

export interface Model {
  id: string
  name: string
  baseUrl: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  modelId?: string // 关联的模型ID
  systemPrompt?: string // 系统提示词
  createdAt: number
  updatedAt: number
}

export interface ChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      reasoning_content?: string
    }
    finish_reason: string | null
  }>
}
