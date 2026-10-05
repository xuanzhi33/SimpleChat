import { describe, expect, it } from 'vitest'
import { HttpError, summarizeError, describeError } from '@/lib/errors'

/** 把 key 和参数都拼进结果里，方便断言走的是哪个分支 */
const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}(${Object.values(named).join(',')})` : key

describe('describeError', () => {
  it('收录的状态码给出对应的原因和解决方法', () => {
    const text = describeError(new HttpError(401), t)
    expect(text).toContain('errors.http.401.reason')
    expect(text).toContain('errors.http.401.solution')
  })

  it('未收录的状态码走 other，但保留真实状态码', () => {
    const text = describeError(new HttpError(418), t)
    expect(text).toContain('errors.http.other.reason')
    expect(text).toContain('418')
  })

  it('有服务端原文时多一行，没有时少一行', () => {
    expect(describeError(new HttpError(400, 'invalid model'), t)?.split('\n')).toHaveLength(3)
    expect(describeError(new HttpError(400), t)?.split('\n')).toHaveLength(2)
    expect(summarizeError(new HttpError(400, 'invalid model'), t)).not.toContain('\n')
  })

  it('非 HttpError 返回 null，交给调用方决定回退文案', () => {
    expect(describeError(new TypeError('Failed to fetch'), t)).toBeNull()
    expect(describeError(new Error('boom'), t)).toBeNull()
    expect(summarizeError(new Error('boom'), t)).toBeNull()
  })
})
