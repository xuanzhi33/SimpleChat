// @vitest-environment node（纯逻辑，不需要 jsdom，省掉环境启动开销）
import { describe, it, expect } from 'vitest'
import { modelKind, modelRequestOptions } from '@/lib/model'
import type { Model } from '@/types/chat'

const base: Model = { id: '1', name: 'x', baseUrl: 'http://a' }

describe('model helpers', () => {
  it('缺省 kind 视为 gate 且不带请求参数', () => {
    expect(modelKind(base)).toBe('gate')
    expect(modelRequestOptions(base)).toEqual({})
  })

  it('api 模式透传 model 与 apiKey', () => {
    const m: Model = { ...base, kind: 'api', model: 'gpt-4o', apiKey: 'sk-1' }
    expect(modelKind(m)).toBe('api')
    expect(modelRequestOptions(m)).toEqual({ model: 'gpt-4o', apiKey: 'sk-1' })
  })
})
