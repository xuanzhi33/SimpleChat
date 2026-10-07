import { HttpError, readErrorDetail } from '@/lib/errors'

/**
 * OpenAI 兼容的 `/models` 接口返回的模型，归一化成这一份。
 *
 * 各家字段名并不统一，缺字段是常态（OpenAI / SiliconFlow 只回 id/object/created/owned_by），
 * 所以拿不到就留空，UI 少显示一行，不要自己编数据。
 */
export interface RemoteModel {
  id: string
  /** 展示名，接口没给就留空 */
  name?: string
  /** 上下文窗口（token 数），接口没给就留空 */
  contextWindow?: number
  /** 支持的输入模态，如 ['text', 'image'] */
  inputModalities?: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string' && !!item.trim())
  return items.length ? items : undefined
}

/**
 * 上下文长度在各家的字段名：
 * DeepSeek / Groq 用 `context_window`，OpenRouter 和多数中转用 `context_length`，
 * vLLM 用 `max_model_len`，LM Studio 的 REST API 用 `max_context_length`。
 */
const CONTEXT_WINDOW_FIELDS = [
  'context_length',
  'context_window',
  'max_model_len',
  'max_context_length',
]

function readContextWindow(model: Record<string, unknown>): number | undefined {
  for (const field of CONTEXT_WINDOW_FIELDS) {
    const value = asPositiveNumber(model[field])
    if (value !== undefined) return value
  }
  return undefined
}

function readInputModalities(model: Record<string, unknown>): string[] | undefined {
  // DeepSeek 放在顶层；OpenRouter 放在 architecture 里
  const direct = asStringList(model.input_modalities)
  if (direct) return direct
  return asStringList(asRecord(model.architecture)?.input_modalities)
}

/** 把 `/models` 里的一条记录转成 RemoteModel；连 id 都没有就返回 null（这类脏数据直接丢掉） */
export function normalizeModel(value: unknown): RemoteModel | null {
  const model = asRecord(value)
  if (!model) return null

  const id = asNonEmptyString(model.id)
  if (!id) return null

  return {
    id,
    name: asNonEmptyString(model.name) ?? asNonEmptyString(model.display_name),
    contextWindow: readContextWindow(model),
    inputModalities: readInputModalities(model),
  }
}

/** 把 `/models` 的响应体转成列表，按 id 去重并排序（OpenRouter 那种 400 多个的列表排一下才好找） */
export function normalizeModelList(payload: unknown): RemoteModel[] {
  const body = asRecord(payload)
  const raw = Array.isArray(body?.data) ? body.data : Array.isArray(payload) ? payload : []

  const models = raw.map(normalizeModel).filter((model): model is RemoteModel => model !== null)
  const unique = new Map(models.map((model) => [model.id, model]))
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** 下拉里要显示的模型名；接口没给名字、或名字和 id 一样时返回空（这时只显示 id 就够了） */
export function modelDisplayName(model: RemoteModel): string {
  return model.name && model.name !== model.id ? model.name : ''
}

/**
 * 没名字时用模型 ID 推一个展示名：先丢掉 `厂商slug/` 前缀（取最后一段），
 * 再把 `-` 换成空格 —— `openai/gpt-5-mini` → `gpt 5 mini`。
 * 推出来是空就退回原 id，免得名字变成一片空白。
 */
export function modelNameFromId(id: string): string {
  const name = (id.split('/').pop() ?? '').replace(/-/g, ' ').trim()
  return name || id.trim()
}

/**
 * 窄屏下模型名只留第一个词：截到第一个空格 / 冒号 / 括号之类的分隔符之前
 * （`DeepSeek V4 Pro` → `DeepSeek`）。首字符必须是字母或数字 ——
 * 名字以符号开头（`·GPT-5`）时拿不到词，返回空串，让调用方只留图标。
 */
export function modelShortName(name: string): string {
  return name.trim().match(/^[\p{L}\p{N}][^\s:：|·/()（）\[\]【】，,、]*/u)?.[0] ?? ''
}

/**
 * 拼成 `${baseUrl}/models` 请求模型列表。
 * 失败时抛 HttpError（HTTP 层错误）或 TypeError（跨域 / 断网，见 isLikelyCorsError）。
 */
export async function fetchModelList(options: {
  baseUrl: string
  apiKey?: string
  signal?: AbortSignal
}): Promise<RemoteModel[]> {
  const { baseUrl, apiKey, signal } = options
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    signal,
  })

  if (!response.ok) {
    throw new HttpError(response.status, await readErrorDetail(response))
  }

  return normalizeModelList(await response.json())
}

/** 按 1000 进制换算档位，能整除时不带小数点：128000 → 128K、8192 → 8.2K */
function scale(tokens: number, unit: number): string {
  const scaled = tokens / unit
  const rounded = scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10
  return String(rounded)
}

/** token 数转成给人看的单位：128000 → '128K'，1048576 → '1M'，512 → '512' */
export function formatContextWindow(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens >= 1_000_000) return `${scale(tokens, 1_000_000)}M`
  if (tokens >= 1_000) return `${scale(tokens, 1_000)}K`
  return String(Math.round(tokens))
}
