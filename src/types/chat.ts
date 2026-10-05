export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
  timestamp: number
  isStreaming?: boolean
}

export type ModelKind = 'api' | 'gate'

export interface Model {
  id: string
  name: string // 展示名，不参与请求
  baseUrl: string
  kind?: ModelKind // 缺省视为 'gate'（历史数据兼容）
  model?: string // 仅 api 模式：请求体中的 model 字段
  apiKey?: string // 仅 api 模式：Bearer token，可为空
}

export type ModelExtra = Pick<Model, 'kind' | 'model' | 'apiKey'>

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
      reasoning?: string
    }
    finish_reason: string | null
  }>
}
