/**
 * 携带 HTTP 状态码的错误。
 * 状态码决定「为什么失败」和「怎么解决」，所以单独建一个类型，而不是只丢一句话。
 */
export class HttpError extends Error {
  readonly status: number

  constructor(status: number, detail = '') {
    super(detail)
    this.name = 'HttpError'
    this.status = status
  }
}

type Translate = (key: string, named?: Record<string, unknown>) => string

/** 收录了「原因 + 解决方法」的状态码，其余状态码走 other 的通用文案 */
const KNOWN_STATUSES = [400, 401, 402, 422, 429, 500, 503]

/** 状态码 → i18n 键前缀；未收录的状态码统一用 other */
function statusKey(error: unknown): { status: number; key: string } | null {
  if (!(error instanceof HttpError)) return null
  const key = KNOWN_STATUSES.includes(error.status) ? String(error.status) : 'other'
  return { status: error.status, key }
}

/** 一行版：请求失败（401）：API Key 错误，认证失败。适合 toast */
export function summarizeError(error: unknown, t: Translate): string | null {
  const info = statusKey(error)
  if (!info) return null

  return t('errors.requestFailed', {
    status: info.status,
    reason: t(`errors.http.${info.key}.reason`),
  })
}

/**
 * 详细版：一行版 + 服务端返回的原文 + 解决方法，用换行分隔。
 * 展示时需要 `whitespace-pre-line`。不是 HttpError 时返回 null，由调用方决定回退文案。
 */
export function describeError(error: unknown, t: Translate): string | null {
  const info = statusKey(error)
  if (!info) return null

  const lines = [summarizeError(error, t)!]

  // 服务端原文能帮用户定位参数问题，但有些网关只回一句话，没必要重复展示
  const detail = error instanceof HttpError ? error.message.trim() : ''
  if (detail) {
    lines.push(t('errors.serverDetail', { detail }))
  }

  lines.push(t('errors.solution', { solution: t(`errors.http.${info.key}.solution`) }))
  return lines.join('\n')
}
