import type { Model, ModelKind } from '@/types/chat'

/** 欢迎弹窗「DeepSeek 官方模式」使用的固定接口地址 */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

/** 欢迎弹窗「DeepSeek 官方模式」使用的默认模型 ID */
export const DEEPSEEK_MODEL_ID = 'deepseek-chat'

/** 历史数据没有 kind 字段，一律按 gate 处理 */
export function modelKind(model: Model): ModelKind {
  return model.kind ?? 'gate'
}

export function isApiModel(model: Model): boolean {
  return modelKind(model) === 'api'
}

/** 传给 ChatService 的请求选项：gate 模式不带 model，也不带 apiKey */
export function modelRequestOptions(model: Model): { model?: string; apiKey?: string } {
  if (!isApiModel(model)) return {}
  return { model: model.model, apiKey: model.apiKey }
}
