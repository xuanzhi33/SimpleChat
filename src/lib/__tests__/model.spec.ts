// @vitest-environment node（纯逻辑，不需要 jsdom，省掉环境启动开销）
import { describe, it, expect } from 'vitest'
import { modelKind, modelRequestOptions, resolveConversationModel } from '@/lib/model'
import type { Conversation, Model } from '@/types/chat'

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

  it('对话用哪个模型：对话自己选的 → 否则默认模型；选的那条被删了就回默认', () => {
    const models: Model[] = [
      { ...base, id: 'a' },
      { ...base, id: 'b' },
    ]
    const conversation = (modelId?: string): Conversation => ({
      id: 'c',
      title: 't',
      messages: [],
      createdAt: 0,
      updatedAt: 0,
      modelId,
    })

    expect(resolveConversationModel(conversation('b'), models, models[0])?.id).toBe('b')
    // 没选 / 选了已经不存在的 id：都回默认模型
    expect(resolveConversationModel(conversation(), models, models[0])?.id).toBe('a')
    expect(resolveConversationModel(conversation('gone'), models, models[0])?.id).toBe('a')
    expect(resolveConversationModel(null, models, undefined)).toBeUndefined()
  })
})
