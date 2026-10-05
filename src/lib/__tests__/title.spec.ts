import { describe, expect, it } from 'vitest'
import { buildTitlePrompt, cleanTitle } from '@/lib/title'

describe('cleanTitle', () => {
  it('去掉包裹的引号、# 和换行后的解释', () => {
    expect(cleanTitle('  "  Vue 响应式原理  "  ')).toBe('Vue 响应式原理')
    expect(cleanTitle('## 部署指南\n这是一段解释')).toBe('部署指南')
    expect(cleanTitle('“中文引号”')).toBe('中文引号')
  })

  it('压缩空白、截断，空标题返回空串', () => {
    expect(cleanTitle('a\n\nb   c')).toBe('a')
    expect(cleanTitle('x'.repeat(50))).toHaveLength(30)
    expect(cleanTitle('   \n  ')).toBe('')
  })
})

describe('buildTitlePrompt', () => {
  it('带上用户与助手原文，并各自截断到 500 字', () => {
    const messages = buildTitlePrompt('u'.repeat(600), 'a'.repeat(600))
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.content).toBe(`User: ${'u'.repeat(500)}\n\nAssistant: ${'a'.repeat(500)}`)
  })
})
