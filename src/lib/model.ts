import type { Model, ModelKind } from '@/types/chat'

/** 欢迎弹窗「DeepSeek 官方模式」使用的固定接口地址，官方文档给的 base_url 不带 /v1 */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

/** 欢迎弹窗「DeepSeek 官方模式」使用的默认模型 ID */
export const DEEPSEEK_MODEL_ID = 'deepseek-flash'

/** 「DeepSeek 官方模式」新建模型时的展示名（Model.name 只用于显示，不参与请求） */
export const DEEPSEEK_MODEL_NAME = 'DeepSeek'

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
