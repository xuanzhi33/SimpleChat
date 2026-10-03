import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/lib/markdown'

describe('renderMarkdown', () => {
  it('空输入返回空串', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('渲染 markdown 并支持 GFM 换行', () => {
    expect(renderMarkdown('# hi')).toContain('<h1')
    expect(renderMarkdown('a\nb')).toContain('<br>')
  })

  it('净化 XSS', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)><script>alert(1)</script>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })
})
