export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
  /** 思考耗时（毫秒），从请求发出到最后一个思考增量 */
  reasoningDurationMs?: number
  /** 已收到正文增量，思考阶段结束（单向：一旦为真不再回头） */
  thinkingDone?: boolean
  /** 请求失败时的详情文案，红色显示在 AI 输出的位置（有部分正文时接在正文下面） */
  error?: string
  timestamp: number
  isStreaming?: boolean
}

export type ModelKind = 'api' | 'gate'

/**
 * 思考档位（统一词汇，见 `lib/thinking.ts`）：none = 明确要求不思考，其余是「想多久」。
 * 每个服务商支持的子集不同，最高档在发送时映射成它自己的顶档。
 */
export type ThinkingLevel = 'none' | 'low' | 'medium' | 'high' | 'max'

export interface Model {
  id: string
  name: string // 展示名，不参与请求
  baseUrl: string
  kind?: ModelKind // 缺省视为 'gate'（历史数据兼容）
  model?: string // 仅 api 模式：请求体中的 model 字段
  apiKey?: string // 仅 api 模式：Bearer token，可为空
}

export type ModelExtra = Pick<Model, 'kind' | 'model' | 'apiKey'>

/** 系统提示词预设：全局共用（存设置里），不跟对话绑定 */
export interface SystemPromptPreset {
  id: string
  name: string
  content: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  modelId?: string // 关联的模型ID
  systemPrompt?: string // 系统提示词
  /** 思考档位；不设置 = 不发送任何思考参数，由模型自己决定 */
  thinkingLevel?: ThinkingLevel
  /** 标题由用户手动改过，之后不再让模型自动生成 */
  titleIsManual?: boolean
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
